"""Lightweight image validation used at the API boundary.

Deeper, modality-aware quality gating (blur/brightness/occlusion) lives in the
Vision Agent. This is the cheap first gate: is it a real, sane-sized image?
"""

from __future__ import annotations

import io

from PIL import Image

from app.core.errors import ValidationAppError

MAX_BYTES = 25 * 1024 * 1024  # 25 MB
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "BMP", "TIFF"}
MIN_DIM = 32
MAX_DIM = 12000


def validate_image(data: bytes) -> dict:
    """Return metadata dict or raise ValidationAppError."""
    if not data:
        raise ValidationAppError("Empty file.")
    if len(data) > MAX_BYTES:
        raise ValidationAppError(f"File too large (max {MAX_BYTES // (1024 * 1024)} MB).")

    try:
        img = Image.open(io.BytesIO(data))
        img.verify()  # integrity check
        img = Image.open(io.BytesIO(data))  # reopen; verify() leaves it unusable
    except Exception as exc:
        raise ValidationAppError("File is not a valid image.") from exc

    if img.format not in ALLOWED_FORMATS:
        raise ValidationAppError(f"Unsupported format: {img.format}.")
    w, h = img.size
    if w < MIN_DIM or h < MIN_DIM:
        raise ValidationAppError("Image too small.")
    if w > MAX_DIM or h > MAX_DIM:
        raise ValidationAppError("Image dimensions too large.")

    return {
        "format": img.format,
        "width": w,
        "height": h,
        "mode": img.mode,
        "bytes": len(data),
    }


def guess_extension(fmt: str) -> str:
    return {"JPEG": "jpg", "PNG": "png", "WEBP": "webp", "BMP": "bmp", "TIFF": "tiff"}.get(
        fmt, "bin"
    )

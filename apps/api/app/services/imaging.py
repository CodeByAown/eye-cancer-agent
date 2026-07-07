"""Image-processing pipeline for medical inference.

Modular, reusable stages shared by the live scanner and the upload workflow:
frame validation → quality assessment (blur/brightness) → region extraction →
preprocessing/normalization → encoding for inference.

Implemented with Pillow only (no numpy/OpenCV dependency) so it stays light.
"""

from __future__ import annotations

import base64
import io
from dataclasses import dataclass, field

from PIL import Image, ImageFilter, ImageStat

# Quality thresholds (tuned for typical webcam / phone eye photos).
BLUR_MIN_VARIANCE = 40.0  # variance of Laplacian; higher = sharper
BRIGHTNESS_MIN = 40.0
BRIGHTNESS_MAX = 220.0
CONTRAST_MIN = 18.0  # stddev of luminance
GLARE_MAX_FRACTION = 0.12  # fraction of near-white (blown-out) pixels
INFERENCE_MAX_DIM = 1024

_LAPLACIAN = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1)


@dataclass
class QualityCheck:
    key: str
    label: str
    passed: bool
    value: float
    guidance: str = ""


@dataclass
class QualityReport:
    is_valid: bool
    checks: list[QualityCheck] = field(default_factory=list)
    # Promoted scalars for convenience / backwards-compat.
    blur_variance: float = 0.0
    brightness: float = 0.0

    @property
    def reasons(self) -> list[str]:
        return [c.guidance for c in self.checks if not c.passed and c.guidance]

    @property
    def score(self) -> int:
        """0–100 overall quality score."""
        if not self.checks:
            return 0
        return round(100 * sum(1 for c in self.checks if c.passed) / len(self.checks))

    def as_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "score": self.score,
            "blur_variance": round(self.blur_variance, 2),
            "brightness": round(self.brightness, 1),
            "checks": [
                {
                    "key": c.key,
                    "label": c.label,
                    "passed": c.passed,
                    "value": round(c.value, 2),
                    "guidance": c.guidance,
                }
                for c in self.checks
            ],
            "reasons": self.reasons,
        }


def decode(data: bytes) -> Image.Image:
    """Bytes → RGB PIL image (raises on invalid input)."""
    img = Image.open(io.BytesIO(data))
    img.load()
    return img.convert("RGB")


def assess_quality(img: Image.Image) -> QualityReport:
    """Structured, guidance-rich quality assessment: focus, exposure, contrast,
    and glare/reflection. Returns per-check results so the UI can explain WHY an
    image was rejected and how to fix it (never a bare "unclear")."""
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    brightness = float(stat.mean[0])
    contrast = float(stat.stddev[0])
    blur_variance = float(ImageStat.Stat(gray.filter(_LAPLACIAN)).var[0])

    # Glare: fraction of near-white pixels (blown highlights / reflections).
    hist = gray.histogram()
    total = max(1, sum(hist))
    glare_fraction = sum(hist[245:]) / total

    blur_guidance = "" if blur_variance >= BLUR_MIN_VARIANCE else (
        "Image is blurry — hold still and let the camera focus."
    )
    checks = [
        QualityCheck(
            "focus",
            "Focus / sharpness",
            blur_variance >= BLUR_MIN_VARIANCE,
            blur_variance,
            blur_guidance,
        ),
        QualityCheck(
            "exposure",
            "Exposure",
            BRIGHTNESS_MIN <= brightness <= BRIGHTNESS_MAX,
            brightness,
            ""
            if BRIGHTNESS_MIN <= brightness <= BRIGHTNESS_MAX
            else (
                "Too dark — add lighting or face a light source."
                if brightness < BRIGHTNESS_MIN
                else "Overexposed — reduce direct light."
            ),
        ),
        QualityCheck(
            "contrast",
            "Contrast",
            contrast >= CONTRAST_MIN,
            contrast,
            "" if contrast >= CONTRAST_MIN else "Low contrast — improve lighting and framing.",
        ),
        QualityCheck(
            "glare",
            "Glare / reflections",
            glare_fraction <= GLARE_MAX_FRACTION,
            glare_fraction,
            ""
            if glare_fraction <= GLARE_MAX_FRACTION
            else "Strong glare/reflection detected — avoid direct light or flash on the eye.",
        ),
    ]

    # Focus + exposure are hard requirements; contrast/glare are advisory.
    is_valid = checks[0].passed and checks[1].passed
    return QualityReport(
        is_valid=is_valid,
        checks=checks,
        blur_variance=blur_variance,
        brightness=brightness,
    )


def crop_region(img: Image.Image, bbox: dict | None) -> Image.Image:
    """Crop a normalized bbox {x,y,w,h} (0..1). Returns the image unchanged if
    no bbox is provided. Used to isolate the eye region when the client supplies
    tracking coordinates."""
    if not bbox:
        return img
    w, h = img.size
    x0 = max(0, int(bbox.get("x", 0) * w))
    y0 = max(0, int(bbox.get("y", 0) * h))
    x1 = min(w, int((bbox.get("x", 0) + bbox.get("w", 1)) * w))
    y1 = min(h, int((bbox.get("y", 0) + bbox.get("h", 1)) * h))
    if x1 <= x0 or y1 <= y0:
        return img
    return img.crop((x0, y0, x1, y1))


def preprocess(img: Image.Image, max_dim: int = INFERENCE_MAX_DIM) -> Image.Image:
    """Downscale (preserving aspect) for inference; strips metadata."""
    im = img.copy()
    im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    return im


def to_data_url(img: Image.Image, fmt: str = "JPEG", quality: int = 90) -> str:
    """Encode as a base64 data URL for vision-model inference."""
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=quality)
    b64 = base64.b64encode(buf.getvalue()).decode()
    mime = "image/jpeg" if fmt == "JPEG" else f"image/{fmt.lower()}"
    return f"data:{mime};base64,{b64}"

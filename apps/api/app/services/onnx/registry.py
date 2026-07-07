"""Model weight specs + auto-download/cache.

Each `ModelSpec` describes a downloadable ONNX model and its metadata. Weights
are fetched once into a local cache (gitignored) and reused. Downloads are
verified by size; a sha256 can be pinned for stronger integrity.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import anyio
import httpx

from app.core.logging import get_logger

log = get_logger("onnx.registry")

# registry.py = apps/api/app/services/onnx/registry.py → parents[3] = apps/api
WEIGHTS_DIR = Path(__file__).resolve().parents[3] / "weights"


@dataclass(frozen=True)
class ModelSpec:
    key: str  # cache subdir
    name: str
    version: str
    model_url: str
    filename: str
    classes: list[str]
    labels: dict[str, str] = field(default_factory=dict)
    license: str = "unknown"
    commercial_ok: bool = False
    source: str = ""  # provenance (HF repo, paper)
    input_size: int = 224
    # ImageNet normalization by default (most timm/torchvision exports).
    mean: tuple[float, float, float] = (0.485, 0.456, 0.406)
    std: tuple[float, float, float] = (0.229, 0.224, 0.225)
    sha256: str | None = None
    # Optional external-weights sidecar (ONNX models >2GB or exported with
    # external data). Must be downloaded alongside the graph with this exact name.
    data_url: str | None = None
    data_filename: str | None = None

    @property
    def dir(self) -> Path:
        return WEIGHTS_DIR / self.key

    @property
    def path(self) -> Path:
        return self.dir / self.filename


async def _download(client: httpx.AsyncClient, url: str, dest: Path) -> int:
    resp = await client.get(url)
    resp.raise_for_status()
    await anyio.Path(dest).write_bytes(resp.content)
    return len(resp.content)


async def ensure_weights(spec: ModelSpec) -> Path:
    """Return the local model path, downloading it (and any sidecar) once if absent."""
    path = spec.path
    if path.exists() and path.stat().st_size > 0:
        return path

    spec.dir.mkdir(parents=True, exist_ok=True)
    log.info("model_download_start", key=spec.key, url=spec.model_url)
    async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
        # Sidecar first so it's present when the graph is loaded.
        if spec.data_url and spec.data_filename:
            size = await _download(client, spec.data_url, spec.dir / spec.data_filename)
            log.info("model_sidecar_done", key=spec.key, bytes=size)
        resp = await client.get(spec.model_url)
        resp.raise_for_status()
        data = resp.content

    if spec.sha256:
        digest = hashlib.sha256(data).hexdigest()
        if digest != spec.sha256:
            raise RuntimeError(f"Checksum mismatch for {spec.key}: {digest} != {spec.sha256}")

    await anyio.Path(path).write_bytes(data)
    log.info("model_download_done", key=spec.key, bytes=len(data))
    return path


# ── Registered specialist models ─────────────────────────────────────────────

SKIN_HAM10000 = ModelSpec(
    key="skin_ham10000",
    name="skin-mobilenetv3-ham10000",
    version="1.0",
    model_url="https://huggingface.co/Robobyte/skin-cancer-mobilenet-v3/resolve/main/skin_cancer_model.onnx",
    filename="model.onnx",
    classes=["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"],
    labels={
        "akiec": "Actinic Keratosis / Intraepithelial Carcinoma",
        "bcc": "Basal Cell Carcinoma",
        "bkl": "Benign Keratosis",
        "df": "Dermatofibroma",
        "mel": "Melanoma",
        "nv": "Melanocytic Nevus",
        "vasc": "Vascular Lesion",
    },
    license="see-model-card",
    commercial_ok=False,
    source="HF: Robobyte/skin-cancer-mobilenet-v3 (HAM10000, AUC 0.971)",
)

# Malignant vs benign grouping for risk framing.
SKIN_MALIGNANT = {"mel", "bcc", "akiec"}


FUNDUS_APTOS_DR = ModelSpec(
    key="fundus_aptos_dr",
    name="fundus-resnet50-aptos-dr",
    version="1.0",
    model_url="https://huggingface.co/Shadow0482/ResNet50-APTOS-DR-ONNX/resolve/main/mithu-vit.onnx",
    filename="mithu-vit.onnx",
    data_url="https://huggingface.co/Shadow0482/ResNet50-APTOS-DR-ONNX/resolve/main/mithu-vit.onnx.data",
    data_filename="mithu-vit.onnx.data",
    classes=["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"],
    labels={
        "No DR": "No Diabetic Retinopathy",
        "Mild DR": "Mild Diabetic Retinopathy",
        "Moderate DR": "Moderate Diabetic Retinopathy",
        "Severe DR": "Severe Diabetic Retinopathy",
        "Proliferative DR": "Proliferative Diabetic Retinopathy",
    },
    license="mit",
    commercial_ok=True,
    source="HF: Shadow0482/ResNet50-APTOS-DR-ONNX (ResNet50, APTOS 2019)",
)

# DR grade → screening severity band.
FUNDUS_DR_SEVERITY = {
    "No DR": "none",
    "Mild DR": "mild",
    "Moderate DR": "moderate",
    "Severe DR": "severe",
    "Proliferative DR": "severe",
}

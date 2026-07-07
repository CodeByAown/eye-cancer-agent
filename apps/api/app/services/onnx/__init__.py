
"""Local ONNX inference for specialized medical models.

Real specialist classifiers run here via ONNX Runtime (no torch/TF). Weights are
auto-downloaded and cached on first use so a fresh clone works without committing
large binaries. This is the inference half of the architecture; OpenAI handles
narration/reports/chat.
"""

from app.services.onnx.classifier import OnnxImageClassifier, TopK
from app.services.onnx.registry import ModelSpec, ensure_weights

__all__ = ["ModelSpec", "OnnxImageClassifier", "TopK", "ensure_weights", "warm_models"]


async def warm_models() -> None:
    """Pre-download specialist weights so the first inference request is fast.

    Safe to call at startup as a background task: if weights are already cached,
    each call is a no-op. Failures are logged, never raised (offline dev stays up).
    """
    from app.core.logging import get_logger
    from app.services.onnx.registry import FUNDUS_APTOS_DR, SKIN_HAM10000

    log = get_logger("onnx.warm")
    for spec in (SKIN_HAM10000, FUNDUS_APTOS_DR):
        try:
            await ensure_weights(spec)
        except Exception as exc:  # pragma: no cover - network-dependent
            log.warning("model_warm_failed", key=spec.key, error=str(exc))

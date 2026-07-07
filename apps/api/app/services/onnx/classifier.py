"""Generic ONNX image classifier (ImageNet-style preprocessing).

Reusable across skin/brain/fundus specialist models — differences (labels,
normalization, input size) live in the `ModelSpec`. Runs on CPU via ONNX
Runtime; the session is loaded lazily and cached per model.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

import numpy as np
import onnxruntime as ort
from PIL import Image

from app.core.logging import get_logger
from app.services.onnx.registry import ModelSpec, ensure_weights

log = get_logger("onnx.classifier")


@dataclass
class TopK:
    label: str
    display: str
    prob: float


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


class OnnxImageClassifier:
    def __init__(self, spec: ModelSpec) -> None:
        self.spec = spec
        self._session: ort.InferenceSession | None = None
        self._input_name: str | None = None

    async def _ensure_session(self) -> ort.InferenceSession:
        if self._session is None:
            path = await ensure_weights(self.spec)
            self._session = ort.InferenceSession(
                str(path), providers=["CPUExecutionProvider"]
            )
            self._input_name = self._session.get_inputs()[0].name
            log.info("onnx_session_ready", model=self.spec.name)
        return self._session

    def _preprocess(self, image: bytes) -> np.ndarray:
        img = Image.open(io.BytesIO(image)).convert("RGB")
        size = self.spec.input_size
        img = img.resize((size, size), Image.Resampling.BILINEAR)
        arr = np.asarray(img, dtype=np.float32) / 255.0  # HWC 0..1
        mean = np.array(self.spec.mean, dtype=np.float32)
        std = np.array(self.spec.std, dtype=np.float32)
        arr = (arr - mean) / std
        arr = np.transpose(arr, (2, 0, 1))  # CHW
        return arr[np.newaxis, :, :, :].astype(np.float32)  # NCHW

    async def classify(self, image: bytes, top_k: int = 3) -> list[TopK]:
        session = await self._ensure_session()
        x = self._preprocess(image)
        logits = session.run(None, {self._input_name: x})[0][0]
        probs = _softmax(np.asarray(logits, dtype=np.float32))
        order = np.argsort(probs)[::-1]
        results: list[TopK] = []
        for i in order[:top_k]:
            label = self.spec.classes[int(i)]
            results.append(
                TopK(
                    label=label,
                    display=self.spec.labels.get(label, label),
                    prob=float(probs[int(i)]),
                )
            )
        return results

    async def classify_all(self, image: bytes) -> list[TopK]:
        return await self.classify(image, top_k=len(self.spec.classes))

"""Cancer model selection by modality."""

from __future__ import annotations

from app.services.cancer.base import CancerModel
from app.services.cancer.skin import SkinCancerOnnxModel

_models: dict[str, CancerModel] = {}


def get_cancer_model(modality: str = "dermoscopy") -> CancerModel:
    """Return the specialist model for a modality (cached).

    'dermoscopy'/'skin' → HAM10000 skin classifier. Brain-MRI/fundus register
    here as their ONNX models are added.
    """
    key = "skin" if modality in {"dermoscopy", "skin"} else modality
    if key not in _models:
        if key == "skin":
            _models[key] = SkinCancerOnnxModel()
        else:
            raise ValueError(f"No cancer model registered for modality '{modality}'")
    return _models[key]

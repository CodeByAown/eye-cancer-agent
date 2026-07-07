"""Cancer detection inference — real specialist ONNX models.

Skin (HAM10000) is live now; brain-MRI and others slot in via the same
`CancerModel` contract + ONNX classifier. OpenAI is used only for narration.
"""

from app.services.cancer.base import CancerFinding, CancerModel
from app.services.cancer.factory import get_cancer_model

__all__ = ["CancerFinding", "CancerModel", "get_cancer_model"]

"""Domain enums shared across models and schemas."""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    ORG_ADMIN = "org_admin"
    CLINICIAN = "clinician"
    VIEWER = "viewer"


class Module(StrEnum):
    EYE = "eye"
    CANCER = "cancer"


class Workflow(StrEnum):
    SCANNER = "scanner"
    UPLOAD = "upload"


class Modality(StrEnum):
    ANTERIOR = "anterior"        # external eye (webcam)
    FUNDUS = "fundus"            # retinal image
    DERMOSCOPY = "dermoscopy"    # skin
    MRI = "mri"
    CT = "ct"
    WSI = "wsi"                  # whole-slide pathology


class ScanStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"
    REJECTED = "rejected"        # failed quality gate


class Severity(StrEnum):
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"

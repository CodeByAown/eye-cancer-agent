# Future Expansion — Plug-in Module System

The platform must grow from 2 modules to a full AI healthcare suite **without major refactoring**. This is achieved by treating every capability as a **module = (Agent + Model + UI descriptor + config)** registered behind stable contracts.

## The plug-in contract

A new specialty is added by providing four things — no core changes:

1. **Model module** — weights + preprocessing + inference wrapper (ONNX/PyTorch/MONAI), dropped in `services/inference/<module>/`.
2. **Agent** — implements the `Agent` protocol ([`05-multi-agent.md`](05-multi-agent.md)) declaring its `capabilities` (e.g. `classify.chest_xray`).
3. **Pipeline template** — a declarative recipe the Orchestrator runs (which agents, in what order).
4. **Module manifest** — metadata the frontend + admin consume.

```yaml
# module.manifest.yaml  (example: Chest X-ray)
id: chest_xray
name: "Chest X-ray AI"
category: radiology
modality: [xray]
input: { type: image, formats: [png, jpg, dicom] }
agent: OncologyAgent # or a new RadiologyAgent
capabilities: [classify.chest_xray, explain.gradcam]
model: { name: torchxrayvision-densenet, version: "1.x", license: apache-2.0, commercial_ok: true }
pipeline: [Vision, Radiology, Explainability, Report, Education]
ui: { icon: lungs, route: /radiology/chest-xray, upload: true, realtime: false }
report_template: radiology_default
disclaimers: [not_diagnostic, radiology_specific]
```

The Orchestrator, dashboard nav, upload UI, admin model list, and report engine all render from the manifest + agent registry. **Adding a module = add a folder + manifest + register the agent.**

## Roadmap of pluggable modules

| Module                    | Input                | Reuse candidate                   | New agent?                  |
| ------------------------- | -------------------- | --------------------------------- | --------------------------- |
| **Dental AI**             | intraoral/pano X-ray | dental caries/perio models        | RadiologyAgent              |
| **Chest X-ray**           | X-ray/DICOM          | TorchXRayVision (Apache-2.0)      | RadiologyAgent              |
| **CT Scan**               | DICOM 3D             | MONAI/nnU-Net                     | RadiologyAgent (3D)         |
| **MRI**                   | DICOM 3D             | MONAI/nnU-Net (extends brain-MRI) | existing Oncology/Radiology |
| **Histopathology**        | WSI                  | UNI/Prov-GigaPath + MIL           | PathologyAgent              |
| **ECG**                   | signal/image         | ECG DL models                     | CardiologyAgent (signal)    |
| **Blood Report Analysis** | tabular/PDF          | OCR + rules/ML                    | LabAgent                    |
| **Medical OCR**           | document image       | Tesseract/TrOCR/Donut             | OCRAgent                    |
| **DICOM Viewer**          | DICOM                | OHIF/Cornerstone.js (frontend)    | — (viewer, not inference)   |
| **Medical Billing AI**    | claims/docs          | LLM + rules                       | BillingAgent                |
| **Pharmacy AI**           | prescriptions        | OCR + interaction KB              | PharmacyAgent               |
| **Radiology AI**          | multi-modality       | umbrella over X-ray/CT/MRI        | RadiologyAgent              |

## What makes this non-breaking

- **Uniform agent contract** → orchestrator never hard-codes a specialty.
- **Manifest-driven UI/admin** → no frontend rewrite per module.
- **Shared pipeline stages** (Vision → Specialist → Explainability → Report → Education → Chat) → reused, not rebuilt.
- **Model registry + module registry** → governance, licensing (`commercial_ok`), versioning apply uniformly.
- **Storage/DB are modality-agnostic** (`scans.modality`, JSONB results) → no schema churn per module.
- **DICOM/3D/WSI** handled by Vision Agent extensions (parsers/tilers), not new pipelines.

## Non-inference extensions

- **DICOM Viewer:** integrate **OHIF / Cornerstone.js** as a frontend module (industry standard, open-source) — a viewer surface, orthogonal to agents.
- **FHIR interoperability:** optional `Medplum`/FHIR adapter later for hospital data exchange.

Sources: [TorchXRayVision], [MONAI](https://github.com/Project-MONAI/tutorials), [OHIF viewer], [UNI](https://github.com/mahmoodlab/UNI)

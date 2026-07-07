# Deliverables 1–4: Research Report, Comparisons, Recommended Models & Datasets

This is the "don't reinvent the wheel" audit. For each module I list the mature open-source options, compare them, and recommend what to reuse.

---

## Part A — Eye Disease Detection

### A.1 The anterior vs. posterior split (read `00-overview.md` first)

- **Posterior (retina)** conditions — DR, glaucoma, AMD, hypertensive retinopathy, retinal detachment, optic-disc — require a **fundus image**. Source: upload workflow, or a real fundus camera later.
- **Anterior (external eye)** conditions — conjunctivitis, dry eye, visible cataract, styes, corneal surface, infections — are what a **webcam** can actually see.

### A.2 Foundation model / backbone options

| Option                                                           | What it is                                                                      | Strengths                                                                                                    | Weaknesses                                                                                                 | License      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------ |
| **RETFound** (Moorfields/UCL, _Nature_ 2023)                     | ViT-Large retinal foundation model, MAE self-supervised on ~1.6M retinal images | SOTA transfer for DR, glaucoma, AMD; strong with limited labels; well-cited, actively evaluated through 2025 | **Non-commercial (CC-BY-NC-4.0)** — blocks paid product use as-is; fundus/OCT only; needs fine-tuning head | CC-BY-NC-4.0 |
| **RET-CLIP**                                                     | Retinal image–report contrastive model                                          | Vision-language, good zero/few-shot                                                                          | Newer, smaller community                                                                                   | Research     |
| **General ImageNet ViT / EfficientNet / ConvNeXt** (timm)        | Standard backbones                                                              | Permissive (Apache/MIT), fast, huge ecosystem, commercial-safe                                               | Less retina-specialized; needs more labeled data                                                           | Apache-2.0   |
| **Task-specific Kaggle/HF classifiers** (APTOS DR, ODIR 8-class) | Ready fine-tuned models                                                         | Deploy today, zero training                                                                                  | Variable quality/licensing, often single-dataset, may overfit                                              | Mixed        |

**Recommendation (Eye):**

- **Demo/MVP now:** fine-tune a permissive backbone (**ConvNeXt-Tiny / EfficientNet-V2-S via `timm`**, Apache-2.0) on ODIR-5K + APTOS for the fundus multi-disease head. Commercial-safe, small, fast, ONNX-exportable.
- **Accuracy tier / research demo:** offer **RETFound** as a selectable "research-grade" backbone, clearly flagged **non-commercial** in the UI/config. Best-in-class metrics for client wow-factor without claiming commercial rights.
- **Anterior segment (webcam):** small **EfficientNet-V2-S / MobileNetV3** classifier fine-tuned on external-eye datasets (conjunctivitis, cataract, normal). Lightweight enough to also run in-browser via ONNX Runtime Web later.

### A.3 Existing project comparison (reuse candidates)

| Project                                      | Type                | Use for us                                                                   |
| -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `rmaphoh/RETFound_MAE` (official)            | Repo + weights      | Backbone + fine-tuning recipe                                                |
| `timm` (Hugging Face `pytorch-image-models`) | Backbone zoo        | Commercial-safe backbones, Apache-2.0                                        |
| Kaggle APTOS-2019 top solutions              | Training recipes    | DR grading reference pipeline                                                |
| ODIR-5K community repos                      | Multi-label recipes | 8-class fundus head                                                          |
| `jacobgil/pytorch-grad-cam`                  | Explainability      | Grad-CAM / Grad-CAM++ / attention rollout (MIT)                              |
| **MediaPipe Tasks Vision** (Google)          | Browser CV          | Face landmarker + iris tracking in-browser (Apache-2.0) — the webcam scanner |

### A.4 Recommended datasets (Eye)

| Dataset                                                 | Size                       | Labels                      | Use                    | Note                       |
| ------------------------------------------------------- | -------------------------- | --------------------------- | ---------------------- | -------------------------- |
| **APTOS 2019**                                          | 3,662 fundus               | DR grade 0–4                | DR severity            | Kaggle; clean, popular     |
| **EyePACS / Diabetic Retinopathy Detection**            | 88,702 fundus              | DR grade 0–4                | DR at scale            | Large; noisy labels        |
| **Messidor-2**                                          | ~1,748 fundus              | DR grade                    | DR validation          | Clinical quality           |
| **ODIR-5K**                                             | 5,000 patients (both eyes) | 8 classes (N/D/G/C/A/H/M/O) | **Multi-disease head** | Multi-label; the workhorse |
| **REFUGE / ORIGA / Drishti-GS**                         | fundus                     | Glaucoma + disc/cup seg     | Glaucoma + optic disc  | Adds segmentation          |
| **iChallenge-AMD / ADAM**                               | fundus                     | AMD                         | AMD                    |                            |
| **Ocular / conjunctiva / cataract image sets** (Kaggle) | varies                     | anterior conditions         | **Webcam classifier**  | Curate + clean; smaller    |

> **Licensing/PHI note:** each dataset has its own terms (research-only in several cases). We use them to **train weights**; we do not redistribute the raw datasets. Recorded in a `DATASETS.md` provenance file per model.

---

## Part B — Cancer Detection

### B.1 Modalities have completely different pipelines

Cancer "detection" is really 4+ separate problems. Grouping by input type is the key architectural insight:

| Group                                | Input                                       | Example cancers                                 | Best tooling                                     |
| ------------------------------------ | ------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| **2D single-image classification**   | dermoscopy/clinical photo, single MRI slice | Skin, Brain-tumor MRI                           | CNN/ViT + Grad-CAM (easy, fast, great demo)      |
| **Whole-slide histopathology (WSI)** | gigapixel `.svs`/`.tiff`                    | Breast, Colon, Prostate, Lung path, Blood smear | **Pathology foundation models** + tiling (heavy) |
| **3D volumetric (CT/MRI)**           | DICOM series                                | Lung nodule (CT), Brain (MRI 3D)                | **MONAI / nnU-Net** (heavy, GPU)                 |

### B.2 Model comparison

**2D classification backbones (skin, brain-MRI):**

| Model                                 | Accuracy (typical) | Speed  | License    | Verdict             |
| ------------------------------------- | ------------------ | ------ | ---------- | ------------------- |
| **EfficientNet-V2 / -B0** on HAM10000 | ~87–97% reported   | Fast   | Apache-2.0 | **Recommended MVP** |
| ViT / DeiT ensembles                  | High, heavier      | Slower | Apache/MIT | Later accuracy tier |
| ResNet/DenseNet                       | Solid baselines    | Fast   | BSD/MIT    | Baselines           |

**Pathology foundation models (WSI tier):**

| Model                                    | Params / scale         | Perf                              | License                       | Verdict                   |
| ---------------------------------------- | ---------------------- | --------------------------------- | ----------------------------- | ------------------------- |
| **Prov-GigaPath** (Microsoft/Providence) | 1.3B tiles, 31 tissues | Top-tier                          | Weights open, **check terms** | Strong; feature extractor |
| **Virchow2** (Paige)                     | 1.5M WSIs              | Best overall in recent benchmarks | Restricted                    | Non-commercial            |
| **UNI / UNI2** (Mahmood Lab)             | 100k+ slides           | Excellent generalization          | **Non-commercial**            | Great for research demo   |
| **CONCH** (Mahmood Lab)                  | Vision-language path   | Strong, zero-shot                 | Non-commercial                | Report generation angle   |
| **H-Optimus-0** (Bioptimus)              | 1.1B params            | SOTA                              | Non-commercial                | Research tier             |
| **CTransPath / Lunit-DINO**              | smaller                | Good                              | More permissive               | Commercial-leaning option |

**3D / segmentation:**

| Tool                            | Use                                                       | License    |
| ------------------------------- | --------------------------------------------------------- | ---------- |
| **MONAI** (PyTorch, healthcare) | transforms, models, pipelines, MONAI Deploy               | Apache-2.0 |
| **nnU-Net**                     | self-configuring 3D segmentation (BraTS, organs, nodules) | Apache-2.0 |
| **MONAI + nnU-Net bundles**     | ready BraTS / organ models                                | Apache-2.0 |

### B.3 Recommendation (Cancer)

**Milestone-1 cancer scope — reuse, don't train from scratch:**

1. **Skin cancer** — EfficientNet-V2-S on **HAM10000 + ISIC** (7-class + benign/malignant). 2D, fast, Grad-CAM, permissive. Best "first cancer" demo.
2. **Brain-tumor MRI** — EfficientNet/ConvNeXt on the **Kaggle 4-class MRI set** (glioma / meningioma / pituitary / none). Add **nnU-Net/MONAI BraTS** segmentation overlay as an accuracy-tier upgrade.

**Deferred (later milestones, clearly worth it but heavy):** 3. **Histopathology (breast/colon/lung/blood)** — **UNI or Prov-GigaPath as frozen feature extractor** + lightweight attention-MIL head on **BreakHis / CAMELYON16-17 / PatchCamelyon / NCT-CRC-HE (colon)**. Requires WSI tiling infra + GPU; flag foundation-model licenses as **non-commercial/research** in UI. 4. **Lung CT nodules** — MONAI/nnU-Net on **LUNA16 / LIDC-IDRI**. 3D, GPU-heavy.

### B.4 Recommended datasets (Cancer)

| Modality    | Dataset                                                | Note                    |
| ----------- | ------------------------------------------------------ | ----------------------- |
| Skin        | **HAM10000**, **ISIC 2019/2020**                       | dermoscopy, 7-class     |
| Brain       | **Kaggle Brain-Tumor MRI (4-class)**, **BraTS 2021+**  | classification + 3D seg |
| Breast path | **BreakHis**, **CAMELYON16/17**, **PatchCamelyon**     | WSI + patches           |
| Colon path  | **NCT-CRC-HE-100K**, **CRC-VAL**                       | patch classification    |
| Lung        | **LIDC-IDRI**, **LUNA16**                              | 3D CT nodules           |
| Blood       | **peripheral blood smear / leukemia (ALL-IDB, C-NMC)** | cell classification     |

---

## Part C — Explainable AI (shared)

| Technique                             | Library                           | When                          |
| ------------------------------------- | --------------------------------- | ----------------------------- |
| **Grad-CAM / Grad-CAM++ / Score-CAM** | `jacobgil/pytorch-grad-cam` (MIT) | CNN heatmaps — default        |
| **Attention rollout**                 | same lib                          | ViT / RETFound attention maps |
| **Integrated Gradients / saliency**   | **Captum** (Meta, BSD)            | pixel-attribution alt         |
| **MONAI occlusion sensitivity**       | MONAI                             | 3D/medical                    |

Heatmaps are computed server-side at inference, stored as PNG overlays, and rendered on top of the original image with an opacity slider in the UI.

---

## Part D — The clinical narrative (report text) — use an LLM, grounded

The structured model output (disease, confidence, severity, heatmap) is **numeric**. The polished, readable **report prose** — clinical explanation, causes, risk factors, recommendations, lifestyle, next steps, medication _education_ — is generated by an **LLM (Claude — `claude-sonnet-5` for cost/latency, `claude-opus-4-8` for the premium tier)**, constrained by:

- A strict system prompt: educational only, never diagnostic, always defers to a clinician, includes disclaimers.
- **Grounding:** the LLM only narrates the model's structured findings passed to it (no free-floating diagnosis). Medication content is explicitly labeled _general educational information_, never a prescription.
- A deterministic disclaimer block appended in code (not left to the model).

This gives the "wow" report quality your brief wants while keeping medical claims controlled.

---

## Sources

- [RETFound — _Nature_ 2023](https://www.nature.com/articles/s41586-023-06555-x) · [Glaucoma eval](https://pmc.ncbi.nlm.nih.gov/articles/PMC11625234/) · [Optic nerve eval](<https://www.ophthalmologyscience.org/article/S2666-9145(25)00018-1/fulltext>) · [Foundation models in ophthalmology](https://pmc.ncbi.nlm.nih.gov/articles/PMC11620320/)
- [UNI](https://github.com/mahmoodlab/UNI) · [CONCH](https://github.com/mahmoodlab/CONCH) · [Prov-GigaPath (Nature)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11153137/) · [Open-source digital pathology overview](https://ryanfukushima.substack.com/p/the-open-source-movement-in-digital) · [Pathology FM clinical benchmark](https://arxiv.org/pdf/2407.06508)
- [MONAI nnU-Net tutorial](https://github.com/Project-MONAI/tutorials/blob/main/nnunet/README.md) · [nnU-Net revisited](https://link.springer.com/chapter/10.1007/978-3-031-72114-4_47) · [BraTS SSA nnU-Net](https://arxiv.org/pdf/2511.02893)
- [EfficientNet skin cancer (MDPI)](https://www.mdpi.com/2813-477X/3/4/23) · [Wavelet+EfficientNet HAM10000](https://www.jcancer.org/v16p0506.htm) · [Lightweight distillation](https://arxiv.org/pdf/2406.17051)
- [MediaPipe Iris](https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/) · [Face Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js) · [Eye tracking in browser](https://blog.roboflow.com/build-eye-tracking-in-browser/)
- [ODIR-5K overview](https://medium.com/datascientest/ocular-disease-intelligent-recognition-odir-2019-77bb62d42f1b) · [Breast histopath WSI review](https://arxiv.org/pdf/2306.01546) · [CAMELYON/BreakHis benchmark](https://www.nature.com/articles/s41597-025-05586-5) · [Medical imaging datasets list](https://github.com/m-aryayi/Medical-Imaging-Datasets)

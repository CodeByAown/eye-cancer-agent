# AI Eye Scanner — Signature Showcase Spec

The scanner is the first thing a client sees and the reason they believe this is a real commercial medical AI product. It must feel like a **medical scanning instrument**, not a webcam page.

## Design north star

A dark, cinematic "diagnostic bay": the user's face in a frosted-glass viewport, precision reticles locking onto each eye, a scan sweep, circular telemetry HUD, and live confidence — resolving into a clean result card. Reference inspiration: futuristic glassmorphism dashboards + medical SaaS kits (see sources).

## Capability stack (all in-browser, privacy-preserving)

| Capability               | Tech                             | Notes                                |
| ------------------------ | -------------------------------- | ------------------------------------ |
| Face detection           | MediaPipe Face Landmarker (WASM) | 468-point mesh                       |
| Eye detection & tracking | Face Landmarker eye regions      | per-eye ROI                          |
| Iris tracking            | MediaPipe Iris                   | pupil/iris landmarks, depth estimate |
| Head-pose estimation     | solvePnP on landmarks            | yaw/pitch/roll → alignment guidance  |
| Quality gating           | brightness/blur/occlusion checks | reject bad frames before inference   |

**Privacy:** all tracking runs locally in WebAssembly; **no video leaves the device.** Only a single cropped eye ROI is sent on explicit **Capture**, with recorded consent. This is a selling point, not a footnote.

## The HUD (visual system)

- **Frosted viewport** with subtle grid + vignette; dark theme, medical teal/indigo accents.
- **Per-eye reticles** — animated corner brackets that snap from "searching" → "locked" (color + micro-haptic-style pulse).
- **Scan sweep** — a horizontal/radial light line during the ~2–4s capture, with particle shimmer.
- **Circular HUD rings** — concentric gauges around each eye showing tracking stability, lighting, alignment.
- **Live status log** — terminal-style messages: `Initializing sensors… Face locked… Eyes tracked… Alignment 94%… Capturing… Analyzing…`
- **Confidence indicators** — animated radial meter + numeric, updating live.
- **Scan progress** — determinate ring 0→100%.
- **Optional SFX** — soft lock/scan/complete tones (muted by default, user-toggle).
- **Motion** — Framer Motion; everything respects `prefers-reduced-motion` (falls back to static states).

## Interaction flow (states)

```
IDLE → PERMISSION → INITIALIZING → SEARCHING(face) → LOCKED(eyes) →
ALIGN(head pose guidance) → CAPTURE(sweep+progress) → ANALYZING(agent) →
RESULT(card) → [Generate Report] / [Ask AI] / [Rescan]
```

Guardrails surface as first-class UI: poor lighting/alignment → coaching, not a bad prediction. Low confidence → "Inconclusive — try again / upload a clearer image."

## AI scope (honest)

Anterior-segment only: **normal / conjunctivitis / redness / dry-eye signs / visible cataract suspect / external infection**. Persistent CTA: _"For retinal diseases (diabetic retinopathy, glaucoma, AMD), upload a fundus image."_ → routes to Phase-3 upload.

## Pipeline

Local MediaPipe loop (30fps, no network) → user Capture → cropped eye ROI POST → **Vision Agent** (quality gate) → **Eye Specialist Agent** (anterior model, ONNX, CPU-fast) → result streamed back (SSE) → RESULT card. Optionally chain Report + Chat agents.

## Result card

Disease label • animated confidence meter • severity dots • one-line plain-language summary • buttons: _Full Report_, _Ask AI about this_, _Rescan_, _Upload fundus instead_. Structural disclaimer band.

## Performance targets

- Tracking ≥ 24fps on a mid laptop; model load < 2s (cached WASM + weights).
- Capture→result < 1.5s (small ONNX model on CPU).
- Graceful degradation on no-GPU / low-end devices.

Sources: [MediaPipe Iris](https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/) · [Face Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js) · [Browser eye tracking](https://blog.roboflow.com/build-eye-tracking-in-browser/) · [Glassmorphism best practices](https://uxpilot.ai/blogs/glassmorphism-ui) · [Futuristic glass dashboard](https://www.aura.build/templates/futuristic-glassmorph-85)

/**
 * Lazy loader for the MediaPipe Face Landmarker.
 *
 * Dynamically imported so the ~heavy WASM runtime stays out of the initial
 * bundle and never runs during SSR. WASM + model are fetched from the official
 * CDN (self-host later for offline/CSP-strict deployments).
 */

import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let instance: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (instance) return instance;
  if (loading) return loading;

  loading = (async () => {
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
    instance = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
    return instance;
  })();

  try {
    return await loading;
  } catch (err) {
    loading = null; // allow retry
    throw err;
  }
}

export function disposeFaceLandmarker() {
  instance?.close();
  instance = null;
  loading = null;
}

"use client";

import { useEffect, useRef, useState } from "react";

import { getFaceLandmarker } from "@/lib/scanner/face-landmarker";
import {
  alignmentScore,
  extractGeometry,
  headPoseFromMatrix,
  type FaceGeometry,
  type HeadPose,
  type Point,
} from "@/lib/scanner/landmarks";

export type TrackingStatus = "loading" | "ready" | "error";

export interface TrackingFrame {
  ts: number;
  geometry: FaceGeometry | null;
  pose: HeadPose | null;
}

export interface TrackingSummary {
  faceDetected: boolean;
  eyesLocked: boolean; // both eyes tracked
  faceFraction: number; // 0..1 — face bbox width / frame width (proxy for distance)
  distance: "far" | "ok" | "close"; // derived from faceFraction
  stability: number; // 0..100
  alignment: number; // 0..100
  lighting: "low" | "ok" | "good";
  fps: number;
}

const INITIAL_SUMMARY: TrackingSummary = {
  faceDetected: false,
  eyesLocked: false,
  faceFraction: 0,
  distance: "far",
  stability: 0,
  alignment: 0,
  lighting: "low",
  fps: 0,
};

/**
 * Runs MediaPipe face/eye/iris tracking on a <video> via requestAnimationFrame.
 * Latest geometry is written to `frameRef` (read by the canvas HUD at full fps
 * without re-rendering); a lightweight `summary` is throttled to React state for
 * telemetry readouts.
 */
export function useFaceTracking(videoRef: React.RefObject<HTMLVideoElement>, active: boolean) {
  const [status, setStatus] = useState<TrackingStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrackingSummary>(INITIAL_SUMMARY);

  const frameRef = useRef<TrackingFrame>({ ts: 0, geometry: null, pose: null });

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let cancelled = false;

    // Smoothed metrics + fps bookkeeping.
    let lastIris: Point | null = null;
    let stabilityEma = 0;
    let lastVideoTs = -1;
    let frames = 0;
    let fpsWindowStart = performance.now();
    let fps = 0;

    // Cheap luminance sampler (downscaled video → average brightness).
    const lumaCanvas = document.createElement("canvas");
    lumaCanvas.width = 32;
    lumaCanvas.height = 18;
    const lumaCtx = lumaCanvas.getContext("2d", { willReadFrequently: true });
    let lighting: TrackingSummary["lighting"] = "low";
    let lastLumaAt = 0;

    let lastSummaryAt = 0;

    const sampleLighting = (video: HTMLVideoElement) => {
      if (!lumaCtx) return;
      try {
        lumaCtx.drawImage(video, 0, 0, 32, 18);
        const { data } = lumaCtx.getImageData(0, 0, 32, 18);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avg = sum / (data.length / 4);
        lighting = avg < 55 ? "low" : avg < 110 ? "ok" : "good";
      } catch {
        /* cross-origin or not-ready; ignore */
      }
    };

    const loop = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const landmarker = ready ? readyLandmarker : null;

      if (video && landmarker && video.readyState >= 2) {
        const now = performance.now();
        // detectForVideo needs strictly increasing timestamps.
        const videoTs = video.currentTime * 1000;
        if (videoTs !== lastVideoTs) {
          lastVideoTs = videoTs;
          try {
            const result = landmarker.detectForVideo(video, now);
            const lms = result.faceLandmarks?.[0];
            if (lms && lms.length > 0) {
              const geometry = extractGeometry(lms);
              const matrix = result.facialTransformationMatrixes?.[0]?.data;
              const pose = matrix ? headPoseFromMatrix(matrix) : null;
              frameRef.current = { ts: now, geometry, pose };

              // Stability from iris movement (lower movement → higher stability).
              const iris = geometry.left?.iris ?? geometry.right?.iris ?? null;
              if (iris && lastIris) {
                const move = Math.hypot(iris.x - lastIris.x, iris.y - lastIris.y);
                const inst = Math.max(0, 1 - move * 40); // 0..1
                stabilityEma = stabilityEma * 0.8 + inst * 0.2;
              }
              lastIris = iris;
            } else {
              frameRef.current = { ts: now, geometry: null, pose: null };
              lastIris = null;
              stabilityEma *= 0.9;
            }
          } catch {
            /* transient detect error; keep looping */
          }

          if (now - lastLumaAt > 500) {
            sampleLighting(video);
            lastLumaAt = now;
          }

          frames++;
          if (now - fpsWindowStart >= 1000) {
            fps = Math.round((frames * 1000) / (now - fpsWindowStart));
            frames = 0;
            fpsWindowStart = now;
          }

          if (now - lastSummaryAt > 120) {
            lastSummaryAt = now;
            const g = frameRef.current.geometry;
            const eyesLocked = Boolean(g?.left && g?.right);
            const faceFraction = g?.bbox?.w ?? 0;
            // Comfortable framing for an eye scan: face spans ~35–75% of frame.
            const distance: TrackingSummary["distance"] =
              faceFraction < 0.32 ? "far" : faceFraction > 0.8 ? "close" : "ok";
            setSummary({
              faceDetected: Boolean(g),
              eyesLocked,
              faceFraction,
              distance,
              stability: Math.round(stabilityEma * 100),
              alignment: Math.round(alignmentScore(frameRef.current.pose ?? undefined) * 100),
              lighting,
              fps,
            });
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };

    let ready = false;
    let readyLandmarker: Awaited<ReturnType<typeof getFaceLandmarker>> | null = null;

    getFaceLandmarker()
      .then((lm) => {
        if (cancelled) return;
        readyLandmarker = lm;
        ready = true;
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Failed to load the vision model.");
      });

    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      setSummary(INITIAL_SUMMARY);
    };
  }, [active, videoRef]);

  return { status, error, summary, frameRef };
}

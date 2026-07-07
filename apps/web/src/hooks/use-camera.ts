"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "error" | "unsupported";

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Manages webcam access for the scanner. Requests the front camera, streams it
 * into a <video>, and surfaces a typed status so the UI can guide the user
 * through permission prompts, denials, and missing-hardware cases.
 */
export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError("Camera API is not available in this browser.");
      return;
    }
    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus("ready");
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        setStatus("denied");
        setError("Camera permission was denied.");
      } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
        setStatus("error");
        setError("No compatible camera was found.");
      } else {
        setStatus("error");
        setError(err.message || "Could not start the camera.");
      }
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, status, error, start, stop };
}

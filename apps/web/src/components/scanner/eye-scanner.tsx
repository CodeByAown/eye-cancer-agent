"use client";

import { motion } from "framer-motion";
import { Camera, RefreshCw, ScanEye, ShieldAlert, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ClinicalReport } from "@/components/report/clinical-report";
import { ScannerOverlay, type ScannerPhase } from "@/components/scanner/scanner-overlay";
import { TelemetryPanel } from "@/components/scanner/telemetry-panel";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/toast";
import { useCamera } from "@/hooks/use-camera";
import { useFaceTracking } from "@/hooks/use-face-tracking";
import { useAnalyzeScan, useCreateScan, useGenerateReport } from "@/lib/api/hooks";
import type { ClinicalReport as ReportT, Prediction, Scan } from "@/lib/api/types";

type Capture = "none" | "capturing" | "analyzing" | "reporting" | "result";

const CAPTURE_MS = 2200;

export function EyeScanner() {
  const camera = useCamera();
  const [started, setStarted] = useState(false);
  const tracking = useFaceTracking(camera.videoRef, started && camera.status === "ready");

  const [capture, setCapture] = useState<Capture>("none");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Prediction | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [report, setReport] = useState<ReportT | null>(null);
  const [log, setLog] = useState<string[]>(["Awaiting sensor activation…"]);

  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const createScan = useCreateScan();
  const analyzeScan = useAnalyzeScan();
  const generateReport = useGenerateReport();

  const pushLog = useCallback((line: string) => {
    setLog((l) => [...l.slice(-12), line]);
  }, []);

  // Derived lifecycle phase.
  const faceLocked = tracking.summary.faceDetected;
  const phase: ScannerPhase =
    capture !== "none"
      ? capture === "capturing"
        ? "capturing"
        : capture === "analyzing" || capture === "reporting"
          ? "analyzing"
          : "done"
      : faceLocked
        ? "locked"
        : "searching";

  // Log lifecycle transitions.
  useEffect(() => {
    if (camera.status === "requesting") pushLog("Initializing camera sensor…");
    if (camera.status === "ready") pushLog("Camera online. Loading vision model…");
  }, [camera.status, pushLog]);
  useEffect(() => {
    if (tracking.status === "ready") pushLog("Vision model ready. Searching for face…");
    if (tracking.status === "error") pushLog("ERROR: vision model failed to load.");
  }, [tracking.status, pushLog]);
  const lockedRef = useRef(false);
  useEffect(() => {
    if (faceLocked && !lockedRef.current) {
      lockedRef.current = true;
      pushLog("Face locked. Eyes & iris tracked.");
    } else if (!faceLocked && lockedRef.current) {
      lockedRef.current = false;
      pushLog("Face lost. Re-searching…");
    }
  }, [faceLocked, pushLog]);

  const grabFrame = useCallback(async (): Promise<File | null> => {
    const video = camera.videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Crop tightly to the eye region using live tracking geometry, so the model
    // receives a close-up of the eyes rather than the whole face (which reads as
    // "unclear"). Falls back to the full frame if geometry is unavailable.
    const g = tracking.frameRef.current?.geometry;
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;
    if (g?.left && g?.right) {
      const cx = (g.left.center.x + g.right.center.x) / 2;
      const cy = (g.left.center.y + g.right.center.y) / 2;
      const eyeDist = Math.abs(g.right.center.x - g.left.center.x) || 0.25;
      const halfW = Math.min(0.5, eyeDist * 1.15);
      const halfH = Math.min(0.5, eyeDist * 0.6);
      const x0 = Math.max(0, cx - halfW);
      const y0 = Math.max(0, cy - halfH);
      const x1 = Math.min(1, cx + halfW);
      const y1 = Math.min(1, cy + halfH);
      sx = Math.round(x0 * vw);
      sy = Math.round(y0 * vh);
      sw = Math.max(1, Math.round((x1 - x0) * vw));
      sh = Math.max(1, Math.round((y1 - y0) * vh));
    }

    // Upscale the crop to a consistent inference size for better model input.
    const targetW = 768;
    const scale = targetW / sw;
    canvas.width = targetW;
    canvas.height = Math.round(sh * scale);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.92),
    );
    if (!blob) return null;
    return new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
  }, [camera.videoRef, tracking.frameRef]);

  const runCapture = useCallback(async () => {
    setResult(null);
    setCapture("capturing");
    setProgress(0);
    pushLog("Capturing… hold still.");

    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const p = Math.min(1, (performance.now() - start) / CAPTURE_MS);
        setProgress(p);
        if (p < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    const file = await grabFrame();
    if (!file) {
      toast.error("Capture failed", "Could not read a frame from the camera.");
      setCapture("none");
      return;
    }

    setCapture("analyzing");
    pushLog("Frame captured. Running anterior-segment analysis…");
    try {
      const created = await createScan.mutateAsync({ file, module: "eye", workflow: "scanner" });
      const analyzed = await analyzeScan.mutateAsync(created.id);
      if (!analyzed.prediction) throw new Error("No prediction returned.");
      setScan(analyzed);
      setResult(analyzed.prediction);
      pushLog(
        `Detected: ${analyzed.prediction.top_label} (${Math.round(Number(analyzed.prediction.top_confidence) * 100)}%). Generating report…`,
      );
      setCapture("reporting");
      const rep = await generateReport.mutateAsync(created.id);
      setReport(rep);
      setCapture("result");
      pushLog("Clinical report ready.");
    } catch (e) {
      toast.error("Analysis failed", e instanceof Error ? e.message : "Please try again.");
      pushLog("ERROR: analysis request failed.");
      setCapture("none");
    }
  }, [analyzeScan, createScan, generateReport, grabFrame, pushLog]);

  const enableCamera = useCallback(async () => {
    setStarted(true);
    await camera.start();
  }, [camera]);

  const rescan = useCallback(() => {
    setResult(null);
    setScan(null);
    setReport(null);
    setCapture("none");
    setProgress(0);
    pushLog("Ready for a new scan.");
  }, [pushLog]);

  const canCapture = phase === "locked" && capture === "none";

  // Completed scan → transition into the full clinical report.
  if (capture === "result" && scan && result && report) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Scan complete</h2>
            <p className="text-muted-foreground text-sm">Your anterior-segment screening report</p>
          </div>
          <Button variant="secondary" onClick={rescan}>
            <RefreshCw className="size-4" /> New scan
          </Button>
        </div>
        <ClinicalReport scan={scan} prediction={result} report={report} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-6 lg:grid-cols-[1fr_300px]">
      {/* Stage */}
      <div className="relative">
        <div className="border-border relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
          {/* Mirrored stage: video + HUD share the flip so coords line up */}
          <div className="absolute inset-0" style={{ transform: "scaleX(-1)" }}>
            <video ref={camera.videoRef} playsInline muted className="h-full w-full object-cover" />
            {started && camera.status === "ready" && tracking.status === "ready" && (
              <ScannerOverlay frameRef={tracking.frameRef} phase={phase} progress={progress} />
            )}
          </div>

          {/* Vignette + grid */}
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.55))]" />

          {/* Overlays for non-live states */}
          <StageOverlay
            started={started}
            cameraStatus={camera.status}
            trackingStatus={tracking.status}
            cameraError={camera.error}
            onEnable={enableCamera}
          />

          {/* Phase caption */}
          {started && camera.status === "ready" && (
            <div className="absolute left-4 top-4">
              <StatusBadge
                tone={phase === "locked" || phase === "done" ? "success" : "info"}
                pulse={phase === "searching" || phase === "analyzing"}
                label={phaseLabel(phase)}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="gradient" size="lg" disabled={!canCapture} onClick={runCapture}>
            <Camera /> Capture &amp; Analyze
          </Button>
          <p className="text-muted-foreground text-xs">
            {phase === "searching" && "Position your face in view."}
            {phase === "locked" && "Hold still, then capture."}
            {phase === "capturing" && "Scanning…"}
            {capture === "analyzing" && "Analyzing with the specialist model…"}
            {capture === "reporting" && "Generating your clinical report…"}
          </p>
        </div>

        <canvas ref={captureCanvasRef} className="hidden" />
      </div>

      {/* Right rail */}
      <div className="space-y-4">
        <TelemetryPanel summary={tracking.summary} statusLog={log} />
        <ScopeNote />
      </div>
    </div>
  );
}

function phaseLabel(phase: ScannerPhase): string {
  return {
    searching: "Searching",
    locked: "Locked",
    aligning: "Align",
    capturing: "Scanning",
    analyzing: "Analyzing",
    done: "Complete",
  }[phase];
}

function StageOverlay({
  started,
  cameraStatus,
  trackingStatus,
  cameraError,
  onEnable,
}: {
  started: boolean;
  cameraStatus: string;
  trackingStatus: string;
  cameraError: string | null;
  onEnable: () => void;
}) {
  const show =
    !started ||
    cameraStatus === "requesting" ||
    cameraStatus === "denied" ||
    cameraStatus === "unsupported" ||
    cameraStatus === "error" ||
    (cameraStatus === "ready" && trackingStatus === "loading") ||
    trackingStatus === "error";
  if (!show) return null;

  const denied = cameraStatus === "denied";
  const unsupported = cameraStatus === "unsupported";
  const errored = cameraStatus === "error" || trackingStatus === "error";
  const loading =
    cameraStatus === "requesting" || (cameraStatus === "ready" && trackingStatus === "loading");

  return (
    <div className="glass-strong absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
      {!started && (
        <>
          <span className="bg-primary/12 text-primary mb-4 inline-flex size-16 items-center justify-center rounded-2xl">
            <ScanEye className="size-8" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight">AI Eye Scanner</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            A realtime anterior-segment scan. Video is processed{" "}
            <span className="text-foreground">entirely on your device</span> — nothing is uploaded
            until you capture.
          </p>
          <Button variant="gradient" size="lg" className="mt-6" onClick={onEnable}>
            <Camera /> Enable camera
          </Button>
        </>
      )}
      {loading && started && (
        <div className="flex flex-col items-center gap-3">
          <div className="border-primary/30 border-t-primary size-8 animate-spin rounded-full border-2" />
          <p className="text-muted-foreground text-sm">
            {cameraStatus === "requesting" ? "Requesting camera…" : "Loading vision model…"}
          </p>
        </div>
      )}
      {denied && (
        <StateMessage
          title="Camera permission denied"
          body="Allow camera access in your browser's site settings, then try again."
          onRetry={onEnable}
        />
      )}
      {unsupported && (
        <StateMessage
          title="Camera not supported"
          body="This browser does not expose a camera API."
        />
      )}
      {errored && !denied && !unsupported && (
        <StateMessage
          title="Something went wrong"
          body={cameraError ?? "The scanner could not start."}
          onRetry={onEnable}
        />
      )}
    </div>
  );
}

function StateMessage({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="bg-danger/12 text-danger mb-3 inline-flex size-12 items-center justify-center rounded-full">
        <ShieldAlert className="size-6" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{body}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

function ScopeNote() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-border/60 rounded-lg border p-4"
    >
      <div className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
        <Upload className="text-primary mt-0.5 size-4 shrink-0" />
        <span>
          The scanner screens <span className="text-foreground">anterior-segment</span> signs
          (redness, conjunctivitis, visible cataract). Retinal screening requires a fundus image.
        </span>
      </div>
    </motion.div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Cpu,
  Eye,
  FileText,
  Move,
  RefreshCw,
  ScanFace,
  ShieldAlert,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ClinicalReport } from "@/components/report/clinical-report";
import { ScannerOverlay, type ScannerPhase } from "@/components/scanner/scanner-overlay";
import { StageRail, type Stage, type StageStatus } from "@/components/scanner/stage-rail";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useCamera } from "@/hooks/use-camera";
import { useFaceTracking, type TrackingSummary } from "@/hooks/use-face-tracking";
import { useAnalyzeScan, useCreateScan, useGenerateReport } from "@/lib/api/hooks";
import type { ClinicalReport as ReportT, Prediction, Scan } from "@/lib/api/types";

type Phase = "idle" | "scanning" | "capturing" | "enhancing" | "analyzing" | "reporting" | "result";

const CAPTURE_MS = 1600;
const AUTO_CAPTURE_FROM = 3; // countdown seconds once all checks pass

// ── Readiness gates (real signals) ─────────────────────────────────────────
interface Gate {
  key: string;
  label: string;
  icon: typeof Camera;
  ok: boolean;
  hint: string;
}

function buildGates(engineReady: boolean, cameraReady: boolean, s: TrackingSummary): Gate[] {
  return [
    {
      key: "engine",
      label: "AI engine initialized",
      icon: Cpu,
      ok: engineReady,
      hint: "Loading vision engine…",
    },
    {
      key: "camera",
      label: "Camera calibrated",
      icon: Camera,
      ok: cameraReady,
      hint: "Starting camera…",
    },
    {
      key: "face",
      label: "Face detected",
      icon: ScanFace,
      ok: s.faceDetected,
      hint: "Position your face in the frame",
    },
    {
      key: "eyes",
      label: "Eyes locked",
      icon: Eye,
      ok: s.eyesLocked,
      hint: "Look toward the camera",
    },
    {
      key: "distance",
      label: "Distance validated",
      icon: Move,
      ok: s.distance === "ok",
      hint: s.distance === "far" ? "Move a little closer" : "Move back slightly",
    },
    {
      key: "lighting",
      label: "Lighting assessed",
      icon: Sun,
      ok: s.lighting !== "low",
      hint: "Add light or face a light source",
    },
    {
      key: "stability",
      label: "Focus & stability",
      icon: Target,
      ok: s.stability >= 55,
      hint: "Hold still for a moment",
    },
  ];
}

function readinessStages(gates: Gate[]): Stage[] {
  const firstUnmet = gates.findIndex((g) => !g.ok);
  return gates.map((g, i) => {
    let status: StageStatus = "pending";
    if (g.ok) status = "pass";
    else if (i === firstUnmet) status = "active";
    return { id: g.key, label: g.label, hint: g.hint, icon: g.icon, status };
  });
}

const PROCESSING: { id: string; label: string; icon: typeof Camera }[] = [
  { id: "capturing", label: "Capturing image", icon: Camera },
  { id: "enhancing", label: "Enhancing & quality check", icon: Sparkles },
  { id: "analyzing", label: "AI model inference", icon: Cpu },
  { id: "reporting", label: "Generating clinical report", icon: FileText },
];

function processingStages(phase: Phase): Stage[] {
  const order = ["capturing", "enhancing", "analyzing", "reporting"];
  const idx = order.indexOf(phase);
  return PROCESSING.map((p, i) => ({
    id: p.id,
    label: p.label,
    icon: p.icon,
    status: (i < idx ? "done" : i === idx ? "active" : "pending") as StageStatus,
  }));
}

export function EyeScanner() {
  const camera = useCamera();
  const [started, setStarted] = useState(false);
  const tracking = useFaceTracking(camera.videoRef, started && camera.status === "ready");

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [report, setReport] = useState<ReportT | null>(null);

  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const createScan = useCreateScan();
  const analyzeScan = useAnalyzeScan();
  const generateReport = useGenerateReport();

  const engineReady = tracking.status === "ready";
  const cameraReady = camera.status === "ready";
  const gates = buildGates(engineReady, cameraReady, tracking.summary);
  const allReady = gates.every((g) => g.ok);
  const activeHint = gates.find((g) => !g.ok)?.hint;

  // HUD phase mapping
  const hudPhase: ScannerPhase =
    phase === "capturing"
      ? "capturing"
      : phase === "enhancing" || phase === "analyzing" || phase === "reporting"
        ? "analyzing"
        : allReady && phase === "scanning"
          ? "locked"
          : "searching";

  // ── Frame capture (crops to eye region via tracking geometry) ─────────────
  const grabFrame = useCallback(async (): Promise<File | null> => {
    const video = camera.videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
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
      sx = Math.round(Math.max(0, cx - halfW) * vw);
      sy = Math.round(Math.max(0, cy - halfH) * vh);
      sw = Math.max(1, Math.round(Math.min(1, cx + halfW) * vw) - sx);
      sh = Math.max(1, Math.round(Math.min(1, cy + halfH) * vh) - sy);
    }
    const targetW = 768;
    const scale = targetW / sw;
    canvas.width = targetW;
    canvas.height = Math.round(sh * scale);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.92),
    );
    return blob ? new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" }) : null;
  }, [camera.videoRef, tracking.frameRef]);

  const runCapture = useCallback(async () => {
    setCountdown(null);
    setPhase("capturing");
    setProgress(0);
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
      setPhase("scanning");
      return;
    }
    setPhase("enhancing");
    await new Promise((r) => setTimeout(r, 500));
    try {
      setPhase("analyzing");
      const created = await createScan.mutateAsync({ file, module: "eye", workflow: "scanner" });
      const analyzed = await analyzeScan.mutateAsync(created.id);
      if (!analyzed.prediction) throw new Error("No prediction returned.");
      setScan(analyzed);
      setPrediction(analyzed.prediction);
      setPhase("reporting");
      const rep = await generateReport.mutateAsync(created.id);
      setReport(rep);
      setPhase("result");
    } catch (e) {
      toast.error("Analysis failed", e instanceof Error ? e.message : "Please try again.");
      setPhase("scanning");
    }
  }, [analyzeScan, createScan, generateReport, grabFrame]);

  // ── Auto-capture countdown when all checks pass ───────────────────────────
  useEffect(() => {
    if (phase !== "scanning") return;
    if (!allReady) {
      setCountdown(null);
      return;
    }
    setCountdown(AUTO_CAPTURE_FROM);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c <= 1) {
          clearInterval(iv);
          void runCapture();
          return null;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReady, phase]);

  const enableCamera = useCallback(async () => {
    setStarted(true);
    setPhase("scanning");
    await camera.start();
  }, [camera]);

  const rescan = useCallback(() => {
    setScan(null);
    setPrediction(null);
    setReport(null);
    setCountdown(null);
    setProgress(0);
    setPhase("scanning");
  }, []);

  // ── Result view: full clinical report ─────────────────────────────────────
  if (phase === "result" && scan && prediction && report) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Scan complete</h2>
            <p className="text-muted-foreground text-sm">Anterior-segment screening report</p>
          </div>
          <Button variant="secondary" onClick={rescan}>
            <RefreshCw className="size-4" /> New scan
          </Button>
        </div>
        <ClinicalReport scan={scan} prediction={prediction} report={report} />
      </div>
    );
  }

  const processing = ["capturing", "enhancing", "analyzing", "reporting"].includes(phase);

  return (
    <div className="grid gap-5 p-6 lg:grid-cols-[1fr_340px]">
      {/* Stage */}
      <div>
        <div className="border-border relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-xl">
          <div className="absolute inset-0" style={{ transform: "scaleX(-1)" }}>
            <video ref={camera.videoRef} playsInline muted className="h-full w-full object-cover" />
            {started && cameraReady && engineReady && (
              <ScannerOverlay frameRef={tracking.frameRef} phase={hudPhase} progress={progress} />
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_center,transparent_52%,rgba(0,0,0,0.6))]" />

          {/* status banner */}
          {started && cameraReady && !processing && (
            <div className="absolute inset-x-0 top-4 flex justify-center">
              <div className="glass-strong flex items-center gap-2 rounded-full px-4 py-1.5 text-sm">
                {allReady ? (
                  <>
                    <span className="bg-success size-2 animate-pulse rounded-full" />
                    <span className="font-medium">
                      {countdown !== null ? `Hold still — capturing in ${countdown}` : "Ready"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="bg-warning size-2 rounded-full" />
                    <span className="text-muted-foreground">{activeHint ?? "Preparing…"}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* processing overlay */}
          <AnimatePresence>
            {processing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-strong absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
              >
                <div className="border-primary/25 border-t-primary size-12 animate-spin rounded-full border-[3px]" />
                <p className="text-sm font-medium">
                  {PROCESSING.find((p) => p.id === phase)?.label ?? "Processing…"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <StageOverlay
            started={started}
            cameraStatus={camera.status}
            trackingStatus={tracking.status}
            cameraError={camera.error}
            onEnable={enableCamera}
          />
        </div>

        {/* controls */}
        {started && cameraReady && !processing && (
          <div className="mt-4 flex items-center gap-3">
            <Button variant="gradient" size="lg" disabled={!allReady} onClick={runCapture}>
              <Camera /> {allReady ? "Capture now" : "Complete the checks to capture"}
            </Button>
            <p className="text-muted-foreground text-xs">
              Auto-captures when all readiness checks pass.
            </p>
          </div>
        )}
        <canvas ref={captureCanvasRef} className="hidden" />
      </div>

      {/* Guided rail */}
      <div className="glass-strong rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold tracking-tight">
            {processing ? "Processing" : "Scan readiness"}
          </h3>
          <p className="text-muted-foreground text-xs">
            {processing
              ? "Analyzing the captured image"
              : "A guided medical-grade capture sequence"}
          </p>
        </div>

        {processing ? (
          <StageRail stages={processingStages(phase)} />
        ) : (
          <StageRail stages={readinessStages(gates)} />
        )}

        <div className="border-border/50 text-muted-foreground mt-5 border-t pt-4 text-[11px] leading-relaxed">
          <ShieldAlert className="text-primary mb-1 inline size-3.5" /> The webcam screens{" "}
          <span className="text-foreground">external-eye</span> signs (redness, conjunctivitis,
          visible cataract). For retinal conditions, use{" "}
          <a href="/dashboard/eye/upload" className="text-primary hover:underline">
            Fundus Upload
          </a>
          .
        </div>
      </div>
    </div>
  );
}

// ── Camera permission / loading / error overlay ─────────────────────────────
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
  const denied = cameraStatus === "denied";
  const unsupported = cameraStatus === "unsupported";
  const errored = cameraStatus === "error" || trackingStatus === "error";
  const loading =
    started &&
    (cameraStatus === "requesting" || (cameraStatus === "ready" && trackingStatus === "loading"));
  const show = !started || loading || denied || unsupported || errored;
  if (!show) return null;

  return (
    <div className="glass-strong absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
      {!started && (
        <>
          <span className="bg-primary/12 text-primary mb-4 inline-flex size-16 items-center justify-center rounded-2xl">
            <ScanFace className="size-8" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight">AI Eye Scanner</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            A guided external-eye scan. Video is processed{" "}
            <span className="text-foreground">entirely on your device</span> — nothing is uploaded
            until you capture.
          </p>
          <Button variant="gradient" size="lg" className="mt-6" onClick={onEnable}>
            <Camera /> Begin scan
          </Button>
        </>
      )}
      {loading && (
        <div className="flex flex-col items-center gap-3">
          <div className="border-primary/30 border-t-primary size-8 animate-spin rounded-full border-2" />
          <p className="text-muted-foreground text-sm">
            {cameraStatus === "requesting" ? "Requesting camera…" : "Initializing AI engine…"}
          </p>
        </div>
      )}
      {(denied || unsupported || errored) && (
        <div className="flex flex-col items-center">
          <span className="bg-danger/12 text-danger mb-3 inline-flex size-12 items-center justify-center rounded-full">
            <ShieldAlert className="size-6" />
          </span>
          <h3 className="text-base font-semibold">
            {denied
              ? "Camera permission denied"
              : unsupported
                ? "Camera not supported"
                : "Something went wrong"}
          </h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            {denied
              ? "Allow camera access in your browser's site settings, then try again."
              : unsupported
                ? "This browser does not expose a camera API."
                : (cameraError ?? "The scanner could not start.")}
          </p>
          {!unsupported && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onEnable}>
              <RefreshCw className="size-3.5" /> Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

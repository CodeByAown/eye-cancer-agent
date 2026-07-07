"use client";

import { useEffect, useRef } from "react";

import type { TrackingFrame } from "@/hooks/use-face-tracking";
import type { Point } from "@/lib/scanner/landmarks";

export type ScannerPhase = "searching" | "locked" | "aligning" | "capturing" | "analyzing" | "done";

const TEAL = "rgba(20, 200, 180, ALPHA)";
const teal = (a: number) => TEAL.replace("ALPHA", String(a));

interface Props {
  frameRef: React.RefObject<TrackingFrame>;
  phase: ScannerPhase;
  /** 0..1 capture progress (drives the sweep line). */
  progress?: number;
}

/**
 * Full-fps canvas HUD. Reads the latest tracking geometry from `frameRef` and
 * paints eye reticles, iris trackers, and the scan sweep. Drawn in normalized
 * space; the parent mirrors the whole stage (selfie view) via CSS.
 */
export function ScannerOverlay({ frameRef, phase, progress = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(phase);
  const progressRef = useRef(progress);
  phaseRef.current = phase;
  progressRef.current = progress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const draw = () => {
      t += 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);
      const px = (p: Point) => ({ x: p.x * W, y: p.y * H });

      const frame = frameRef.current;
      const g = frame?.geometry;
      const ph = phaseRef.current;

      if (!g) {
        drawSearching(ctx, W, H, t);
        raf = requestAnimationFrame(draw);
        return;
      }

      const locked = ph !== "searching";
      const color = locked ? teal(0.95) : teal(0.5);

      // Face framing brackets
      if (g.bbox) {
        const b = g.bbox;
        drawCornerBrackets(
          ctx,
          b.x * W - 12,
          b.y * H - 12,
          b.w * W + 24,
          b.h * H + 24,
          teal(0.25),
          22,
        );
      }

      // Eye reticles + iris trackers
      const eyeSize = (g.bbox?.w ?? 0.3) * W * 0.17;
      for (const eye of [g.left, g.right]) {
        if (!eye) continue;
        drawEyeReticle(ctx, px(eye.center), eyeSize, color, t, locked);
        drawIris(ctx, px(eye.iris), teal(0.95), t);
      }

      // Capture sweep line
      if (ph === "capturing" && g.bbox) {
        const y = (g.bbox.y + g.bbox.h * progressRef.current) * H;
        drawSweep(ctx, g.bbox.x * W, g.bbox.w * W, y);
      }

      // Analyzing shimmer ring around face center
      if (ph === "analyzing" && g.bbox) {
        const cx = (g.bbox.x + g.bbox.w / 2) * W;
        const cy = (g.bbox.y + g.bbox.h / 2) * H;
        drawSpinner(ctx, cx, cy, Math.max(g.bbox.w * W, g.bbox.h * H) * 0.62, t);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [frameRef]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

// ── drawing helpers ─────────────────────────────────────────────────────────

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  len: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * len);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * len, cy);
    ctx.stroke();
  }
}

function drawEyeReticle(
  ctx: CanvasRenderingContext2D,
  c: Point,
  size: number,
  color: string,
  t: number,
  locked: boolean,
) {
  const half = size;
  const len = size * 0.5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = locked ? 10 : 4;
  drawCornerBrackets(ctx, c.x - half, c.y - half, half * 2, half * 2, color, len);
  // rotating tick ring when locked
  if (locked) {
    const r = half * 1.25;
    const a = (t / 40) % (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, a, a + Math.PI * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, a + Math.PI, a + Math.PI + Math.PI * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawIris(ctx: CanvasRenderingContext2D, c: Point, color: string, t: number) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  const pulse = 6 + Math.sin(t / 12) * 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(c.x, c.y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSweep(ctx: CanvasRenderingContext2D, x: number, w: number, y: number) {
  const grad = ctx.createLinearGradient(x, y - 20, x, y + 20);
  grad.addColorStop(0, teal(0));
  grad.addColorStop(0.5, teal(0.85));
  grad.addColorStop(1, teal(0));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y - 20, w, 40);
  ctx.strokeStyle = teal(1);
  ctx.lineWidth = 2;
  ctx.shadowColor = teal(1);
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawSearching(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.22;
  const a = (t / 30) % (Math.PI * 2);
  ctx.strokeStyle = teal(0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a, a + Math.PI * 1.4);
  ctx.stroke();
  ctx.strokeStyle = teal(0.15);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpinner(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) {
  const a = (t / 20) % (Math.PI * 2);
  ctx.strokeStyle = teal(0.9);
  ctx.lineWidth = 3;
  ctx.shadowColor = teal(0.9);
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a, a + Math.PI * 0.5);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

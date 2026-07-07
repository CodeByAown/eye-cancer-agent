"use client";

import { motion } from "framer-motion";

import type { TrackingSummary } from "@/hooks/use-face-tracking";
import { cn } from "@/lib/utils";

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-success"
      : tone === "warn"
        ? "text-warning"
        : tone === "bad"
          ? "text-danger"
          : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn("font-mono text-xs font-medium", toneClass)}>{value}</span>
    </div>
  );
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <motion.div
        className="h-full rounded-full"
        style={{ background: tone }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

export function TelemetryPanel({
  summary,
  statusLog,
  className,
}: {
  summary: TrackingSummary;
  statusLog: string[];
  className?: string;
}) {
  const lightTone =
    summary.lighting === "good" ? "good" : summary.lighting === "ok" ? "warn" : "bad";

  return (
    <div className={cn("glass-strong flex flex-col gap-4 rounded-lg p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider">Telemetry</span>
        <span className="text-muted-foreground font-mono text-[10px]">{summary.fps} fps</span>
      </div>

      <div className="space-y-2">
        <Metric
          label="Face"
          value={summary.faceDetected ? "LOCKED" : "SEARCHING"}
          tone={summary.faceDetected ? "good" : "warn"}
        />
        <Metric label="Lighting" value={summary.lighting.toUpperCase()} tone={lightTone} />
      </div>

      <div className="space-y-1.5">
        <Metric
          label="Stability"
          value={`${summary.stability}%`}
          tone={summary.stability > 70 ? "good" : summary.stability > 40 ? "warn" : "bad"}
        />
        <Bar value={summary.stability} tone="hsl(var(--primary))" />
      </div>

      <div className="space-y-1.5">
        <Metric
          label="Alignment"
          value={`${summary.alignment}%`}
          tone={summary.alignment > 70 ? "good" : summary.alignment > 40 ? "warn" : "bad"}
        />
        <Bar value={summary.alignment} tone="hsl(var(--accent))" />
      </div>

      <div className="border-border/50 mt-1 border-t pt-3">
        <p className="text-muted-foreground/70 mb-2 text-[10px] uppercase tracking-wider">
          System log
        </p>
        <div className="h-28 space-y-1 overflow-hidden font-mono text-[10px] leading-relaxed">
          {statusLog.slice(-6).map((line, i, arr) => (
            <div
              key={`${line}-${i}`}
              className={cn(
                "flex gap-1.5",
                i === arr.length - 1 ? "text-primary" : "text-muted-foreground/60",
              )}
            >
              <span className="opacity-50">›</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

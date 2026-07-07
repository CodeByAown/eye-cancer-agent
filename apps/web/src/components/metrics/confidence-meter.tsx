"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/** Horizontal confidence bar with animated fill + numeric readout (0–1 or 0–100). */
export function ConfidenceMeter({
  value,
  label = "Confidence",
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = value <= 1 ? value * 100 : value;
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = clamped >= 75 ? "success" : clamped >= 50 ? "warning" : "danger";
  const barColor =
    tone === "success"
      ? "hsl(var(--success))"
      : tone === "warning"
        ? "hsl(var(--warning))"
        : "hsl(var(--danger))";

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{clamped.toFixed(1)}%</span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor, boxShadow: `0 0 8px ${barColor}` }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

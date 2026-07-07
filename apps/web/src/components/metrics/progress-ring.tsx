"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Animated circular progress ring. Used for scan progress and confidence.
 * `value` is 0–100. Respects reduced-motion via CSS (animation disabled globally).
 */
export function ProgressRing({
  value,
  size = 120,
  stroke = 8,
  label,
  sublabel,
  tone = "primary",
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: "primary" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (clamped / 100) * circumference;
  const color = `hsl(var(--${tone}))`;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label !== undefined ? (
          <span className="text-2xl font-semibold tabular-nums">{label}</span>
        ) : (
          <span className="text-2xl font-semibold tabular-nums">{Math.round(clamped)}%</span>
        )}
        {sublabel && <span className="text-muted-foreground text-xs">{sublabel}</span>}
      </div>
    </div>
  );
}

import type { Severity } from "@/lib/api/types";

export type Tone = "success" | "info" | "warning" | "danger";

export const severityTone: Record<Severity, Tone> = {
  none: "success",
  mild: "info",
  moderate: "warning",
  severe: "danger",
};

/** Confidence (0..1 or 0..100) → semantic text color class. */
export function confidenceToneClass(value: number): string {
  const pct = value <= 1 ? value * 100 : value;
  return pct >= 85 ? "text-success" : pct >= 70 ? "text-warning" : "text-danger";
}

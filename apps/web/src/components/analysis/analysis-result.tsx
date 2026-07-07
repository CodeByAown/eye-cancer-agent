"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { ConfidenceMeter } from "@/components/metrics/confidence-meter";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Prediction, Severity } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const severityTone: Record<Severity, "success" | "info" | "warning" | "danger"> = {
  none: "success",
  mild: "info",
  moderate: "warning",
  severe: "danger",
};

/** Shared result panel rendered from a Prediction — used by every analysis
 * workflow (scanner, skin, brain, fundus) for a consistent report surface. */
export function AnalysisResult({ prediction }: { prediction: Prediction }) {
  const confidence = Number(prediction.top_confidence) * 100;
  const ex = prediction.explanation ?? {};
  const severity = (prediction.severity ?? "none") as Severity;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-lg p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Analysis result</span>
        </div>
        <StatusBadge tone={severityTone[severity]} label={severity} />
      </div>

      <p className="text-lg font-semibold capitalize">{prediction.top_label.replace(/_/g, " ")}</p>
      <p className="text-muted-foreground text-xs">
        {prediction.model_name} · v{prediction.model_version}
        {ex.malignant !== undefined && (
          <span className={cn("ml-2 font-medium", ex.malignant ? "text-danger" : "text-success")}>
            {ex.malignant ? "malignant pattern" : "benign pattern"}
          </span>
        )}
      </p>

      <div className="mt-4">
        <ConfidenceMeter value={confidence} />
      </div>

      {ex.rationale && (
        <div className="bg-muted/40 mt-4 rounded-md p-3">
          <p className="text-muted-foreground/70 mb-1 text-[10px] font-medium uppercase tracking-wider">
            Why
          </p>
          <p className="text-xs leading-relaxed">{ex.rationale}</p>
        </div>
      )}

      {ex.observations && ex.observations.length > 0 && (
        <div className="mt-3">
          <p className="text-muted-foreground/70 mb-1.5 text-[10px] font-medium uppercase tracking-wider">
            Observations
          </p>
          <ul className="space-y-1">
            {ex.observations.map((o) => (
              <li key={o} className="text-muted-foreground flex gap-1.5 text-xs">
                <span className="bg-primary mt-1.5 size-1 shrink-0 rounded-full" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {prediction.classes?.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-muted-foreground/70 text-[10px] font-medium uppercase tracking-wider">
            Class distribution
          </p>
          {prediction.classes.slice(0, 5).map((c) => (
            <div key={c.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">
                  {c.label.replace(/_/g, " ")}
                </span>
                <span className="font-mono tabular-nums">{(c.prob * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary/70 h-full rounded-full"
                  style={{ width: `${Math.min(100, c.prob * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-muted-foreground/80 border-border/50 mt-4 border-t pt-3 text-[11px] leading-relaxed">
        AI decision-support for educational screening only — not a diagnosis. Confirm any finding
        with a qualified clinician.
      </p>
    </motion.div>
  );
}

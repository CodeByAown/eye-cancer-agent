"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type StageStatus = "pending" | "active" | "pass" | "warn" | "done";

export interface Stage {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  status: StageStatus;
}

/**
 * Vertical guided-stage rail — the scanner's "what is happening now" column.
 * Communicates every step of the medical-scan workflow with live status.
 */
export function StageRail({ stages, className }: { stages: Stage[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-1", className)}>
      {stages.map((s, i) => {
        const active = s.status === "active";
        const pass = s.status === "pass" || s.status === "done";
        const warn = s.status === "warn";
        return (
          <li key={s.id} className="relative flex items-start gap-3">
            {/* connector */}
            {i < stages.length - 1 && (
              <span
                className={cn(
                  "absolute left-[13px] top-7 h-[calc(100%-12px)] w-px",
                  pass ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                pass && "border-primary bg-primary/15 text-primary",
                active && "border-primary bg-primary/10 text-primary",
                warn && "border-warning bg-warning/10 text-warning",
                s.status === "pending" && "border-border bg-muted text-muted-foreground/50",
              )}
            >
              {pass ? (
                <Check className="size-3.5" />
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : warn ? (
                <AlertTriangle className="size-3.5" />
              ) : (
                <s.icon className="size-3.5" />
              )}
              {active && (
                <motion.span
                  className="border-primary absolute inset-0 rounded-full border"
                  animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-sm font-medium leading-tight transition-colors",
                  active || pass
                    ? "text-foreground"
                    : warn
                      ? "text-warning"
                      : "text-muted-foreground/60",
                )}
              >
                {s.label}
              </p>
              {(active || warn) && s.hint && (
                <p className="text-muted-foreground mt-0.5 text-xs">{s.hint}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

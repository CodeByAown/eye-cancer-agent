"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number; // percentage change; positive = up
  hint?: string;
  index?: number; // for stagger
}

export function MetricCard({ label, value, icon: Icon, delta, hint, index = 0 }: MetricCardProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Card className="hover:border-primary/40 hover:shadow-glow group relative overflow-hidden p-5">
        <div className="bg-primary/5 pointer-events-none absolute -right-6 -top-6 size-24 rounded-full blur-2xl transition-opacity group-hover:opacity-80" />
        <div className="flex items-start justify-between">
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className="bg-primary/12 text-primary inline-flex size-9 items-center justify-center rounded-md">
            <Icon className="size-4" />
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{value}</span>
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                up ? "text-success" : "text-danger",
              )}
            >
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </Card>
    </motion.div>
  );
}

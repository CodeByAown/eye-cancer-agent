"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  title,
  subtitle,
  phase,
  icon: Icon,
  points,
}: {
  title: string;
  subtitle: string;
  phase: string;
  icon: LucideIcon;
  points: string[];
}) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} />
      <div className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-strong w-full max-w-lg rounded-lg p-8 text-center"
        >
          <div className="bg-primary/12 text-primary mx-auto mb-5 inline-flex size-14 items-center justify-center rounded-xl">
            <Icon className="size-7" />
          </div>
          <Badge variant="accent" className="mb-3">
            {phase}
          </Badge>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            {points.map((p) => (
              <li key={p} className="text-muted-foreground flex items-start gap-2 text-sm">
                <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                {p}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </>
  );
}

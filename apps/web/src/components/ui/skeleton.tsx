import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Shimmer skeleton for loading states (docs/12 — never spinners for layout). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-muted/60 relative overflow-hidden rounded-md",
        "after:animate-shimmer after:absolute after:inset-0 after:-translate-x-full",
        "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

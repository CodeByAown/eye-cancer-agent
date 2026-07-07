import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Frosted-glass surface. `strong` for content panels, default for overlays. */
export const GlassCard = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { strong?: boolean }
>(({ className, strong, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      strong ? "glass-strong" : "glass",
      "rounded-lg p-6 shadow-lg transition-colors",
      className,
    )}
    {...props}
  />
));
GlassCard.displayName = "GlassCard";

import { cn } from "@/lib/utils";
import { config } from "@/lib/config";

/** Wordmark + mark. The mark is an abstract iris/scan ring. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          opacity="0.4"
        />
        <circle cx="12" cy="12" r="6" stroke="hsl(var(--primary))" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2.2" fill="hsl(var(--accent))" />
      </svg>
      <span className="text-[15px]">{config.appName}</span>
    </span>
  );
}

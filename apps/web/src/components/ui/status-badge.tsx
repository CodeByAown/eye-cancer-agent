import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneMap: Record<Tone, { dot: string; text: string; bg: string }> = {
  success: { dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  warning: { dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
  danger: { dot: "bg-danger", text: "text-danger", bg: "bg-danger/10" },
  info: { dot: "bg-info", text: "text-info", bg: "bg-info/10" },
  neutral: { dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted" },
};

export function StatusBadge({
  tone = "neutral",
  label,
  pulse = false,
  className,
}: {
  tone?: Tone;
  label: string;
  pulse?: boolean;
  className?: string;
}) {
  const t = toneMap[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        t.bg,
        t.text,
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              t.dot,
            )}
          />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", t.dot)} />
      </span>
      {label}
    </span>
  );
}

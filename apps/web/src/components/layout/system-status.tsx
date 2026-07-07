"use client";

import { useReadiness } from "@/lib/api/hooks";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Live backend readiness in the topbar. Degrades gracefully if the API is down. */
export function SystemStatus({ className }: { className?: string }) {
  const { data, isError, isLoading } = useReadiness();

  const tone = isLoading ? "info" : isError || data?.status !== "ok" ? "warning" : "success";
  const label = isLoading
    ? "Checking…"
    : isError
      ? "API unreachable"
      : data?.status === "ok"
        ? "All systems operational"
        : "Degraded";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          <StatusBadge tone={tone} label={label} pulse={tone === "success"} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {data?.checks ? (
          <ul className="space-y-1">
            {Object.entries(data.checks).map(([k, ok]) => (
              <li key={k} className="flex items-center justify-between gap-4">
                <span className="capitalize">{k}</span>
                <span className={ok ? "text-success" : "text-danger"}>{ok ? "ok" : "down"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span>Backend health unavailable</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

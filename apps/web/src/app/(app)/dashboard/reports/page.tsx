"use client";

import { FileText, ScanEye } from "lucide-react";
import { useState } from "react";

import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { useScans } from "@/lib/api/hooks";
import type { Module } from "@/lib/api/types";

const filters: { label: string; value: Module | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Eye", value: "eye" },
  { label: "Cancer", value: "cancer" },
];

export default function ReportsPage() {
  const [module, setModule] = useState<Module | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useScans(module, page, 20);

  return (
    <>
      <Topbar title="Reports & History" subtitle="Every analysis you've run" />
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          {filters.map((f) => (
            <button
              key={f.label}
              onClick={() => {
                setModule(f.value);
                setPage(1);
              }}
              className={
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                (module === f.value
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted")
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : isError ? (
              <ErrorState description="Could not load your reports." onRetry={() => refetch()} />
            ) : data && data.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                      <th className="px-5 py-3 font-medium">Scan ID</th>
                      <th className="px-3 py-3 font-medium">Module</th>
                      <th className="px-3 py-3 font-medium">Workflow</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((s) => (
                      <tr
                        key={s.id}
                        className="border-border/40 hover:bg-muted/40 border-b transition-colors last:border-0"
                      >
                        <td className="text-muted-foreground px-5 py-3 font-mono text-xs">
                          {s.id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-3 capitalize">{s.module}</td>
                        <td className="text-muted-foreground px-3 py-3 capitalize">{s.workflow}</td>
                        <td className="px-3 py-3">
                          <StatusBadge
                            tone={
                              s.status === "done"
                                ? "success"
                                : s.status === "failed" || s.status === "rejected"
                                  ? "danger"
                                  : "info"
                            }
                            label={s.status}
                          />
                        </td>
                        <td className="text-muted-foreground px-5 py-3 text-right text-xs">
                          {new Date(s.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No reports yet"
                description="Analyses you run will appear here with their status and results."
                action={
                  <Button asChild variant="secondary" size="sm">
                    <a href="/dashboard/eye/scan">
                      <ScanEye className="size-3.5" /> Start a scan
                    </a>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {data && data.total > 20 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Page {data.page} · {data.total} total
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * 20 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

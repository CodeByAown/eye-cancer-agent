"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  FileText,
  Gauge,
  ScanEye,
  ShieldAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { ActivityChart } from "@/components/charts/activity-chart";
import { ConfidenceTrendChart } from "@/components/charts/confidence-trend-chart";
import { Topbar } from "@/components/layout/topbar";
import { ConfidenceMeter } from "@/components/metrics/confidence-meter";
import { MetricCard } from "@/components/metrics/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDashboardStats, useScans } from "@/lib/api/hooks";
import { models } from "@/lib/mock";

const quickActions = [
  { label: "Start Eye Scan", href: "/dashboard/eye/scan", icon: ScanEye },
  { label: "Upload Fundus", href: "/dashboard/eye/upload", icon: Upload },
  { label: "View Reports", href: "/dashboard/reports", icon: FileText },
];

const moduleLabel: Record<string, string> = {
  eye: "Eye",
  cancer: "Cancer",
};

export default function DashboardPage() {
  const stats = useDashboardStats();
  const recent = useScans(undefined, 1, 6);

  const avgConf =
    stats.data?.avg_confidence != null ? `${(stats.data.avg_confidence * 100).toFixed(1)}%` : "—";

  return (
    <>
      <Topbar title="Dashboard" subtitle="Platform overview & recent activity" />

      <div className="space-y-6 p-6">
        {/* Metrics — real data from /stats/dashboard */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))
          ) : (
            <>
              <MetricCard
                label="Total scans"
                value={String(stats.data?.total_scans ?? 0)}
                icon={Activity}
                hint="All time"
                index={0}
              />
              <MetricCard
                label="Avg. confidence"
                value={avgConf}
                icon={Gauge}
                hint="Across analyses"
                index={1}
              />
              <MetricCard
                label="Flagged findings"
                value={String(stats.data?.flagged ?? 0)}
                icon={ShieldAlert}
                hint="Moderate/severe"
                index={2}
              />
              <MetricCard
                label="Reports"
                value={String(stats.data?.reports ?? 0)}
                icon={FileText}
                hint="Generated"
                index={3}
              />
            </>
          )}
        </div>

        {/* Charts row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className="h-full">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Scan activity</CardTitle>
                  <p className="text-muted-foreground text-xs">Illustrative 14-day trend</p>
                </div>
                <StatusBadge tone="info" label="Sample" />
              </CardHeader>
              <CardContent>
                <ActivityChart />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>AI confidence trend</CardTitle>
                <p className="text-muted-foreground text-xs">Illustrative · 7-day</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between">
                <ConfidenceTrendChart />
                <div className="mt-4 space-y-3">
                  {stats.data?.avg_confidence != null && (
                    <ConfidenceMeter value={stats.data.avg_confidence * 100} label="Your average" />
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {quickActions.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        className="border-border/60 hover:border-primary/40 hover:bg-primary/5 group flex flex-col items-center gap-1.5 rounded-md border p-3 text-center transition-colors"
                      >
                        <a.icon className="text-primary size-4" />
                        <span className="text-[11px] font-medium leading-tight">{a.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Tables row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="h-full">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent analyses</CardTitle>
                <Link
                  href="/dashboard/reports"
                  className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
                >
                  View all <ArrowUpRight className="size-3" />
                </Link>
              </CardHeader>
              <CardContent className="px-0">
                {recent.isLoading ? (
                  <div className="space-y-2 px-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : recent.data && recent.data.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-border/60 border-y text-left text-xs">
                          <th className="px-5 py-2 font-medium">ID</th>
                          <th className="px-3 py-2 font-medium">Module</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-5 py-2 text-right font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.data.items.map((s) => (
                          <tr
                            key={s.id}
                            className="border-border/40 hover:bg-muted/40 border-b transition-colors last:border-0"
                          >
                            <td className="text-muted-foreground px-5 py-3 font-mono text-xs">
                              {s.id.slice(0, 8)}
                            </td>
                            <td className="px-3 py-3">
                              {moduleLabel[s.module] ?? s.module}
                              <span className="text-muted-foreground"> · {s.workflow}</span>
                            </td>
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
                    icon={ScanEye}
                    title="No analyses yet"
                    description="Run an eye scan or upload an image to see results here."
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* AI models */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>AI models</CardTitle>
                <p className="text-muted-foreground text-xs">Registered specialist models</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {models.map((m) => (
                  <div
                    key={m.name}
                    className="border-border/50 flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs font-medium">{m.name}</span>
                        {m.license === "Research" && (
                          <span className="bg-accent/15 text-accent rounded px-1.5 py-0.5 text-[10px] font-medium">
                            research
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {m.task} · v{m.version}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge tone="success" label={m.status} />
                      <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
                        ~{m.latencyMs}ms
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  );
}

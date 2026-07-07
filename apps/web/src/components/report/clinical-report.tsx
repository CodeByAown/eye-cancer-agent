"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  HeartPulse,
  Info,
  Pill,
  Printer,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";

import { ProgressRing } from "@/components/metrics/progress-ring";
import { config } from "@/lib/config";
import type {
  ClinicalReport as ReportT,
  Prediction,
  QualityCheck,
  Scan,
  Severity,
} from "@/lib/api/types";
import { severityTone } from "@/lib/severity";
import { cn } from "@/lib/utils";

const urgency: Record<string, { tone: string; label: string; ring: string }> = {
  routine: { tone: "text-success bg-success/10", label: "Routine", ring: "success" },
  soon: { tone: "text-warning bg-warning/10", label: "See a clinician soon", ring: "warning" },
  urgent: { tone: "text-danger bg-danger/10", label: "Urgent — seek care", ring: "danger" },
};

const severityRing: Record<string, "success" | "warning" | "danger" | "accent"> = {
  none: "success",
  mild: "accent",
  moderate: "warning",
  severe: "danger",
};

function Section({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-border/60 border-t py-5", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="text-primary size-4" />
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Bullets({ items, marker = "dot" }: { items: string[]; marker?: "dot" | "check" | "num" }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={it} className="text-muted-foreground flex gap-2 text-sm leading-relaxed">
          {marker === "check" ? (
            <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
          ) : marker === "num" ? (
            <span className="text-primary bg-primary/10 mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
              {i + 1}
            </span>
          ) : (
            <span className="bg-primary/60 mt-2 size-1 shrink-0 rounded-full" />
          )}
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function ClinicalReport({
  scan,
  prediction,
  report,
}: {
  scan: Scan;
  prediction: Prediction;
  report: ReportT;
}) {
  const n = report.narrative;
  const confidence = Number(prediction.top_confidence) * 100;
  const severity = (prediction.severity ?? "none") as Severity;
  const u = urgency[n.urgency] ?? urgency.routine;
  const checks = (scan.validation?.checks as QualityCheck[] | undefined) ?? [];
  const qualityScore = (scan.validation?.score as number | undefined) ?? null;
  const imageUrl = scan.source_uri ? `${config.apiUrl}/files/${scan.source_uri}` : null;
  const ex = prediction.explanation ?? {};

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      id="clinical-report"
      className="bg-surface/70 border-border overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl"
    >
      {/* Letterhead */}
      <header className="from-primary/12 to-accent/10 border-border/60 flex items-start justify-between border-b bg-gradient-to-r px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="bg-primary/15 text-primary flex size-11 items-center justify-center rounded-xl">
            <Stethoscope className="size-6" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">AI Screening Report</h2>
            <p className="text-muted-foreground text-xs">
              {report.report_number} · {new Date(report.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", u.tone)}>{u.label}</span>
      </header>

      <div className="px-6">
        {/* Findings hero */}
        <div className="grid gap-6 py-6 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Primary finding
            </p>
            <h1 className="mt-1 text-2xl font-semibold capitalize tracking-tight">
              {prediction.top_label.replace(/_/g, " ")}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                  severityTone[severity] === "success" && "bg-success/12 text-success",
                  severityTone[severity] === "info" && "bg-info/12 text-info",
                  severityTone[severity] === "warning" && "bg-warning/12 text-warning",
                  severityTone[severity] === "danger" && "bg-danger/12 text-danger",
                )}
              >
                Severity: {severity}
              </span>
              {ex.malignant !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    ex.malignant ? "bg-danger/12 text-danger" : "bg-success/12 text-success",
                  )}
                >
                  {ex.malignant ? "Malignant pattern" : "Benign pattern"}
                </span>
              )}
              <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-1 font-mono text-[11px]">
                {prediction.model_name}
              </span>
            </div>
            {n.summary && <p className="mt-4 text-sm leading-relaxed">{n.summary}</p>}
          </div>

          <div className="flex items-center gap-5">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Analyzed scan"
                className="border-border size-28 rounded-xl border object-cover"
              />
            )}
            <ProgressRing
              value={confidence}
              size={112}
              tone={severityRing[severity]}
              sublabel="confidence"
            />
          </div>
        </div>

        {/* Image quality */}
        {checks.length > 0 && (
          <Section icon={Activity} title="Image quality assessment">
            <div className="flex flex-wrap items-center gap-2">
              {qualityScore != null && (
                <span className="bg-primary/10 text-primary rounded-md px-2 py-1 text-xs font-semibold">
                  Score {qualityScore}/100
                </span>
              )}
              {checks.map((c) => (
                <span
                  key={c.key}
                  title={c.guidance || `${c.label}: ok`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                    c.passed ? "bg-success/10 text-success" : "bg-warning/12 text-warning",
                  )}
                >
                  {c.passed ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <AlertTriangle className="size-3.5" />
                  )}
                  {c.label}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Class distribution */}
        {prediction.classes?.length > 0 && (
          <Section icon={Eye} title="Model class distribution">
            <div className="space-y-2">
              {prediction.classes.slice(0, 5).map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">
                      {c.label.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono tabular-nums">{(c.prob * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="from-primary to-accent h-full rounded-full bg-gradient-to-r"
                      style={{ width: `${Math.min(100, c.prob * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Explanation */}
        {n.explanation && (
          <Section icon={Info} title="Clinical explanation">
            <p className="text-muted-foreground text-sm leading-relaxed">{n.explanation}</p>
          </Section>
        )}

        {/* Causes + risk factors */}
        {(n.causes?.length > 0 || n.risk_factors?.length > 0) && (
          <Section icon={FileText} title="Possible causes & risk factors">
            <div className="grid gap-6 sm:grid-cols-2">
              {n.causes?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium">Common causes</p>
                  <Bullets items={n.causes} />
                </div>
              )}
              {n.risk_factors?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium">Risk factors</p>
                  <Bullets items={n.risk_factors} />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Recommendations */}
        {n.recommendations?.length > 0 && (
          <Section icon={ClipboardList} title="Recommendations">
            <Bullets items={n.recommendations} marker="num" />
          </Section>
        )}

        {/* Treatment info (educational) */}
        {n.treatment_info && (
          <Section icon={Pill} title="General treatment information">
            <div className="border-info/30 bg-info/5 rounded-lg border p-4">
              <p className="text-info mb-1 text-[10px] font-semibold uppercase tracking-wider">
                Educational only — not a prescription
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">{n.treatment_info}</p>
            </div>
          </Section>
        )}

        {/* Lifestyle */}
        {n.lifestyle?.length > 0 && (
          <Section icon={HeartPulse} title="Lifestyle suggestions">
            <Bullets items={n.lifestyle} marker="check" />
          </Section>
        )}

        {/* Follow-up + urgency */}
        {(n.follow_up || n.when_to_seek_care) && (
          <Section icon={CalendarClock} title="Follow-up & when to seek care">
            {n.follow_up && (
              <p className="text-muted-foreground mb-3 text-sm leading-relaxed">{n.follow_up}</p>
            )}
            {n.when_to_seek_care && (
              <div className={cn("flex gap-2 rounded-lg p-3 text-sm", u.tone)}>
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{n.when_to_seek_care}</span>
              </div>
            )}
          </Section>
        )}

        {/* Disclaimer */}
        <Section icon={ShieldAlert} title="Important medical disclaimer" className="pb-6">
          <p className="text-muted-foreground/80 text-xs leading-relaxed">{n.disclaimer}</p>
          <p className="text-muted-foreground/50 mt-2 text-[10px]">
            Report generated by {report.llm_model ?? "AI"} · specialist inference by{" "}
            {prediction.model_name}. For {config.appName}.
          </p>
        </Section>
      </div>

      {/* Actions (hidden on print) */}
      <div className="border-border/60 bg-muted/20 flex items-center justify-end gap-2 border-t px-6 py-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <Printer className="size-3.5" /> Print / Export PDF
        </button>
      </div>
    </motion.article>
  );
}

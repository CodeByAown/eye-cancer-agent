"use client";

import { FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { ClinicalReport } from "@/components/report/clinical-report";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { toast } from "@/components/ui/toast";
import { UploadZone } from "@/components/ui/upload-zone";
import { useAnalyzeScan, useCreateScan, useGenerateReport } from "@/lib/api/hooks";
import type {
  ClinicalReport as ReportT,
  Module,
  Prediction,
  Scan,
  Workflow,
} from "@/lib/api/types";

type Phase = "idle" | "uploading" | "analyzing" | "reporting" | "report" | "error";

export interface UploadAnalysisProps {
  module: Module;
  workflow: Workflow;
  modality: string;
  scopeNote: string;
  acceptHint?: string;
}

const stageCopy: Record<Exclude<Phase, "idle" | "report" | "error">, string> = {
  uploading: "Uploading & validating image quality…",
  analyzing: "Specialist model analyzing…",
  reporting: "Generating your clinical report…",
};

export function UploadAnalysis({
  module,
  workflow,
  modality,
  scopeNote,
  acceptHint,
}: UploadAnalysisProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [scan, setScan] = useState<Scan | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [report, setReport] = useState<ReportT | null>(null);

  const createScan = useCreateScan();
  const analyzeScan = useAnalyzeScan();
  const generateReport = useGenerateReport();

  const run = async (file: File) => {
    setPhase("uploading");
    setScan(null);
    setPrediction(null);
    setReport(null);
    try {
      const created = await createScan.mutateAsync({ file, module, workflow, modality });
      setPhase("analyzing");
      const analyzed = await analyzeScan.mutateAsync(created.id);

      if (analyzed.status === "rejected") {
        const reasons = analyzed.validation?.reasons;
        const reason =
          Array.isArray(reasons) && reasons.length > 0
            ? String(reasons[0])
            : "Please upload a clearer image.";
        toast.warning("Image quality too low", reason);
        setPhase("idle");
        return;
      }
      if (!analyzed.prediction) throw new Error("No prediction returned.");

      setScan(analyzed);
      setPrediction(analyzed.prediction);

      setPhase("reporting");
      const rep = await generateReport.mutateAsync(created.id);
      setReport(rep);
      setPhase("report");
    } catch (e) {
      toast.error("Analysis failed", e instanceof Error ? e.message : "Please try again.");
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("idle");
    setScan(null);
    setPrediction(null);
    setReport(null);
  };

  // Full report view
  if (phase === "report" && scan && prediction && report) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <p className="text-muted-foreground text-sm">Analysis complete.</p>
          <Button variant="secondary" size="sm" onClick={reset}>
            <RefreshCw className="size-3.5" /> Analyze another
          </Button>
        </div>
        <ClinicalReport scan={scan} prediction={prediction} report={report} />
      </div>
    );
  }

  // Processing view — staged, guided
  if (phase === "uploading" || phase === "analyzing" || phase === "reporting") {
    return (
      <GlassCard strong className="flex min-h-[360px] flex-col items-center justify-center gap-5">
        <div className="relative">
          <div className="border-primary/20 border-t-primary size-12 animate-spin rounded-full border-[3px]" />
          <FileText className="text-primary absolute inset-0 m-auto size-5" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{stageCopy[phase]}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {phase === "reporting"
              ? "Writing an educational, clinician-style summary"
              : "This typically takes a few seconds"}
          </p>
        </div>
        <ol className="flex items-center gap-2 text-[11px]">
          {(["uploading", "analyzing", "reporting"] as const).map((s, i) => {
            const order = { uploading: 0, analyzing: 1, reporting: 2 };
            const active = order[phase as keyof typeof order] >= i;
            return (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {i + 1}
                </span>
                {i < 2 && <span className="bg-border h-px w-6" />}
              </li>
            );
          })}
        </ol>
      </GlassCard>
    );
  }

  // Idle / upload
  return (
    <div className="mx-auto max-w-2xl">
      <UploadZone onFile={run} hint={acceptHint} />
      <div className="text-muted-foreground mt-3 flex items-start gap-2 text-xs">
        <ShieldCheck className="text-primary mt-0.5 size-3.5 shrink-0" />
        <span>{scopeNote}</span>
      </div>
    </div>
  );
}

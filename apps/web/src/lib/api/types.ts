/**
 * API response types. Hand-mirrored from the FastAPI Pydantic schemas; keep in
 * sync with `apps/api/app/schemas`. (A future step generates these from the
 * OpenAPI spec at build time.)
 */

export interface HealthStatus {
  status: string;
  version: string;
  environment: string;
}

export interface ReadinessStatus {
  status: "ok" | "degraded";
  checks: Record<string, boolean>;
}

export type Role = "admin" | "org_admin" | "clinician" | "viewer";

export interface UserPublic {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  organization_id: string | null;
}

export type Module = "eye" | "cancer";
export type Workflow = "scanner" | "upload";
export type ScanStatus = "queued" | "processing" | "done" | "failed" | "rejected";
export type Severity = "none" | "mild" | "moderate" | "severe";

export interface ClassScore {
  label: string;
  prob: number;
}

export interface PredictionExplanation {
  observations?: string[];
  rationale?: string;
  recommendations?: string[];
  inconclusive?: boolean;
  scope?: string;
  // Oncology fields
  malignant?: boolean;
  raw_label?: string;
  supports_gradcam?: boolean;
  modality?: string;
}

export interface Prediction {
  id: string;
  model_name: string;
  model_version: string;
  top_label: string;
  top_confidence: number;
  severity: Severity | null;
  classes: ClassScore[];
  explanation: PredictionExplanation | null;
  heatmap_uri: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface Scan {
  id: string;
  module: Module;
  workflow: Workflow;
  modality: string | null;
  source_uri: string;
  status: ScanStatus;
  validation: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  prediction?: Prediction | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface DashboardStats {
  total_scans: number;
  analyzed: number;
  flagged: number;
  reports: number;
  avg_confidence: number | null;
}

export interface ReportNarrative {
  summary: string;
  explanation: string;
  causes: string[];
  risk_factors: string[];
  recommendations: string[];
  treatment_info: string;
  lifestyle: string[];
  follow_up: string;
  urgency: "routine" | "soon" | "urgent";
  when_to_seek_care: string;
  disclaimer: string;
  generated_by: string;
}

export interface ClinicalReport {
  id: string;
  scan_id: string;
  prediction_id: string;
  report_number: string | null;
  narrative: ReportNarrative;
  llm_model: string | null;
  created_at: string;
}

export interface QualityCheck {
  key: string;
  label: string;
  passed: boolean;
  value: number;
  guidance: string;
}

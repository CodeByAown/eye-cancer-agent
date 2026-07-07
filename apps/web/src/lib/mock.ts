/**
 * Reference + illustrative data for the dashboard.
 *
 * - `models` reflects the REAL registered specialist models (accurate metadata).
 * - `scanActivity` / `confidenceTrend` are clearly-labeled ILLUSTRATIVE trend
 *   samples shown until a dedicated analytics endpoint exists. Live counts and
 *   the recent-analyses table use real API data (see the dashboard page).
 */

export interface ModelRow {
  name: string;
  task: string;
  version: string;
  status: "healthy" | "degraded" | "loading";
  latencyMs: number;
  license: "Apache-2.0" | "MIT" | "Research";
}

// Mirrors the real model registry (services/onnx + services/eye).
export const models: ModelRow[] = [
  {
    name: "skin-mobilenetv3-ham10000",
    task: "Skin · dermoscopy",
    version: "1.0",
    status: "healthy",
    latencyMs: 90,
    license: "Research",
  },
  {
    name: "fundus-resnet50-aptos-dr",
    task: "Eye · fundus (DR)",
    version: "1.0",
    status: "healthy",
    latencyMs: 140,
    license: "MIT",
  },
  {
    name: "openai-vision-eye",
    task: "Eye · anterior",
    version: "gpt-4o",
    status: "healthy",
    latencyMs: 3100,
    license: "Apache-2.0",
  },
];

// Illustrative 14-day trend (labeled as sample in the UI).
export const scanActivity = [
  { day: "Jun 20", scans: 42, flagged: 6 },
  { day: "Jun 21", scans: 55, flagged: 9 },
  { day: "Jun 22", scans: 48, flagged: 5 },
  { day: "Jun 23", scans: 61, flagged: 11 },
  { day: "Jun 24", scans: 73, flagged: 8 },
  { day: "Jun 25", scans: 66, flagged: 7 },
  { day: "Jun 26", scans: 84, flagged: 12 },
  { day: "Jun 27", scans: 79, flagged: 10 },
  { day: "Jun 28", scans: 92, flagged: 9 },
  { day: "Jun 29", scans: 88, flagged: 13 },
  { day: "Jun 30", scans: 101, flagged: 11 },
  { day: "Jul 01", scans: 96, flagged: 8 },
  { day: "Jul 02", scans: 114, flagged: 14 },
  { day: "Jul 03", scans: 128, flagged: 12 },
];

export const confidenceTrend = [
  { day: "Jun 27", value: 87.1 },
  { day: "Jun 28", value: 88.4 },
  { day: "Jun 29", value: 86.9 },
  { day: "Jun 30", value: 89.2 },
  { day: "Jul 01", value: 90.1 },
  { day: "Jul 02", value: 89.6 },
  { day: "Jul 03", value: 91.3 },
];

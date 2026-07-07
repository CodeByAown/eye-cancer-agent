/** React Query hooks — the components' interface to the backend. */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type {
  ClinicalReport,
  DashboardStats,
  HealthStatus,
  Module,
  Page,
  ReadinessStatus,
  Scan,
  UserPublic,
  Workflow,
} from "./types";

export const queryKeys = {
  health: ["health"] as const,
  ready: ["ready"] as const,
  me: ["me"] as const,
  stats: ["stats", "dashboard"] as const,
  scans: (module?: Module) => ["scans", module ?? "all"] as const,
  scan: (id: string) => ["scan", id] as const,
};

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => api.get<DashboardStats>("/api/v1/stats/dashboard"),
  });
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get<HealthStatus>("/api/v1/health"),
    refetchInterval: 30_000,
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: queryKeys.ready,
    queryFn: () => api.get<ReadinessStatus>("/api/v1/ready"),
    refetchInterval: 30_000,
    retry: false,
  });
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<UserPublic>("/api/v1/me"),
    retry: false,
  });
}

export function useScans(module?: Module, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...queryKeys.scans(module), page, pageSize],
    queryFn: () => api.get<Page<Scan>>("/api/v1/scans", { module, page, page_size: pageSize }),
  });
}

export function useScan(id: string) {
  return useQuery({
    queryKey: queryKeys.scan(id),
    queryFn: () => api.get<Scan>(`/api/v1/scans/${id}`),
    enabled: Boolean(id),
  });
}

export interface CreateScanInput {
  file: File;
  module: Module;
  workflow: Workflow;
  modality?: string;
}

export function useCreateScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, module, workflow, modality }: CreateScanInput) => {
      const form = new FormData();
      form.set("file", file);
      form.set("module", module);
      form.set("workflow", workflow);
      if (modality) form.set("modality", modality);
      return api.postForm<Scan>("/api/v1/scans", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scans"] }),
  });
}

export function useAnalyzeScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scanId: string) => api.post<Scan>(`/api/v1/scans/${scanId}/analyze`),
    onSuccess: (scan) => {
      qc.invalidateQueries({ queryKey: queryKeys.scan(scan.id) });
      qc.invalidateQueries({ queryKey: ["scans"] });
      qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: (scanId: string) => api.post<ClinicalReport>(`/api/v1/scans/${scanId}/report`),
  });
}

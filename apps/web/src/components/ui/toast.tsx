"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect } from "react";
import { create } from "zustand";

import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: ({ duration = 4500, ...t }) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, duration, ...t }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative toast API usable anywhere: `toast.success("Saved")`. */
export const toast = {
  show: (t: Parameters<ToastStore["push"]>[0]) => useToastStore.getState().push(t),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "success", title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "error", title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "warning", title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "info", title, description }),
};

export function useToast() {
  return { toast, dismiss: useToastStore((s) => s.dismiss) };
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const toneClasses: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-info",
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = icons[t.tone];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="glass-strong pointer-events-auto flex w-80 items-start gap-3 rounded-lg p-4 shadow-lg"
      role="status"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", toneClasses[t.tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t.title}</p>
        {t.description && <p className="text-muted-foreground mt-0.5 text-xs">{t.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

/** Mount once (in Providers). Renders the toast stack. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

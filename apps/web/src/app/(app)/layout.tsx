import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-background flex h-screen overflow-hidden">
        <Sidebar className="hidden md:flex" />
        <div className="mesh-bg relative flex min-w-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </TooltipProvider>
  );
}

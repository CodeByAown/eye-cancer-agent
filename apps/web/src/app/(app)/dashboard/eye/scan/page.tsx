"use client";

import { EyeScanner } from "@/components/scanner/eye-scanner";
import { Topbar } from "@/components/layout/topbar";

export default function EyeScanPage() {
  return (
    <>
      <Topbar
        title="AI Eye Scanner"
        subtitle="Realtime anterior-segment scan · on-device tracking"
      />
      <EyeScanner />
    </>
  );
}

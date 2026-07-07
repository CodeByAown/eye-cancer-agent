"use client";

import { UploadAnalysis } from "@/components/analysis/upload-analysis";
import { Topbar } from "@/components/layout/topbar";

export default function EyeUploadPage() {
  return (
    <>
      <Topbar title="Fundus / Eye Upload" subtitle="Retinal & external-eye image analysis" />
      <div className="p-6">
        <UploadAnalysis
          module="eye"
          workflow="upload"
          modality="fundus"
          acceptHint="Fundus (retinal) photograph · JPG/PNG · up to 25 MB"
          scopeNote="A specialist ResNet50 model (APTOS) grades diabetic retinopathy severity locally (No DR → Proliferative). Upload a fundus/retinal photograph for best results. Educational screening only, not a diagnosis."
        />
      </div>
    </>
  );
}

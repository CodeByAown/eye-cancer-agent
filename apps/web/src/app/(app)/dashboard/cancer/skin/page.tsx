"use client";

import { UploadAnalysis } from "@/components/analysis/upload-analysis";
import { Topbar } from "@/components/layout/topbar";

export default function SkinCancerPage() {
  return (
    <>
      <Topbar
        title="Skin Cancer Detection"
        subtitle="Dermoscopic lesion analysis · HAM10000 specialist model"
      />
      <div className="p-6">
        <UploadAnalysis
          module="cancer"
          workflow="upload"
          modality="dermoscopy"
          acceptHint="Dermoscopic or clinical skin-lesion image · JPG/PNG · up to 25 MB"
          scopeNote="A specialized 7-class HAM10000 model (MobileNetV3) classifies the lesion locally. Educational screening only — melanoma and carcinomas require in-person dermatology evaluation."
        />
      </div>
    </>
  );
}

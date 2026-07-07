"use client";

import { motion } from "framer-motion";
import { ImageUp, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp"];
const DEFAULT_MAX_MB = 25;

export interface UploadZoneProps {
  onFile: (file: File) => void;
  accept?: string[];
  maxSizeMb?: number;
  hint?: string;
  className?: string;
}

/** Drag-and-drop image upload with client-side validation + preview. */
export function UploadZone({
  onFile,
  accept = DEFAULT_ACCEPT,
  maxSizeMb = DEFAULT_MAX_MB,
  hint,
  className,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  const validate = useCallback(
    (file: File): string | null => {
      if (!accept.includes(file.type)) return "Unsupported file type.";
      if (file.size > maxSizeMb * 1024 * 1024) return `File exceeds ${maxSizeMb} MB.`;
      return null;
    },
    [accept, maxSizeMb],
  );

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      setPreview({ url: URL.createObjectURL(file), name: file.name });
      onFile(file);
    },
    [validate, onFile],
  );

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (preview) {
    return (
      <div className={cn("border-border relative overflow-hidden rounded-xl border", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt={preview.name} className="max-h-80 w-full object-contain" />
        <button
          type="button"
          onClick={clear}
          aria-label="Remove image"
          className="glass-strong absolute right-3 top-3 rounded-md p-1.5"
        >
          <X className="size-4" />
        </button>
        <div className="glass-strong absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 py-2 text-xs">
          <ImageUp className="text-primary size-4" />
          <span className="truncate">{preview.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
      >
        <span
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-full transition-colors",
            dragging ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <UploadCloud className="size-6" />
        </span>
        <span className="text-sm font-medium">
          Drag &amp; drop an image, or <span className="text-primary">browse</span>
        </span>
        <span className="text-muted-foreground text-xs">
          {hint ?? `JPG, PNG, WEBP, TIFF · up to ${maxSizeMb} MB`}
        </span>
      </motion.button>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-danger mt-2 text-xs">{error}</p>}
    </div>
  );
}

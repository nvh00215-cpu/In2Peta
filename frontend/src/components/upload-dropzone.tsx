"use client";

import { useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { IconBadge } from "@/components/ds/icon-badge";
import { ProgressBar } from "@/components/ds/progress-bar";
import { cn } from "@/lib/utils";
import { useUpload } from "@/lib/upload-context";

/**
 * Promo-banner upload target (design-system cards.promoBanner).
 * File input lives in UploadProvider so bottom-tab + banner share one picker
 * opened from a real user gesture (browsers block programmatic clicks in useEffect).
 */
export function UploadBanner() {
  const { phase, error, fileName, openPicker, handleFile, clearError } =
    useUpload();
  const [dragging, setDragging] = useState(false);
  const uploading = phase === "uploading";

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF"
        aria-busy={uploading}
        onClick={() => {
          clearError();
          openPicker();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            clearError();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative min-h-[120px] cursor-pointer overflow-hidden rounded-banner bg-terracotta p-5 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-off-white",
          dragging && "bg-terracotta-dark",
          uploading && "pointer-events-none opacity-90"
        )}
      >
        <span className="inline-block rounded-icon bg-promo px-2 py-1 text-caption font-medium text-white">
          AI
        </span>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-section text-white">
              {uploading
                ? "Uploading your PDF…"
                : phase === "success"
                  ? "Upload complete"
                  : "Turn a PDF into a course"}
            </h2>
            <p className="mt-1 text-caption text-white/80">
              {dragging
                ? "Drop it right here"
                : uploading && fileName
                  ? fileName
                  : "Drag & drop or tap to browse · PDF up to 15 MB"}
            </p>
          </div>
          <IconBadge variant="on-terracotta" size={52}>
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.7} />
            ) : phase === "success" ? (
              <CheckCircle2 className="h-6 w-6" strokeWidth={1.7} />
            ) : (
              <FileUp className="h-6 w-6" strokeWidth={1.7} />
            )}
          </IconBadge>
        </div>
        {uploading ? (
          <div className="mt-4">
            <ProgressBar value={65} onDark className="h-1.5" />
          </div>
        ) : null}
      </div>

      {phase === "error" && error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card-sm border border-promo/20 bg-white p-4 shadow-card"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-promo"
            strokeWidth={1.7}
          />
          <div className="min-w-0 flex-1">
            <p className="text-card-title text-heading">Upload failed</p>
            <p className="mt-1 text-caption text-body-gray">
              {fileName ? `${fileName} — ` : ""}
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                clearError();
                openPicker();
              }}
              className="mt-3 min-h-11 text-btn text-terracotta"
            >
              Try another file
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Alias matching design-system componentLibrary.cards.promoBanner. */
export const PromoBanner = UploadBanner;

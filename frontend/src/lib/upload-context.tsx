"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadDocument, ApiError } from "@/lib/api";

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export type UploadPhase = "idle" | "uploading" | "success" | "error";

type UploadContextValue = {
  phase: UploadPhase;
  error: string | null;
  fileName: string | null;
  /** Must be called from a user gesture (click/tap) so the OS file dialog opens. */
  openPicker: () => void;
  handleFile: (file: File) => Promise<void>;
  clearError: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (phase === "uploading") return;

      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        const msg = "Only PDF files are supported.";
        setPhase("error");
        setError(msg);
        setFileName(file.name);
        toast.error(msg);
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        const msg = "File is too large. Maximum size is 15 MB.";
        setPhase("error");
        setError(msg);
        setFileName(file.name);
        toast.error(msg);
        return;
      }

      setPhase("uploading");
      setError(null);
      setFileName(file.name);

      try {
        const res = await uploadDocument(file);
        setPhase("success");
        toast.success("Upload complete. Generating your course…");
        router.push(`/courses/${res.course_id}/generating`);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.detail
            : "Upload failed. Check your connection and try again.";
        setPhase("error");
        setError(msg);
        toast.error(msg);
      }
    },
    [phase, router]
  );

  const openPicker = useCallback(() => {
    if (phase === "uploading") return;
    // Clear previous selection so choosing the same file again still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  }, [phase]);

  const clearError = useCallback(() => {
    setError(null);
    if (phase === "error") setPhase("idle");
  }, [phase]);

  const value = useMemo(
    () => ({
      phase,
      error,
      fileName,
      openPicker,
      handleFile,
      clearError,
    }),
    [phase, error, fileName, openPicker, handleFile, clearError]
  );

  return (
    <UploadContext.Provider value={value}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error("useUpload must be used within UploadProvider");
  }
  return ctx;
}

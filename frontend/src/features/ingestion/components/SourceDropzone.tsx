"use client";

import { useId, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = [".pdf", ".csv", ".json", ".txt"] as const;
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

type Props = {
  file: File | null;
  onFileChange: (file: File | null) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function SourceDropzone({ file, onFileChange }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const acceptDroppedFile = (next: File | undefined) => {
    if (!next) return;
    if (!hasAcceptedExtension(next.name)) {
      onFileChange(null);
      return;
    }
    onFileChange(next);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    acceptDroppedFile(e.dataTransfer.files?.[0]);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    acceptDroppedFile(e.target.files?.[0]);
    // Reset input value so picking the same file twice still fires change.
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-all duration-250",
          isDragging
            ? "border-purple-500/60 text-purple-300"
            : "border-white/[0.12] text-zinc-500 hover:border-purple-500/40 hover:text-zinc-300"
        )}
        style={
          isDragging
            ? {
                background: "rgba(139,92,246,0.10)",
                boxShadow: "0 0 32px rgba(139,92,246,0.18), inset 0 0 24px rgba(139,92,246,0.06)",
              }
            : { background: "rgba(255,255,255,0.03)" }
        }
      >
        <UploadCloud className="size-4 shrink-0" aria-hidden />
        <span className="text-sm">
          {isDragging ? "Drop to stage" : "Drag & drop or click to browse"}
        </span>
        <span className="ml-auto text-xs text-zinc-600 shrink-0">
          {ACCEPTED_EXTENSIONS.join(" · ")}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={handleInputChange}
        />
      </label>

      {file ? (
        <div
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-blue-400" aria-hidden />
            <span className="truncate font-medium text-zinc-300" title={file.name}>
              {file.name}
            </span>
            <span className="shrink-0 text-xs text-zinc-500">{formatBytes(file.size)}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Clear selected file"
            onClick={() => onFileChange(null)}
            className="text-zinc-500 hover:text-red-400 hover:bg-transparent transition-colors"
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

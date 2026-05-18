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
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors duration-200",
          isDragging
            ? "animate-pulse border-primary bg-primary/5 text-primary"
            : "border-muted-foreground/40 bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground"
        )}
      >
        <UploadCloud className="size-8" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isDragging ? "Drop the file to stage it" : "Drag and drop a file here, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">
            Accepted: {ACCEPTED_EXTENSIONS.join(", ")}
          </p>
        </div>
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
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate font-medium" title={file.name}>
              {file.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Clear selected file"
            onClick={() => onFileChange(null)}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

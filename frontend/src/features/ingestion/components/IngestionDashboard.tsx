"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Globe,
  PenTool,
  Paperclip,
  Link2,
  Type,
  Plus,
  X,
  Zap,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api, isConflict, type ApiError, type ConflictError } from "@/lib/axios";
import type { components } from "@/types/openapi";
import { SourceDropzone } from "./SourceDropzone";
import { isValidHttpUrl } from "./UrlInputForm";

type RunResponse = components["schemas"]["PipelineRunResponse"];
type IngestionSource = components["schemas"]["MultiSourceIngestionSource"];
type SourceType = IngestionSource["source_type"];

type TabKey = "file" | "url" | "text";

type StagedSource = {
  source_id: string;
  source_type: "file" | "url" | "text";
  content: string;
  fileName?: string;
};

const EXT_TO_SOURCE_TYPE: Record<
  string,
  Extract<SourceType, "pdf" | "csv" | "json" | "txt">
> = {
  pdf: "pdf",
  csv: "csv",
  json: "json",
  txt: "txt",
};

function detectSourceType(name: string): "pdf" | "csv" | "json" | "txt" {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return EXT_TO_SOURCE_TYPE[ext] ?? "txt";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected non-string FileReader result"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 28);
  }
}

const TABS = [
  { id: "file" as const, icon: Paperclip, label: "File" },
  { id: "url"  as const, icon: Link2,     label: "URL"  },
  { id: "text" as const, icon: Type,      label: "Text" },
] as const;

const FEATURE_PILLS = [
  { label: "PDFs & CSVs",           color: "rgba(59,130,246,0.7)"  },
  { label: "Web URLs",              color: "rgba(16,185,129,0.7)"  },
  { label: "Raw text",             color: "rgba(139,92,246,0.7)"  },
  { label: "JSON feeds",           color: "rgba(245,158,11,0.7)"  },
  { label: "Multi-source synthesis", color: "rgba(236,72,153,0.7)" },
] as const;

export function IngestionDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [textInput, setTextInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stagedSources, setStagedSources] = useState<StagedSource[]>([]);
  const [customSourceId, setCustomSourceId] = useState("SRC-1");

  const canAddToQueue =
    (tab === "file" && file !== null) ||
    (tab === "url" && isValidHttpUrl(url)) ||
    (tab === "text" && textInput.trim().length > 0);

  async function handleAddToQueue() {
    if (!canAddToQueue) return;
    const sourceId = customSourceId.trim() || `SRC-${stagedSources.length + 1}`;

    if (tab === "file" && file) {
      const content = await fileToBase64(file);
      setStagedSources((prev) => {
        const next: StagedSource[] = [
          ...prev,
          { source_id: sourceId, source_type: "file", content, fileName: file.name },
        ];
        setCustomSourceId(`SRC-${next.length + 1}`);
        return next;
      });
      setFile(null);
    } else if (tab === "url" && isValidHttpUrl(url)) {
      setStagedSources((prev) => {
        const next: StagedSource[] = [
          ...prev,
          { source_id: sourceId, source_type: "url", content: url },
        ];
        setCustomSourceId(`SRC-${next.length + 1}`);
        return next;
      });
      setUrl("");
      setDescription("");
    } else if (tab === "text" && textInput.trim().length > 0) {
      setStagedSources((prev) => {
        const next: StagedSource[] = [
          ...prev,
          { source_id: sourceId, source_type: "text", content: textInput.trim() },
        ];
        setCustomSourceId(`SRC-${next.length + 1}`);
        return next;
      });
      setTextInput("");
    }
  }

  function removeSource(index: number) {
    setStagedSources((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setCustomSourceId(`SRC-${next.length + 1}`);
      return next;
    });
  }

  async function handleLaunch() {
    if (stagedSources.length === 0) return;
    setSubmitting(true);
    try {
      const response = await api.post<RunResponse>("/api/pipeline/run", {
        sources: stagedSources.map((s) => ({
          source_id: s.source_id,
          source_type:
            s.source_type === "file"
              ? detectSourceType(s.fileName || "")
              : s.source_type === "text"
              ? "txt"
              : "url",
          content: s.content,
          ingested_at: new Date().toISOString(),
        })),
      });

      toast.success("Pipeline initialized", {
        description: `Tracking ${response.data.pipeline_id}`,
      });
      setStagedSources([]);
      router.push(`/pipeline/${response.data.pipeline_id}`);
    } catch (err) {
      const normalized = err as ConflictError | ApiError | Error;
      const message =
        isConflict(normalized) || (normalized as ApiError).kind === "api"
          ? normalized.message
          : (normalized as Error).message || "Failed to start pipeline";
      toast.error("Pipeline submission failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  const isLaunchReady = stagedSources.length > 0 && !submitting;

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 min-h-0 overflow-y-auto w-full px-4 py-3">

      {/* â”€â”€ Ambient floating orbs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className="fixed inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute top-[20%] left-[12%] w-[520px] h-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 70%)",
            filter: "blur(72px)",
            animation: "orb-float-1 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[15%] right-[10%] w-[440px] h-[440px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)",
            filter: "blur(64px)",
            animation: "orb-float-2 26s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-[60%] left-[55%] w-[300px] h-[300px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
            filter: "blur(56px)",
            animation: "orb-float-1 32s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* â”€â”€ Hero header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="text-center mb-4 animate-fade-in-up relative z-10">
        <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight text-white">
          Analyze anything.
          <br />
          <span
            style={{
              background:
                "linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Act on intelligence.
          </span>
        </h1>
      </div>
      {/* â”€â”€ Main glass container â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden animate-scale-in relative z-10"
        style={{
          animationDelay: "0.12s",
          background: "rgba(255,255,255,0.055)",
          backdropFilter: "blur(44px)",
          WebkitBackdropFilter: "blur(44px)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow:
            "0 10px 56px rgba(0,0,0,0.65), 0 28px 88px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.09)",
        }}
      >
        {/* â”€â”€ Tab selector â”€â”€ */}
        <div
          className="flex items-center gap-1 px-2.5 pt-2.5 pb-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                tab === id
                  ? "text-purple-300"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
              style={
                tab === id
                  ? {
                      background: "rgba(139,92,246,0.18)",
                      boxShadow: "0 0 12px rgba(139,92,246,0.16)",
                    }
                  : undefined
              }
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* â”€â”€ Input area â”€â”€ */}
        <div className="p-3 space-y-2">
          {tab === "file" && (
            <SourceDropzone file={file} onFileChange={setFile} />
          )}

          {tab === "url" && (
            <div className="space-y-2.5">
              <Input
                type="url"
                inputMode="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-10 text-white placeholder:text-zinc-600"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              />
              <Textarea
                placeholder="Short description or context (optional)"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-white placeholder:text-zinc-600 text-sm"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  height: "52px",
                }}
              />
            </div>
          )}

          {tab === "text" && (
            <Textarea
              placeholder="Paste or type your content here…"
              className="text-white placeholder:text-zinc-600 text-sm"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                height: "90px",
              }}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
          )}

          {/* â”€â”€ Action bar â”€â”€ */}
          <div
            className="flex items-center gap-2 pt-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Input
              value={customSourceId}
              onChange={(e) => setCustomSourceId(e.target.value)}
              placeholder="Source ID"
              className="h-8 w-28 text-xs font-mono text-zinc-400 placeholder:text-zinc-600 flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            />
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleAddToQueue}
              disabled={!canAddToQueue}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                canAddToQueue
                  ? "text-zinc-200 hover:text-white"
                  : "text-zinc-600 cursor-not-allowed"
              )}
              style={
                canAddToQueue
                  ? {
                      background: "rgba(255,255,255,0.09)",
                      border: "1px solid rgba(255,255,255,0.13)",
                    }
                  : {
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }
              }
            >
              <Plus className="size-3.5" />
              Stage Source
            </button>
          </div>
        </div>

        {/* â”€â”€ Staged queue â”€â”€ */}
        {stagedSources.length > 0 && (
          <div
            className="px-3 pb-3 pt-2.5 space-y-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Staged Queue
              </span>
              <Badge
                variant="outline"
                className="text-[10px] h-5"
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  color: "rgb(161,161,170)",
                }}
              >
                {stagedSources.length} source
                {stagedSources.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {stagedSources.map((source, idx) => (
                <div
                  key={`${source.source_id}-${idx}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-zinc-300 animate-slide-right"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    animationDelay: `${idx * 0.04}s`,
                  }}
                >
                  {source.source_type === "file" && (
                    <FileText className="size-3 text-blue-400 shrink-0" />
                  )}
                  {source.source_type === "url" && (
                    <Globe className="size-3 text-emerald-400 shrink-0" />
                  )}
                  {source.source_type === "text" && (
                    <PenTool className="size-3 text-purple-400 shrink-0" />
                  )}
                  <span className="font-mono text-zinc-500 shrink-0 text-[10px]">
                    {source.source_id}
                  </span>
                  <span className="truncate max-w-[110px] text-zinc-400">
                    {source.source_type === "file"
                      ? source.fileName
                      : source.source_type === "url"
                      ? safeHostname(source.content)
                      : source.content.substring(0, 22) +
                        (source.content.length > 22 ? "â€¦" : "")}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSource(idx)}
                    className="text-zinc-600 hover:text-red-400 transition-colors ml-0.5 shrink-0"
                    aria-label={`Remove ${source.source_id}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* â”€â”€ Launch button â”€â”€ */}
        <div
          className="p-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            type="button"
            onClick={handleLaunch}
            disabled={!isLaunchReady}
            aria-busy={submitting}
            className="relative w-full h-9 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden"
            style={
              isLaunchReady
                ? {
                    background:
                      "linear-gradient(135deg, rgba(139,92,246,0.92) 0%, rgba(59,130,246,0.92) 100%)",
                    boxShadow:
                      "0 0 0 1px rgba(139,92,246,0.45), 0 4px 28px rgba(139,92,246,0.38), 0 0 56px rgba(59,130,246,0.18)",
                    color: "white",
                    animation: "glow-pulse 2.8s ease-in-out infinite",
                  }
                : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgb(82,82,91)",
                    cursor: "not-allowed",
                  }
            }
          >
            {/* Shimmer sweep on active state */}
            {isLaunchReady && (
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer-sweep 3.5s ease infinite",
                }}
              />
            )}

            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin relative z-10" />
                <span className="relative z-10">Initializing Pipelineâ€¦</span>
              </>
            ) : (
              <>
                <Zap className="size-4 relative z-10" />
                <span className="relative z-10">
                  Launch Intelligence Pipeline
                  {stagedSources.length > 0 && (
                    <span className="ml-1.5 opacity-70 text-xs">
                      ({stagedSources.length} source
                      {stagedSources.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </span>
                {stagedSources.length > 0 && (
                  <ChevronRight className="size-4 relative z-10 opacity-80" />
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* â”€â”€ Feature hint pills â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className="mt-4 flex flex-wrap justify-center gap-2 animate-fade-in relative z-10"
        style={{ animationDelay: "0.35s" }}
      >
        {FEATURE_PILLS.map(({ label, color }) => (
          <span
            key={label}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 px-2.5 py-1 rounded-full"
            style={{
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.025)",
            }}
          >
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ background: color, boxShadow: `0 0 5px ${color}` }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

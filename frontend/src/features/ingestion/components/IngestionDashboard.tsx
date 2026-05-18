"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api, isConflict, type ApiError, type ConflictError } from "@/lib/axios";
import type { components } from "@/types/openapi";
import { SourceDropzone } from "./SourceDropzone";
import { UrlInputForm, isValidHttpUrl } from "./UrlInputForm";

type RunRequest = components["schemas"]["PipelineRunRequest"];
type RunResponse = components["schemas"]["PipelineRunResponse"];
type IngestionSource = components["schemas"]["MultiSourceIngestionSource"];
type SourceType = IngestionSource["source_type"];

type TabKey = "file" | "url";

const EXT_TO_SOURCE_TYPE: Record<string, Extract<SourceType, "pdf" | "csv" | "json" | "txt">> = {
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
      // Strip the "data:<mime>;base64," prefix and keep the raw base64 payload.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function newSourceId(): string {
  const random = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`).replace(/-/g, "");
  return `SRC-${random.slice(0, 8).toUpperCase()}`;
}

export function IngestionDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    !submitting &&
    ((tab === "file" && file !== null) || (tab === "url" && isValidHttpUrl(url)));

  async function buildRequestBody(): Promise<RunRequest> {
    const ingested_at = new Date().toISOString();
    const trimmedDescription = description.trim();
    const constraints = trimmedDescription ? { description: trimmedDescription } : undefined;

    if (tab === "url") {
      const source: IngestionSource = {
        source_id: newSourceId(),
        source_type: "url",
        content: url,
        ingested_at,
      };
      return constraints ? { sources: [source], constraints } : { sources: [source] };
    }

    if (!file) throw new Error("No file selected");
    const content = await fileToBase64(file);
    const source: IngestionSource = {
      source_id: newSourceId(),
      source_type: detectSourceType(file.name),
      content,
      ingested_at,
    };
    return constraints ? { sources: [source], constraints } : { sources: [source] };
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body = await buildRequestBody();
      const { data } = await api.post<RunResponse>("/api/pipeline/run", body);
      toast.success("Pipeline initialized", {
        description: `Tracking ${data.pipeline_id}`,
      });
      router.push(`/pipeline/${data.pipeline_id}`);
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ingestion Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Drop a file or paste a URL. The multi-agent pipeline starts the moment you submit.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="file">Files</TabsTrigger>
          <TabsTrigger value="url">Web Scraper</TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="pt-4">
          <SourceDropzone file={file} onFileChange={setFile} />
        </TabsContent>

        <TabsContent value="url" className="pt-4">
          <UrlInputForm
            url={url}
            description={description}
            onUrlChange={setUrl}
            onDescriptionChange={setDescription}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-busy={submitting || undefined}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Rocket className="size-4" aria-hidden />
          )}
          {submitting ? "Dispatching pipeline…" : "Trigger Processing Pipeline"}
        </Button>
      </div>
    </div>
  );
}

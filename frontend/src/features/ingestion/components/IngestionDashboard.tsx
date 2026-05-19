"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Rocket, FileText, Globe, PenTool, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api, isConflict, type ApiError, type ConflictError } from "@/lib/axios";
import type { components } from "@/types/openapi";
import { SourceDropzone } from "./SourceDropzone";
import { UrlInputForm, isValidHttpUrl } from "./UrlInputForm";

type RunResponse = components["schemas"]["PipelineRunResponse"];
type IngestionSource = components["schemas"]["MultiSourceIngestionSource"];
type SourceType = IngestionSource["source_type"];

type TabKey = "file" | "url" | "text";

type StagedSource = {
  source_id: string;
  source_type: 'file' | 'url' | 'text';
  content: string;
  fileName?: string;
};

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
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

export function IngestionDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [textInput, setTextInput] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [stagedSources, setStagedSources] = useState<StagedSource[]>([]);
  const [customSourceId, setCustomSourceId] = useState(`SRC-1`);

  const canAddToQueue =
    (tab === "file" && file !== null) ||
    (tab === "url" && isValidHttpUrl(url)) ||
    (tab === "text" && textInput.trim().length > 0);

  async function handleAddToQueue() {
    if (!canAddToQueue) return;

    const sourceId = customSourceId.trim() || `SRC-${stagedSources.length + 1}`;

    if (tab === "file" && file) {
      const content = await fileToBase64(file);
      setStagedSources(prev => {
        const next: StagedSource[] = [...prev, {
          source_id: sourceId,
          source_type: "file",
          content,
          fileName: file.name
        }];
        setCustomSourceId(`SRC-${next.length + 1}`);
        return next;
      });
      setFile(null);
    } else if (tab === "url" && isValidHttpUrl(url)) {
      setStagedSources(prev => {
        const next: StagedSource[] = [...prev, {
          source_id: sourceId,
          source_type: "url",
          content: url,
        }];
        setCustomSourceId(`SRC-${next.length + 1}`);
        return next;
      });
      setUrl("");
      setDescription("");
    } else if (tab === "text" && textInput.trim().length > 0) {
      setStagedSources(prev => {
        const next: StagedSource[] = [...prev, {
          source_id: sourceId,
          source_type: "text",
          content: textInput.trim(),
        }];
        setCustomSourceId(`SRC-${next.length + 1}`);
        return next;
      });
      setTextInput("");
    }
  }

  function removeSource(index: number) {
    setStagedSources(prev => {
      const next = prev.filter((_, i) => i !== index);
      setCustomSourceId(`SRC-${next.length + 1}`);
      return next;
    });
  }

  async function handleLaunch() {
    if (stagedSources.length === 0) return;
    setSubmitting(true);
    try {
      const response = await api.post<RunResponse>('/api/pipeline/run', {
        sources: stagedSources.map(s => ({
          source_id: s.source_id,
          source_type: s.source_type === 'file' ? detectSourceType(s.fileName || '') : (s.source_type === 'text' ? 'txt' : 'url'),
          content: s.content,
          ingested_at: new Date().toISOString()
        }))
      });

      toast.success("Pipeline initialized", {
        description: `Tracking ${response.data.pipeline_id}`,
      });

      setStagedSources([]); // clean queue
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ingestion Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Stage multiple files, URLs, or text snippets into a unified queue before launching the synthesis pipeline.
        </p>
      </header>

      {/* STAGING INPUT AREA */}
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="file">Files</TabsTrigger>
            <TabsTrigger value="url">Web URL</TabsTrigger>
            <TabsTrigger value="text">Raw Text</TabsTrigger>
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

          <TabsContent value="text" className="pt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label htmlFor="raw-text">Raw Text Content</Label>
                  <Textarea
                    id="raw-text"
                    placeholder="Paste raw text here..."
                    className="min-h-[150px]"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Bar for Adding to Queue */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
            <div className="w-full sm:w-auto flex-1 space-y-1.5">
              <Label htmlFor="custom-source-id" className="text-xs font-semibold uppercase text-muted-foreground">
                Explicit Source ID
              </Label>
              <Input
                id="custom-source-id"
                value={customSourceId}
                onChange={(e) => setCustomSourceId(e.target.value)}
                className="font-mono"
              />
            </div>
            <Button
              type="button"
              onClick={handleAddToQueue}
              disabled={!canAddToQueue}
              className="w-full sm:w-auto"
              variant="secondary"
            >
              Add to Queue
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* STAGING QUEUE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-tight">Staging Queue</h2>
          <Badge variant="outline">{stagedSources.length} Items</Badge>
        </div>

        {stagedSources.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No sources staged. Add a file, URL, or text to begin.
          </div>
        ) : (
          <div className="space-y-3">
            {stagedSources.map((source, idx) => (
              <Card key={`${source.source_id}-${idx}`} className="overflow-hidden bg-card/50">
                <div className="flex items-center p-3 gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                    {source.source_type === 'file' && <FileText className="w-5 h-5" />}
                    {source.source_type === 'url' && <Globe className="w-5 h-5" />}
                    {source.source_type === 'text' && <PenTool className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="default" className="font-mono text-xs">
                        {source.source_id}
                      </Badge>
                    </div>
                    <p className="text-sm truncate text-muted-foreground font-medium">
                      {source.source_type === 'file' && source.fileName}
                      {source.source_type === 'url' && source.content}
                      {source.source_type === 'text' && source.content.substring(0, 60) + (source.content.length > 60 ? '...' : '')}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeSource(idx)}
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* LAUNCH PIPELINE */}
      <div className="pt-6 border-t flex flex-col">
        <Button
          type="button"
          size="lg"
          onClick={handleLaunch}
          disabled={stagedSources.length === 0 || submitting}
          aria-busy={submitting || undefined}
          className="w-full text-base font-semibold py-6 shadow-lg hover:shadow-primary/20 transition-all"
        >
          {submitting ? (
            <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
          ) : (
            <Rocket className="mr-2 size-5" aria-hidden />
          )}
          {submitting ? "Dispatching pipeline…" : "🚀 Launch Multi-Agent Synthesis Pipeline"}
        </Button>
      </div>
    </div>
  );
}

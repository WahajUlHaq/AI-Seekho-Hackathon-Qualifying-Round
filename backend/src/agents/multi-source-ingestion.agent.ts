import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";

// Safe pdf-parse import that works with v1 and v2
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParseModule = require("pdf-parse");
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
    typeof pdfParseModule === "function" ? pdfParseModule : pdfParseModule.default ?? pdfParseModule;

// papaparse has no @types — use require with manual type cast
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Papa = require("papaparse") as {
    parse: (csv: string, opts: Record<string, unknown>) => {
        data: Record<string, string>[];
        errors: unknown[];
        meta: { fields?: string[] };
    };
};

export interface RawSourceInput {
    source_id: string;
    source_type: "pdf" | "url" | "csv" | "json" | "table" | "realtime_feed";
    content: string;
    metadata: {
        url?: string;
        filename?: string;
        timestamp: string;
        authority_type?: string;
        [key: string]: unknown;
    };
}

export interface NormalizedSource {
    source_id: string;
    source_type: string;
    raw_text: string;
    structured_data?: Record<string, unknown>;
    extraction_confidence: number;
    timestamp: string;
    word_count: number;
    metadata: Record<string, unknown>;
}

export interface MultiSourceIngestionInput extends AgentInput {
    sources: RawSourceInput[];
}

export interface MultiSourceIngestionOutput extends AgentOutput {
    ingestion_id: string;
    timestamp: string;
    sources_processed: number;
    sources: Array<{
        source_id: string;
        source_type: string;
        content: string;
        credibility_tier?: string;
        ingested_at: string;
    }>;
    normalized_sources: NormalizedSource[];
}

export class MultiSourceIngestionAgent extends BaseAgent<
    MultiSourceIngestionInput,
    MultiSourceIngestionOutput
> {
    constructor() {
        super("MultiSourceIngestionAgent", "multi_source_ingestion");
    }

    protected async execute(
        input: MultiSourceIngestionInput
    ): Promise<MultiSourceIngestionOutput> {
        const { pipeline_id, sources } = input;

        const normalized = await Promise.all(
            sources.map((s) => this.ingestSingle(s, pipeline_id))
        );

        const totalWords = normalized.reduce((sum, s) => sum + s.word_count, 0);
        const avgConfidence =
            normalized.reduce((sum, s) => sum + s.extraction_confidence, 0) /
            normalized.length;

        this.logDecision(
            pipeline_id,
            `Ingested ${normalized.length} sources in parallel — total words: ${totalWords}`,
            "ingestion_complete",
            avgConfidence
        );

        const contractSources = normalized.map((n) => ({
            source_id: n.source_id,
            source_type: n.source_type === "table" ? "json" : n.source_type,
            content: n.raw_text,
            ingested_at: n.timestamp,
        }));

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            ingestion_id: this.generateId(),
            timestamp: new Date().toISOString(),
            sources_processed: normalized.length,
            sources: contractSources,
            normalized_sources: normalized,
        };
    }

    private async ingestSingle(
        source: RawSourceInput,
        pipelineId: string
    ): Promise<NormalizedSource> {
        try {
            switch (source.source_type) {
                case "pdf":
                    return await this.ingestPDF(source);
                case "url":
                    return await this.ingestURL(source, pipelineId);
                case "csv":
                    return this.ingestCSV(source);
                case "json":
                case "table":
                    return this.ingestJSON(source);
                case "realtime_feed":
                    return this.ingestRealtimeFeed(source);
                default:
                    return this.fallback(source, "unsupported type");
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[Ingestion] Failed to ingest ${source.source_id}: ${msg}`);
            return this.fallback(source, msg);
        }
    }

    private async ingestPDF(source: RawSourceInput): Promise<NormalizedSource> {
        let raw_text = "";
        let extraction_confidence = 0.95;

        try {
            // If content looks like a real PDF (base64), decode it; otherwise treat as pre-extracted text
            const isPdfBinary =
                source.content.startsWith("%PDF") ||
                (source.content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(source.content.slice(0, 100)));

            if (isPdfBinary) {
                const buf = Buffer.from(source.content, "base64");
                const parsed = await pdfParse(buf);
                raw_text = parsed.text;
            } else {
                // Content is already extracted text (test scenario)
                raw_text = source.content;
                extraction_confidence = 0.85;
            }
        } catch {
            raw_text = source.content;
            extraction_confidence = 0.5;
        }

        return this.buildNormalized(source, raw_text, extraction_confidence);
    }

    private async ingestURL(
        source: RawSourceInput,
        _pipelineId: string
    ): Promise<NormalizedSource> {
        const url = source.metadata.url;
        if (!url) {
            return this.fallback(source, "no URL in metadata");
        }

        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentAgent/1.0)" },
            });
            const $ = cheerio.load(response.data as string);
            $("script, style, nav, footer, header").remove();
            const raw_text = $("article, main, p, h1, h2, h3")
                .text()
                .replace(/\s+/g, " ")
                .trim();

            return this.buildNormalized(source, raw_text || source.content, raw_text ? 0.8 : 0.3);
        } catch {
            return this.buildNormalized(source, source.content, 0.3);
        }
    }

    private ingestCSV(source: RawSourceInput): NormalizedSource {
        try {
            const result = Papa.parse(source.content, {
                header: true,
                skipEmptyLines: true,
            });
            const raw_text = JSON.stringify(result.data);
            const structured_data: Record<string, unknown> = {
                rows: result.data,
                fields: result.meta.fields ?? [],
                row_count: result.data.length,
            };
            const confidence = result.errors.length === 0 ? 0.98 : 0.7;
            return this.buildNormalized(source, raw_text, confidence, structured_data);
        } catch {
            return this.fallback(source, "CSV parse error");
        }
    }

    private ingestJSON(source: RawSourceInput): NormalizedSource {
        try {
            const parsed: unknown = JSON.parse(source.content);
            const raw_text = JSON.stringify(parsed, null, 2);
            const structured_data: Record<string, unknown> = Array.isArray(parsed)
                ? { items: parsed, count: (parsed as unknown[]).length }
                : (parsed as Record<string, unknown>);
            return this.buildNormalized(source, raw_text, 0.99, structured_data);
        } catch {
            return this.buildNormalized(source, source.content, 0.6);
        }
    }

    private ingestRealtimeFeed(source: RawSourceInput): NormalizedSource {
        try {
            const events: Array<{ timestamp: string; message: string; severity?: string }> =
                JSON.parse(source.content);
            const raw_text = events
                .map((e) => `[${e.timestamp}] ${e.message}`)
                .join("\n");
            const structured_data: Record<string, unknown> = {
                events,
                count: events.length,
                latest_timestamp: events[events.length - 1]?.timestamp ?? source.metadata.timestamp,
            };
            return this.buildNormalized(source, raw_text, 0.9, structured_data);
        } catch {
            return this.buildNormalized(source, source.content, 0.6);
        }
    }

    private buildNormalized(
        source: RawSourceInput,
        raw_text: string,
        extraction_confidence: number,
        structured_data?: Record<string, unknown>
    ): NormalizedSource {
        const effectiveType = source.source_type === "table" ? "json" : source.source_type;
        return {
            source_id: source.source_id,
            source_type: effectiveType,
            raw_text: raw_text.trim(),
            structured_data,
            extraction_confidence,
            timestamp: source.metadata.timestamp,
            word_count: raw_text.trim().split(/\s+/).filter(Boolean).length,
            metadata: { ...source.metadata },
        };
    }

    private fallback(source: RawSourceInput, reason: string): NormalizedSource {
        return this.buildNormalized(source, source.content || `[Ingestion failed: ${reason}]`, 0.2);
    }

    private generateId(): string {
        const raw = uuidv4().replace(/-/g, "").toUpperCase().slice(0, 8);
        // Ensure only alphanumeric — replace any non-alphanumeric with digit
        return `ING-${raw.replace(/[^A-Z0-9]/g, "0")}`;
    }
}

export const multiSourceIngestionAgent = new MultiSourceIngestionAgent();

import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import {
    serializeCSVTable,
    serializeJSONDocument,
    SerializedTable,
} from "../utils/tabular-serializer";
import { antigravityFileLogger } from "../tracing/file-logger";
import {
    MultiSourceIngestionSchema,
    evaluateWithZod,
} from "../contracts/zod-schemas";

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

export type SourceRole = "trigger" | "context" | "constraint";

export interface RawSourceInput {
    source_id: string;
    source_type: "pdf" | "url" | "csv" | "json" | "table" | "realtime_feed";
    content: string;
    metadata: {
        url?: string;
        filename?: string;
        timestamp: string;
        authority_type?: string;
        role?: SourceRole;
        [key: string]: unknown;
    };
}

export interface NormalizedSource {
    source_id: string;
    source_type: string;
    raw_text: string;
    serialized_text?: string;          // V2: tabular → natural language for RAG safety
    structured_data?: Record<string, unknown>;
    extraction_confidence: number;
    timestamp: string;
    word_count: number;
    role?: SourceRole;
    metadata: Record<string, unknown>;
}

export interface MultiSourceIngestionInput extends AgentInput {
    sources: RawSourceInput[];
}

export interface MultiSourceIngestionOutput extends AgentOutput {
    ingestion_id: string;
    timestamp: string;
    sources_processed: number;
    successful_count: number;
    failed_count: number;
    sources: Array<{
        source_id: string;
        source_type: string;
        content: string;
        credibility_tier?: string;
        ingested_at: string;
    }>;
    normalized_sources: NormalizedSource[];
    ingestion_failures: Array<{ source_id: string; reason: string }>;
}

const MIN_SUCCESSFUL_SOURCES = 3;

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
        const startTime = Date.now();

        // V2: Promise.allSettled acts as a CIRCUIT BREAKER.
        // A single corrupt PDF or timed-out URL must NOT crash the entire
        // multi-source ingestion. Partial failures are quarantined into the
        // ingestion_failures array and the pipeline continues so long as the
        // minimum-source guard is satisfied.
        const settled = await Promise.allSettled(
            sources.map((s) => this.ingestSingle(s, pipeline_id))
        );

        const normalized: NormalizedSource[] = [];
        const failures: Array<{ source_id: string; reason: string }> = [];

        settled.forEach((result, idx) => {
            if (result.status === "fulfilled") {
                normalized.push(result.value);
            } else {
                const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
                failures.push({ source_id: sources[idx].source_id, reason });
                // Push a degraded fallback so downstream still has a record
                normalized.push(this.fallback(sources[idx], reason));
            }
        });

        const successful_count = normalized.filter((n) => n.extraction_confidence >= 0.5).length;
        const failed_count = sources.length - successful_count;

        // V2 enterprise safeguard: minimum-source guard
        if (successful_count < MIN_SUCCESSFUL_SOURCES) {
            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: "M1_Ingestion_Failure",
                tool_called: this.agentName,
                reasoning: `Only ${successful_count} sources ingested successfully (min=${MIN_SUCCESSFUL_SOURCES}). Circuit breaker triggered.`,
                status: "FAILED",
                rollback_action: "Antigravity halts pipeline; surface failures to operator for source replacement",
                latency_ms: Date.now() - startTime,
                cost: 0,
                rubric_category: "failure_recovery",
            });
            throw new Error(
                `Multi-source ingestion below minimum threshold: ${successful_count}/${sources.length} successful (need ≥${MIN_SUCCESSFUL_SOURCES})`
            );
        }

        const totalWords = normalized.reduce((sum, s) => sum + s.word_count, 0);
        const avgConfidence =
            normalized.reduce((sum, s) => sum + s.extraction_confidence, 0) /
            normalized.length;

        this.logDecision(
            pipeline_id,
            `Ingested ${successful_count}/${sources.length} sources via Promise.allSettled — total words: ${totalWords}, failures: ${failures.length}`,
            "ingestion_complete",
            avgConfidence
        );

        const contractSources = normalized.map((n) => ({
            source_id: n.source_id,
            source_type: n.source_type === "table" ? "json" : n.source_type,
            content: n.raw_text,
            ingested_at: n.timestamp,
        }));

        const output: MultiSourceIngestionOutput = {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            ingestion_id: this.generateId(),
            timestamp: new Date().toISOString(),
            sources_processed: normalized.length,
            successful_count,
            failed_count,
            sources: contractSources,
            normalized_sources: normalized,
            ingestion_failures: failures,
        };

        // AMCE selective-efficiency gate — Zod structural validation, no LLM call
        const amce = evaluateWithZod(
            output,
            MultiSourceIngestionSchema,
            "multi_source_ingestion_v1",
            "ALERT_ONLY"
        );
        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: "AMCE_M1_StructuralValidation",
            tool_called: "ZodValidator",
            reasoning: amce.passed
                ? "M1 output passed Zod structural validation (ALERT_ONLY mode)"
                : `M1 output Zod errors: ${amce.errors.join("; ")}`,
            status: amce.passed ? "SUCCESS" : "FAILED",
            rollback_action: amce.passed ? "none" : "Log warning; continue (ALERT_ONLY)",
            latency_ms: Date.now() - startTime,
            cost: 0,
            rubric_category: "constraint_evaluation",
        });

        return output;
    }

    private async ingestSingle(
        source: RawSourceInput,
        pipelineId: string
    ): Promise<NormalizedSource> {
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
                throw new Error(`Unsupported source_type: ${source.source_type}`);
        }
    }

    private async ingestPDF(source: RawSourceInput): Promise<NormalizedSource> {
        let raw_text = "";
        let extraction_confidence = 0.95;

        try {
            const isPdfBinary =
                source.content.startsWith("%PDF") ||
                (source.content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(source.content.slice(0, 100)));

            if (isPdfBinary) {
                const buf = Buffer.from(source.content, "base64");
                const parsed = await pdfParse(buf);
                raw_text = parsed.text;
            } else {
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
            return this.buildNormalized(source, source.content, 0.3);
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
        const result = Papa.parse(source.content, {
            header: true,
            skipEmptyLines: true,
        });
        const fields = result.meta.fields ?? [];
        const structured_data: Record<string, unknown> = {
            rows: result.data,
            fields,
            row_count: result.data.length,
        };
        const confidence = result.errors.length === 0 ? 0.98 : 0.7;

        // V2: serialize rows into natural language to prevent RAG hallucination.
        const serialized: SerializedTable = serializeCSVTable(result.data, fields);
        const serialized_text = [serialized.summary, ...serialized.sentences].join("\n");

        // raw_text becomes the serialized form so downstream embedding sees prose.
        return this.buildNormalized(source, serialized_text, confidence, structured_data, serialized_text);
    }

    private ingestJSON(source: RawSourceInput): NormalizedSource {
        let parsed: unknown;
        try {
            parsed = JSON.parse(source.content);
        } catch {
            return this.buildNormalized(source, source.content, 0.6);
        }

        const structured_data: Record<string, unknown> = Array.isArray(parsed)
            ? { items: parsed, count: (parsed as unknown[]).length }
            : (parsed as Record<string, unknown>);

        const serialized: SerializedTable = serializeJSONDocument(parsed);
        const serialized_text = [serialized.summary, ...serialized.sentences].join("\n");

        return this.buildNormalized(source, serialized_text, 0.99, structured_data, serialized_text);
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
            // Realtime feeds are already textual sentences — no extra serialization needed.
            return this.buildNormalized(source, raw_text, 0.9, structured_data, raw_text);
        } catch {
            return this.buildNormalized(source, source.content, 0.6);
        }
    }

    private buildNormalized(
        source: RawSourceInput,
        raw_text: string,
        extraction_confidence: number,
        structured_data?: Record<string, unknown>,
        serialized_text?: string
    ): NormalizedSource {
        const effectiveType = source.source_type === "table" ? "json" : source.source_type;
        return {
            source_id: source.source_id,
            source_type: effectiveType,
            raw_text: raw_text.trim(),
            serialized_text: serialized_text?.trim(),
            structured_data,
            extraction_confidence,
            timestamp: source.metadata.timestamp,
            word_count: raw_text.trim().split(/\s+/).filter(Boolean).length,
            role: (source.metadata.role as SourceRole) ?? undefined,
            metadata: { ...source.metadata },
        };
    }

    private fallback(source: RawSourceInput, reason: string): NormalizedSource {
        return this.buildNormalized(source, source.content || `[Ingestion failed: ${reason}]`, 0.2);
    }

    private generateId(): string {
        const raw = uuidv4().replace(/-/g, "").toUpperCase().slice(0, 8);
        return `ING-${raw.replace(/[^A-Z0-9]/g, "0")}`;
    }
}

export const multiSourceIngestionAgent = new MultiSourceIngestionAgent();

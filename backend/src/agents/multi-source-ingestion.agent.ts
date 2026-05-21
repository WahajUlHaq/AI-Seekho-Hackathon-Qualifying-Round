import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { load as cheerioLoad } from "cheerio";
import Papa from "papaparse";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { SourceDocument, SourceType, CredibilityTier } from "../interfaces/source-document.interface";
import { FeedAdapter, FeedAdapterConfig } from "../interfaces/feed-adapter.interface";
import { MockRealtimeFeedAdapter } from "../adapters/mock-realtime-feed.adapter";
import { traceCollector } from "../tracing/collector";

export interface IngestionConfig {
    testDataDir: string;
    feedDelayMs: number;
    maxContentLengthBytes: number;
}

export interface RawIngestionSource {
    source_id: string;
    source_type: string;
    content: string;
    fileName?: string;
}

export interface MultiSourceIngestionInput extends AgentInput {
    config?: Partial<IngestionConfig>;
    feedAdapter?: FeedAdapter;
    rawSources?: RawIngestionSource[];
}

export interface MultiSourceIngestionOutput extends AgentOutput {
    ingestion_id: string;
    timestamp: string;
    sources_processed: number;
    sources: SourceDocument[];
}

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

function truncate(text: string, maxBytes: number): string {
    const buf = Buffer.from(text, "utf-8");
    if (buf.length <= maxBytes) return text;
    return buf.slice(0, maxBytes).toString("utf-8");
}

export class MultiSourceIngestionAgent extends BaseAgent<
    MultiSourceIngestionInput,
    MultiSourceIngestionOutput
> {
    private readonly defaultConfig: IngestionConfig;
    private readonly defaultFeedAdapter: FeedAdapter | null;

    constructor(config?: Partial<IngestionConfig>, feedAdapter?: FeedAdapter) {
        super("MultiSourceIngestionAgent", "multi_source_ingestion_v1");

        const thresholdsPath = path.resolve(__dirname, "../../config/agentThresholds.config.json");
        const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf-8"));

        this.defaultConfig = {
            testDataDir: path.resolve(__dirname, "../../test-data"),
            feedDelayMs: config?.feedDelayMs ?? thresholds.ingestion.feedDelayMs,
            maxContentLengthBytes: config?.maxContentLengthBytes ?? thresholds.ingestion.maxContentLengthBytes,
            ...config,
        };

        this.defaultFeedAdapter = feedAdapter ?? null;
    }

    protected async execute(input: MultiSourceIngestionInput): Promise<MultiSourceIngestionOutput> {
        const { pipeline_id } = input;
        const cfg = { ...this.defaultConfig, ...input.config };
        const now = new Date().toISOString();

        // Dynamic-source branch: FE-staged uploads bypass the disk fallback. Filters
        // empty-content entries so the multi_source_ingestion_v1 semantic check holds.
        if (input.rawSources && input.rawSources.length > 0) {
            const filtered = input.rawSources.filter(r => r.content && r.content.length > 0);

            traceCollector.log(pipeline_id, {
                pipeline_id,
                event_type: "thinking",
                agent: this.agentName,
                message: `Dynamic source mode: ingesting ${filtered.length} FE-staged source(s); disk fallback skipped.`,
                data: { source_count: filtered.length, source_ids: filtered.map(r => r.source_id) },
            });

            const sources: SourceDocument[] = filtered.map(raw => ({
                source_id: raw.source_id,
                source_type: raw.source_type as SourceType,
                content: raw.content,
                ingested_at: now,
                credibility_tier: "UNVERIFIED" as CredibilityTier,
                metadata: {
                    source_origin: "frontend-raw",
                    ...(raw.fileName ? { fileName: raw.fileName } : {}),
                },
            }));

            return {
                pipeline_id,
                agent_name: this.agentName,
                completed_at: new Date().toISOString(),
                ingestion_id: makeId("ING"),
                timestamp: now,
                sources_processed: sources.length,
                sources,
            };
        }

        // Resolution order: per-call input override → constructor-injected default → local fallback
        const feedAdapter =
            input.feedAdapter
            ?? this.defaultFeedAdapter
            ?? new MockRealtimeFeedAdapter(path.join(cfg.testDataDir, "realtime-feed.json"));

        const feedCfg: FeedAdapterConfig = { delayMs: cfg.feedDelayMs, maxEvents: 15 };

        const ingestionTasks: Array<() => Promise<SourceDocument>> = [
            () => this.ingestPdf(pipeline_id, cfg),
            () => this.ingestCsv(pipeline_id, cfg),
            () => this.ingestTxt(pipeline_id, cfg),
            () => this.ingestUrls(pipeline_id, cfg),
            () => this.ingestFeed(pipeline_id, feedAdapter, feedCfg, cfg),
        ];

        const results = await Promise.allSettled(ingestionTasks.map(t => t()));

        const sources: SourceDocument[] = [];
        for (const result of results) {
            if (result.status === "fulfilled") {
                sources.push(result.value);
            } else {
                traceCollector.log(pipeline_id, {
                    pipeline_id,
                    event_type: "ingestion_error",
                    agent: this.agentName,
                    message: `Ingestion error: ${result.reason?.message ?? String(result.reason)}`,
                });
            }
        }

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            ingestion_id: makeId("ING"),
            timestamp: now,
            sources_processed: sources.length,
            sources,
        };
    }

    private async ingestPdf(pipelineId: string, cfg: IngestionConfig): Promise<SourceDocument> {
        const filePath = path.join(cfg.testDataDir, "sample-report.pdf");
        const buffer = fs.readFileSync(filePath);

        let text = "";
        let numpages = 1;

        try {
            // pdf-parse v2 uses PDFParse class, loaded lazily to avoid Worker init at module load
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { PDFParse } = require("pdf-parse") as {
                PDFParse: new () => { parse(buf: Buffer): Promise<{ text: string; numpages: number }> };
            };
            const parser = new PDFParse();
            const data = await parser.parse(buffer);
            text = data.text.trim();
            numpages = data.numpages;
        } catch {
            // Fallback: strip non-printable bytes and extract human-readable text from the PDF binary
            text = buffer
                .toString("latin1")
                .replace(/[^\x20-\x7E\n\r\t]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        const content = truncate(text || "[PDF: no readable text extracted]", cfg.maxContentLengthBytes);

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "agent_start",
            agent: this.agentName,
            message: `PDF ingested: ${numpages} pages, ${content.length} chars`,
        });

        return {
            source_id: makeId("SRC"),
            source_type: "pdf" as SourceType,
            content,
            ingested_at: new Date().toISOString(),
            credibility_tier: "UNVERIFIED" as CredibilityTier,
            metadata: { pages: numpages, file: "sample-report.pdf" },
        };
    }

    private async ingestCsv(pipelineId: string, cfg: IngestionConfig): Promise<SourceDocument> {
        const filePath = path.join(cfg.testDataDir, "sample-data.csv");
        const raw = fs.readFileSync(filePath, "utf-8");
        const result = Papa.parse(raw, { header: true, skipEmptyLines: true });
        const content = truncate(JSON.stringify(result.data), cfg.maxContentLengthBytes);

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "agent_start",
            agent: this.agentName,
            message: `CSV ingested: ${(result.data as unknown[]).length} rows`,
        });

        return {
            source_id: makeId("SRC"),
            source_type: "csv" as SourceType,
            content,
            ingested_at: new Date().toISOString(),
            credibility_tier: "UNVERIFIED" as CredibilityTier,
            metadata: { rows: (result.data as unknown[]).length, file: "sample-data.csv" },
        };
    }

    private async ingestTxt(pipelineId: string, cfg: IngestionConfig): Promise<SourceDocument> {
        const filePath = path.join(cfg.testDataDir, "sample-email.txt");
        const raw = fs.readFileSync(filePath, "utf-8");
        const content = truncate(raw, cfg.maxContentLengthBytes);

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "agent_start",
            agent: this.agentName,
            message: `TXT ingested: ${content.length} chars`,
        });

        return {
            source_id: makeId("SRC"),
            source_type: "txt" as SourceType,
            content,
            ingested_at: new Date().toISOString(),
            credibility_tier: "UNVERIFIED" as CredibilityTier,
            metadata: { file: "sample-email.txt" },
        };
    }

    private async ingestUrls(pipelineId: string, cfg: IngestionConfig): Promise<SourceDocument> {
        const urlsPath = path.join(cfg.testDataDir, "urls.json");
        const urlDefs = JSON.parse(fs.readFileSync(urlsPath, "utf-8")) as Array<{
            url: string;
            label: string;
            mock_content: string;
        }>;

        const parts: string[] = [];

        for (const def of urlDefs) {
            try {
                // Use mock_content directly — real HTTP would fail for fictional URLs
                const $ = cheerioLoad(def.mock_content);
                const text = $("body").text().replace(/\s+/g, " ").trim();
                parts.push(`[${def.label}] ${text}`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                traceCollector.log(pipelineId, {
                    pipeline_id: pipelineId,
                    event_type: "ingestion_error",
                    agent: this.agentName,
                    message: `URL parse error for ${def.url}: ${msg}`,
                });
            }
        }

        const content = truncate(parts.join("\n\n"), cfg.maxContentLengthBytes);

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "agent_start",
            agent: this.agentName,
            message: `URLs ingested: ${parts.length}/${urlDefs.length} succeeded`,
        });

        return {
            source_id: makeId("SRC"),
            source_type: "url" as SourceType,
            content,
            ingested_at: new Date().toISOString(),
            credibility_tier: "UNVERIFIED" as CredibilityTier,
            metadata: { urls_attempted: urlDefs.length, urls_succeeded: parts.length },
        };
    }

    private async ingestFeed(
        pipelineId: string,
        adapter: FeedAdapter,
        feedCfg: FeedAdapterConfig,
        cfg: IngestionConfig
    ): Promise<SourceDocument> {
        const events: unknown[] = [];

        for await (const event of adapter.stream(feedCfg)) {
            events.push(event);
        }

        const content = truncate(JSON.stringify(events), cfg.maxContentLengthBytes);

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "agent_start",
            agent: this.agentName,
            message: `Realtime feed ingested: ${events.length} events`,
        });

        return {
            source_id: adapter.getSourceId(),
            source_type: "realtime_feed" as SourceType,
            content,
            ingested_at: new Date().toISOString(),
            credibility_tier: "UNVERIFIED" as CredibilityTier,
            metadata: { events_count: events.length, source_id: adapter.getSourceId() },
        };
    }
}

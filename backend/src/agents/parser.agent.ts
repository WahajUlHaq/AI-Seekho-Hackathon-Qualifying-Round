import { Buffer } from "node:buffer";
import { BaseAgent, type AgentInput, type AgentOutput } from "./base.agent";
import type { RawSource } from "./analytics.types";

const MAX_SOURCE_BYTES = 60 * 1024;

export interface ParserInput extends AgentInput {
    pipeline_id: string;
    sources: RawSource[];
}

export interface ParserOutput extends AgentOutput {
    pipeline_id: string;
    agent_name: "ParserAgent";
    completed_at: string;
    text: string;
}

function stripNonPrintable(buf: Buffer): string {
    return buf.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
}

function clamp(text: string, maxBytes: number): string {
    const buf = Buffer.from(text, "utf-8");
    if (buf.length <= maxBytes) return text;
    return buf.subarray(0, maxBytes).toString("utf-8");
}

async function decodeSource(src: RawSource): Promise<string> {
    if (!src.content) return "";
    const type = (src.source_type ?? "txt").toLowerCase();

    if (type === "url") {
        // URL submissions arrive as plain text (not base64) — see ingestion dashboard.
        return clamp(src.content, MAX_SOURCE_BYTES);
    }

    const raw = Buffer.from(src.content, "base64");

    if (type === "pdf") {
        try {
            const mod = (await import("pdf-parse")) as unknown as {
                PDFParse: new () => { parse: (b: Buffer) => Promise<{ text?: string }> };
            };
            const { text } = await new mod.PDFParse().parse(raw);
            return clamp(text ?? stripNonPrintable(raw), MAX_SOURCE_BYTES);
        } catch {
            return clamp(stripNonPrintable(raw), MAX_SOURCE_BYTES);
        }
    }

    return clamp(raw.toString("utf-8"), MAX_SOURCE_BYTES);
}

export class ParserAgent extends BaseAgent<ParserInput, ParserOutput> {
    constructor() {
        // Empty contract name — AMCE judge gates at the orchestrator layer, not the BaseAgent gate.
        super("ParserAgent", "");
    }

    protected async execute(input: ParserInput): Promise<ParserOutput> {
        const parts = await Promise.all(input.sources.map(decodeSource));
        const text = parts
            .map((p, i) =>
                `--- SOURCE ${i + 1} (${input.sources[i].source_type ?? "?"}) ---\n${p}`
            )
            .join("\n\n");

        return {
            pipeline_id: input.pipeline_id,
            agent_name: "ParserAgent",
            completed_at: new Date().toISOString(),
            text,
        };
    }
}

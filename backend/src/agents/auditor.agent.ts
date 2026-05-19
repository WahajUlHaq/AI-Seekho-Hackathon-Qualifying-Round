import { BaseAgent, type AgentInput, type AgentOutput } from "./base.agent";
import type { ContradictionRecord } from "./analytics.types";
import { retryWithBackoff } from "../utils/retry";
import { traceCollector } from "../tracing/collector";

const MAX_STRING_LEN = 240;
const MAX_CONTRADICTIONS = 5;

export interface AuditorInput extends AgentInput {
    pipeline_id: string;
    text: string;
    sourceIds: string[];
    correctionNotes?: string[];
}

export interface AuditorOutput extends AgentOutput {
    pipeline_id: string;
    agent_name: "AuditorAgent";
    completed_at: string;
    contradictions: ContradictionRecord[];
}

function clampString(value: unknown, max: number): string {
    if (typeof value !== "string") return "";
    return value.length > max ? value.slice(0, max) : value;
}

function buildAuditorPrompt(text: string, sourceIds: string[], correctionNotes: string[]): string {
    const correctionBlock =
        correctionNotes.length > 0
            ? `PREVIOUS ATTEMPT FAILED AMCE VALIDATION. Address these specific issues in this attempt:\n${correctionNotes
                  .map((n) => `- ${n}`)
                  .join("\n")}\n\n`
            : "";

    return `${correctionBlock}You are a semantic auditor. You compare claims in source material against widely-held baselines and flag conflicts.

TASK
Identify up to ${MAX_CONTRADICTIONS} specific claims in the source that contradict commonly accepted baselines (statistical norms, well-known facts, prior consensus).

Each contradiction must be { "source_id": string, "timestamp": ISO-8601, "raw_claim": string, "baseline_context": string, "conflict_rationale": string }.

Constraints:
- Pick source_id from this list: [${sourceIds.join(", ")}]
- Each string ≤ ${MAX_STRING_LEN} characters.
- If nothing meaningfully contradicts a baseline, return an empty array.

Reply with ONLY valid JSON of shape { "contradictions": ContradictionRecord[] }. No prose, no markdown.

<source>
${text}
</source>`;
}

function extractContradictions(response: string, fallbackSourceId: string): ContradictionRecord[] {
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(match[0]);
    } catch {
        return [];
    }

    const arr = (parsed as { contradictions?: unknown }).contradictions;
    if (!Array.isArray(arr)) return [];

    const records: ContradictionRecord[] = [];
    for (const entry of arr) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;

        const raw_claim = clampString(e.raw_claim, MAX_STRING_LEN);
        const baseline_context = clampString(e.baseline_context, MAX_STRING_LEN);
        const conflict_rationale = clampString(e.conflict_rationale, MAX_STRING_LEN);
        if (!raw_claim || !baseline_context || !conflict_rationale) continue;

        records.push({
            source_id:
                typeof e.source_id === "string" && e.source_id.length > 0
                    ? clampString(e.source_id, MAX_STRING_LEN)
                    : fallbackSourceId,
            timestamp:
                typeof e.timestamp === "string" && e.timestamp.length > 0
                    ? e.timestamp
                    : new Date().toISOString(),
            raw_claim,
            baseline_context,
            conflict_rationale,
        });
        if (records.length >= MAX_CONTRADICTIONS) break;
    }

    return records;
}

export class AuditorAgent extends BaseAgent<AuditorInput, AuditorOutput> {
    constructor() {
        super("AuditorAgent", "");
    }

    protected async execute(input: AuditorInput): Promise<AuditorOutput> {
        const notes = input.correctionNotes ?? [];
        const prompt = buildAuditorPrompt(input.text, input.sourceIds, notes);

        const contradictions = await retryWithBackoff(
            async (attempt) => {
                const response = await this.llmComplete(
                    input.pipeline_id,
                    prompt,
                    /* useBaseModel */ notes.length > 0 || attempt > 1,
                    "contradiction_auditing"
                );
                return extractContradictions(response, input.sourceIds[0] ?? "SRC-UNKNOWN");
            },
            {
                onRetry: (attempt, err, delayMs) => {
                    const message = err instanceof Error ? err.message : String(err);
                    traceCollector.log(input.pipeline_id, {
                        pipeline_id: input.pipeline_id,
                        event_type: "recovery",
                        agent: "AuditorAgent",
                        message: `Backoff retry after attempt ${attempt}: ${message} (waiting ${delayMs}ms)`,
                        data: { attempt, delay_ms: delayMs },
                    });
                },
            }
        );

        return {
            pipeline_id: input.pipeline_id,
            agent_name: "AuditorAgent",
            completed_at: new Date().toISOString(),
            contradictions,
        };
    }
}

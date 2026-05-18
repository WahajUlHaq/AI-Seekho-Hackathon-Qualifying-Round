import { BaseAgent, type AgentInput, type AgentOutput } from "./base.agent";
import type { ForecastPoint } from "./analytics.types";
import { retryWithBackoff, RetryableError } from "../utils/retry";
import { traceCollector } from "../tracing/collector";

export interface ForecasterInput extends AgentInput {
    pipeline_id: string;
    text: string;
    correctionNotes?: string[];
}

export interface ForecasterOutput extends AgentOutput {
    pipeline_id: string;
    agent_name: "ForecasterAgent";
    completed_at: string;
    forecast_data: ForecastPoint[];
}

function buildForecasterPrompt(text: string, correctionNotes: string[]): string {
    const correctionBlock =
        correctionNotes.length > 0
            ? `PREVIOUS ATTEMPT FAILED AMCE VALIDATION. Fix this issue:\n${correctionNotes.map((n) => `- ${n}`).join("\n")}\n\n`
            : "";

    return `${correctionBlock}You are a quantitative forecasting model.

TASK
Read the source text below. Identify the dominant numeric trend and produce exactly 90 data points:
- 30 historical points (one per day ending today).
- 60 predicted points (one per day starting tomorrow).

CRITICAL CAPPED FORMAT:
Return a MINIFIED, single-line JSON object matching the compact array schema below. Keep dates as short ISO values. Do not use white spaces or line breaks inside the array to save tokens.

Format: {"forecast_data":[["2026-05-18",150.0,false],["2026-05-19",151.2,true]]}

Schema map per tuple: [timestamp_string, value_number, is_extrapolation_boolean]

Reply with ONLY raw minified JSON. No prose, no markdown wrappers, no line breaks.

<source>
${text}
</source>`;
}

function extractForecastPoints(response: string): ForecastPoint[] {
    let cleanResponse = response.replace(/```json/gi, "").replace(/```/g, "").trim();

    // Look for the array start
    const arrayStart = cleanResponse.indexOf("[");
    if (arrayStart === -1) return [];

    let arrayString = cleanResponse.slice(arrayStart);

    // 🚨 TOKEN TRUNCATION HEALER:
    // If the model ran out of tokens, drop the last incomplete element and cap the array safely
    let parsedArray: any[] = [];
    let processingString = arrayString.trim();

    // If it doesn't end cleanly, find the last completed tuple matching `]`
    if (!processingString.endsWith("]}")) {
        const lastValidTupleEnd = processingString.lastIndexOf("]");
        if (lastValidTupleEnd !== -1) {
            // Re-bind the sliced text into a functional JSON array string
            processingString = processingString.slice(0, lastValidTupleEnd + 1);
            if (!processingString.endsWith("]")) {
                processingString += "]";
            }
        }
    }

    // Attempt parsing of the healed array chunk
    try {
        if (!processingString.startsWith("[")) processingString = "[" + processingString;
        parsedArray = JSON.parse(processingString);
    } catch (e) {
        // Line-by-line regex salvage fallback if full parse fails
        try {
            const tupleMatches = processingString.match(/\[\s*"[^"]+"\s*,\s*[-+]?[0-9]*\.?[0-9]+\s*,\s*(true|false)\s*\]/g);
            if (tupleMatches) {
                parsedArray = tupleMatches.map(t => JSON.parse(t));
            }
        } catch {
            return [];
        }
    }

    if (!Array.isArray(parsedArray)) return [];

    // Map minified tuples back to full ForecastPoint objects
    const points: ForecastPoint[] = [];
    for (const item of parsedArray) {
        if (!Array.isArray(item) || item.length < 3) continue;

        const [rawTimestamp, rawValue, rawExtrap] = item;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) continue;

        const timestamp = typeof rawTimestamp === "string" && rawTimestamp.length > 0
            ? (rawTimestamp.includes("T") ? rawTimestamp : `${rawTimestamp}T00:00:00Z`)
            : new Date().toISOString();

        points.push({
            timestamp,
            value,
            is_extrapolation: Boolean(rawExtrap),
        });
    }

    return points;
}

export class ForecasterAgent extends BaseAgent<ForecasterInput, ForecasterOutput> {
    constructor() {
        super("ForecasterAgent", "");
    }

    protected async execute(input: ForecasterInput): Promise<ForecasterOutput> {
        const notes = input.correctionNotes ?? [];
        const prompt = buildForecasterPrompt(input.text, notes);

        const points = await retryWithBackoff(
            async (attempt) => {
                const response = await this.llmComplete(
                    input.pipeline_id,
                    prompt,
                    /* useBaseModel */ notes.length > 0 || attempt > 1,
                    "trend_forecasting"
                );

                const parsed = extractForecastPoints(response);
                if (parsed.length < 30) {
                    throw new RetryableError(
                        `Forecaster returned only ${parsed.length} valid points (need >= 30)`
                    );
                }
                return parsed;
            },
            {
                onRetry: (attempt, err, delayMs) => {
                    const message = err instanceof Error ? err.message : String(err);
                    traceCollector.log(input.pipeline_id, {
                        pipeline_id: input.pipeline_id,
                        event_type: "recovery",
                        agent: "ForecasterAgent",
                        message: `Backoff retry after attempt ${attempt}: ${message} (waiting ${delayMs}ms)`,
                        data: { attempt, delay_ms: delayMs },
                    });
                },
            }
        );

        return {
            pipeline_id: input.pipeline_id,
            agent_name: "ForecasterAgent",
            completed_at: new Date().toISOString(),
            forecast_data: points,
        };
    }
}
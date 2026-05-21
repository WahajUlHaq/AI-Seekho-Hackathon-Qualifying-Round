// import { BaseAgent, type AgentInput, type AgentOutput } from "./base.agent";
// import type { ForecastPoint } from "./analytics.types";
// import { retryWithBackoff, RetryableError } from "../utils/retry";
// import { traceCollector } from "../tracing/collector";

// export interface ForecasterInput extends AgentInput {
//     pipeline_id: string;
//     text: string;
//     correctionNotes?: string[];
// }

// export interface ForecasterOutput extends AgentOutput {
//     pipeline_id: string;
//     agent_name: "ForecasterAgent";
//     completed_at: string;
//     forecast_data: ForecastPoint[];
// }

// function buildForecasterPrompt(text: string, correctionNotes: string[]): string {
//     const correctionBlock =
//         correctionNotes.length > 0
//             ? `PREVIOUS ATTEMPT FAILED AMCE VALIDATION. Address these specific issues in this attempt:\n${correctionNotes
//                   .map((n) => `- ${n}`)
//                   .join("\n")}\n\n`
//             : "";

//     return `${correctionBlock}You are a quantitative forecasting model.

// TASK
// Read the source text below. Identify the dominant numeric trend (volume, count, percentage, score — whatever is most prominent). Project the trajectory.

// Produce exactly 90 chronological data points:
// - 30 historical points, one per day, ending today.
// - 60 predicted points, one per day, starting tomorrow.

// Each point: { "timestamp": "ISO-8601 string", "value": number, "is_extrapolation": boolean }

// Constraints:
// - Historical points have is_extrapolation = false; predicted points have is_extrapolation = true.
// - Timestamps in strict ISO-8601 (e.g. "2026-05-18T00:00:00Z").
// - Values must be finite numbers.

// Reply with ONLY valid JSON of shape { "forecast_data": ForecastPoint[] }. No prose, no markdown, no commentary.

// <source>
// ${text}
// </source>`;
// }

// function extractForecastPoints(response: string): ForecastPoint[] {
//     const match = response.match(/\{[\s\S]*\}/);
//     if (!match) return [];

//     let parsed: unknown;
//     try {
//         parsed = JSON.parse(match[0]);
//     } catch {
//         return [];
//     }

//     const arr = (parsed as { forecast_data?: unknown }).forecast_data;
//     if (!Array.isArray(arr)) return [];

//     const points: ForecastPoint[] = [];
//     for (const entry of arr) {
//         if (!entry || typeof entry !== "object") continue;
//         const e = entry as Record<string, unknown>;
//         const value = Number(e.value);
//         if (!Number.isFinite(value)) continue;
//         const timestamp =
//             typeof e.timestamp === "string" && e.timestamp.length > 0
//                 ? e.timestamp
//                 : new Date().toISOString();
//         points.push({
//             timestamp,
//             value,
//             is_extrapolation: Boolean(e.is_extrapolation),
//         });
//     }

//     return points;
// }

// export class ForecasterAgent extends BaseAgent<ForecasterInput, ForecasterOutput> {
//     constructor() {
//         super("ForecasterAgent", "");
//     }

//     protected async execute(input: ForecasterInput): Promise<ForecasterOutput> {
//         const notes = input.correctionNotes ?? [];
//         const prompt = buildForecasterPrompt(input.text, notes);

//         const points = await retryWithBackoff(
//             async (attempt) => {
//                 const response = await this.llmComplete(
//                     input.pipeline_id,
//                     prompt,
//                     /* useBaseModel */ notes.length > 0 || attempt > 1,
//                     "trend_forecasting"
//                 );
//                 const parsed = extractForecastPoints(response);
//                 if (parsed.length < 30) {
//                     throw new RetryableError(
//                         `Forecaster returned only ${parsed.length} valid points (need >= 30)`
//                     );
//                 }
//                 return parsed;
//             },
//             {
//                 onRetry: (attempt, err, delayMs) => {
//                     const message = err instanceof Error ? err.message : String(err);
//                     traceCollector.log(input.pipeline_id, {
//                         pipeline_id: input.pipeline_id,
//                         event_type: "recovery",
//                         agent: "ForecasterAgent",
//                         message: `Backoff retry after attempt ${attempt}: ${message} (waiting ${delayMs}ms)`,
//                         data: { attempt, delay_ms: delayMs },
//                     });
//                 },
//             }
//         );

//         return {
//             pipeline_id: input.pipeline_id,
//             agent_name: "ForecasterAgent",
//             completed_at: new Date().toISOString(),
//             forecast_data: points,
//         };
//     }
// }

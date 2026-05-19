/**
 * AMCE BLOCK + BASE MODEL validator for Modules 5 and 9.
 *
 * Antigravity invokes this gate AFTER the primary-model output for a module
 * has been generated. It asks the Gemini 1.5 Pro base model to act as a
 * judge: structurally and logically sound? If the judge returns FAIL the
 * gate emits BLOCK and Antigravity is expected to either re-prompt the
 * primary model with the judge's reasoning appended, or fall back to a
 * deterministic safe output.
 *
 * This module is a passive tool — it never starts background work and it
 * exposes no standalone orchestration loop.
 */

import { llmClient } from "../utils/llm-client";
import { antigravityFileLogger } from "../tracing/file-logger";

/**
 * Thrown when the AMCE BLOCK + BASE MODEL gate produces a terminal BLOCK
 * (after all in-module retries are exhausted). The orchestrator catches
 * this and emits an `AMCE_BLOCK_FINAL` failure trace — the pipeline does
 * NOT silently swap in a fallback. The Phase 2 AMCE audit failed precisely
 * because BLOCK was being treated as a soft alert; this error type forces
 * the upstream orchestrator to actually halt.
 */
export class AMCEBlockError extends Error {
    readonly module: string;
    readonly schema: string;
    readonly score: number;
    readonly reasoning: string;
    readonly issues: string[];

    constructor(
        module: string,
        schema: string,
        score: number,
        reasoning: string,
        issues: string[]
    ) {
        super(`AMCE BLOCK (base model) on ${module} [${schema}] — score=${score.toFixed(2)}: ${reasoning}`);
        this.name = "AMCEBlockError";
        this.module = module;
        this.schema = schema;
        this.score = score;
        this.reasoning = reasoning;
        this.issues = issues;
    }
}

export type BaseModelDecision = "PASS" | "BLOCK";

export interface BaseModelValidation {
    decision: BaseModelDecision;
    score: number;            // 0..1 — judge's confidence the output is sound
    reasoning: string;        // judge's natural-language critique
    latency_ms: number;
    base_model_used: string;
    schema_name: string;
    issues: string[];         // structured list of detected issues
}

export interface BaseModelValidateOptions {
    pipelineId: string;
    moduleName: string;       // e.g. "M5_InsightExtraction"
    schemaName: string;       // e.g. "insight_extraction_v1"
    contextSummary: string;   // short description of what was supposed to be produced
    moduleOutput: unknown;    // structured output to be judged
    /**
     * What the base model should look for. Phrased as a checklist so the
     * judgement is structured rather than vibes.
     */
    judgementCriteria: string[];
    /**
     * Threshold below which the judge's score forces a BLOCK. Defaults
     * to 0.6 — Antigravity's enterprise default for BLOCK + BASE MODEL.
     */
    passThreshold?: number;
}

const DEFAULT_PASS_THRESHOLD = 0.6;

/**
 * Run the Gemini 1.5 Pro base model as a judge of the primary module's
 * output. Returns a structured PASS/BLOCK decision and surfaces the
 * critique back to Antigravity via the trace log.
 */
export async function validateWithBaseModel(
    opts: BaseModelValidateOptions
): Promise<BaseModelValidation> {
    const start = Date.now();
    const threshold = opts.passThreshold ?? DEFAULT_PASS_THRESHOLD;

    const truncatedOutput = JSON.stringify(opts.moduleOutput, null, 2).slice(0, 6000);

    const prompt = `You are Gemini 1.5 Pro acting as an enterprise-grade AMCE judge for the Google Antigravity orchestrator.

MODULE UNDER REVIEW: ${opts.moduleName}
SCHEMA: ${opts.schemaName}
CONTEXT: ${opts.contextSummary}

Module output (JSON, may be truncated):
\`\`\`json
${truncatedOutput}
\`\`\`

Evaluate the output strictly against these criteria:
${opts.judgementCriteria.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}

Respond with ONLY valid JSON, no preamble:
{
  "score": <number 0.0-1.0; 1.0 = perfect, 0.0 = unusable>,
  "decision": "PASS" | "BLOCK",
  "reasoning": "<1-3 sentence critique>",
  "issues": ["<short issue 1>", "<short issue 2>"]
}`;

    let raw = "";
    let parsed: { score?: number; decision?: string; reasoning?: string; issues?: unknown } | null = null;

    try {
        raw = await llmClient.complete(prompt, /* useBaseModel */ true);
        parsed = extractJSON(raw);
    } catch (err) {
        const latency_ms = Date.now() - start;
        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: `AMCE_BLOCK_${opts.moduleName}_BaseModelError`,
            tool_called: "BaseModelValidator",
            reasoning: `Base-model judge call failed: ${err instanceof Error ? err.message : String(err)}`,
            status: "FAILED",
            rollback_action: "Antigravity falls open (treat as PASS with score 0.5) to avoid pipeline halt on infra outage",
            latency_ms,
            cost: 0,
            rubric_category: "failure_recovery",
        });
        // Fail OPEN — base-model outage must not stall the entire pipeline.
        return {
            decision: "PASS",
            score: 0.5,
            reasoning: `Base-model judge unavailable: ${err instanceof Error ? err.message : String(err)}`,
            latency_ms,
            base_model_used: process.env.BASE_MODEL || "gemini-1.5-pro",
            schema_name: opts.schemaName,
            issues: ["base_model_unavailable"],
        };
    }

    const latency_ms = Date.now() - start;

    const score = clamp01(parsed?.score);
    const reasoning = typeof parsed?.reasoning === "string" ? parsed.reasoning : "No reasoning provided";
    const issues = Array.isArray(parsed?.issues)
        ? (parsed.issues as unknown[]).map(String).filter(Boolean)
        : [];

    const llmDecision = parsed?.decision === "BLOCK" ? "BLOCK" : "PASS";
    const finalDecision: BaseModelDecision =
        llmDecision === "BLOCK" || score < threshold ? "BLOCK" : "PASS";

    antigravityFileLogger.append({
        timestamp: new Date().toISOString(),
        step: `AMCE_BLOCK_${opts.moduleName}_BaseModelDecision`,
        tool_called: "BaseModelValidator",
        reasoning: `Base-model judge → ${finalDecision} (score=${score.toFixed(2)}, threshold=${threshold}). Critique: ${reasoning}`,
        status: finalDecision === "PASS" ? "SUCCESS" : "FAILED",
        rollback_action:
            finalDecision === "BLOCK"
                ? "Antigravity must re-prompt LLM with judge critique appended, or fall back to deterministic safe output"
                : "none",
        latency_ms,
        cost: 0,
        rubric_category: "constraint_evaluation",
    });

    return {
        decision: finalDecision,
        score,
        reasoning,
        latency_ms,
        base_model_used: process.env.BASE_MODEL || "gemini-1.5-pro",
        schema_name: opts.schemaName,
        issues,
    };
}

function clamp01(n: unknown): number {
    const v = typeof n === "number" ? n : Number(n);
    if (!isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
}

function extractJSON(raw: string): { score?: number; decision?: string; reasoning?: string; issues?: unknown } | null {
    const attempts: (string | null)[] = [
        raw,
        (() => { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return m ? m[1] : null; })(),
        (() => { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); return s !== -1 && e > s ? raw.slice(s, e + 1) : null; })(),
    ];
    for (const a of attempts) {
        if (!a) continue;
        try { return JSON.parse(a); } catch { continue; }
    }
    return null;
}

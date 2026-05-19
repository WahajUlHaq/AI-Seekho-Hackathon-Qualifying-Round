import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { antigravityFileLogger } from "../tracing/file-logger";
import {
    CredibilityScorerOutputSchema,
    evaluateWithZod,
} from "../contracts/zod-schemas";

export interface CredibilityScore {
    source_id: string;
    recency_score: number;
    authority_score: number;
    quality_score: number;
    total_score: number;
    credibility_tier: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
    reasoning: string;
}

export interface CredibilityScorerInput extends AgentInput {
    normalized_sources: NormalizedSource[];
}

export interface CredibilityScorerOutput extends AgentOutput {
    scores: CredibilityScore[];
}

export class CredibilityScorerAgent extends BaseAgent<
    CredibilityScorerInput,
    CredibilityScorerOutput
> {
    constructor() {
        super("CredibilityScorerAgent", "");
    }

    protected async execute(
        input: CredibilityScorerInput
    ): Promise<CredibilityScorerOutput> {
        const { pipeline_id, normalized_sources } = input;
        const startTime = Date.now();

        const scores = await Promise.all(
            normalized_sources.map((s) => this.scoreSingle(s, pipeline_id))
        );

        this.logDecision(
            pipeline_id,
            `Scored ${scores.length} sources — HIGH: ${scores.filter(s => s.credibility_tier === "HIGH").length}, MEDIUM: ${scores.filter(s => s.credibility_tier === "MEDIUM").length}, LOW: ${scores.filter(s => s.credibility_tier === "LOW").length}`,
            "scoring_complete",
            1.0
        );

        const output: CredibilityScorerOutput = {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            scores,
        };

        // AMCE Zod structural validation (ALERT_ONLY)
        const amce = evaluateWithZod(
            output,
            CredibilityScorerOutputSchema,
            "credibility_scorer_v1",
            "ALERT_ONLY"
        );
        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: "AMCE_M2_StructuralValidation",
            tool_called: "ZodValidator",
            reasoning: amce.passed
                ? "M2 output passed Zod structural validation (ALERT_ONLY mode)"
                : `M2 output Zod errors: ${amce.errors.join("; ")}`,
            status: amce.passed ? "SUCCESS" : "FAILED",
            rollback_action: amce.passed ? "none" : "Log warning; continue (ALERT_ONLY)",
            latency_ms: Date.now() - startTime,
            cost: 0,
            rubric_category: "constraint_evaluation",
        });

        return output;
    }

    private async scoreSingle(
        source: NormalizedSource,
        pipelineId: string
    ): Promise<CredibilityScore> {
        const recency_score = this.calculateRecencyScore(source.timestamp);
        const authority_score = this.calculateAuthorityScore(source.metadata);
        const quality_score = await this.calculateQualityScore(source.raw_text, pipelineId);

        const total_score = recency_score + authority_score + quality_score;

        // V2 min-axis thresholds: can't be HIGH if any axis falls below 15.
        const minAxis = Math.min(recency_score, authority_score, quality_score);

        let credibility_tier: CredibilityScore["credibility_tier"];
        if (total_score >= 70 && minAxis >= 15) credibility_tier = "HIGH";
        else if (total_score >= 70) credibility_tier = "MEDIUM"; // demoted by min-axis guard
        else if (total_score >= 40) credibility_tier = "MEDIUM";
        else if (total_score >= 20) credibility_tier = "LOW";
        else credibility_tier = "UNVERIFIED";

        this.logDecision(
            pipelineId,
            `Source ${source.source_id}: recency=${recency_score}, authority=${authority_score}, quality=${quality_score} → ${credibility_tier}`,
            credibility_tier,
            total_score / 100
        );

        return {
            source_id: source.source_id,
            recency_score,
            authority_score,
            quality_score,
            total_score,
            credibility_tier,
            reasoning: `Recency: ${recency_score}/40, Authority: ${authority_score}/30, Quality: ${quality_score}/30`,
        };
    }

    private calculateRecencyScore(timestamp: string): number {
        const hoursDiff =
            (Date.now() - new Date(timestamp).getTime()) / 3_600_000;

        if (hoursDiff < 1) return 40;
        if (hoursDiff < 24) return 30;
        if (hoursDiff < 168) return 20;  // 1 week
        if (hoursDiff < 720) return 10;  // 1 month
        return 0;
    }

    private calculateAuthorityScore(metadata: Record<string, unknown>): number {
        const authorityType = String(metadata.authority_type ?? "unknown").toLowerCase();

        // V2: domain-aware authority map (supply-chain specific).
        // Internal Audit and Company Policy carry the highest authority.
        // Social / anonymous feedback carries the lowest.
        const authorityMap: Record<string, number> = {
            internal_audit:    30,
            company_policy:    30,
            official:          30,
            government:        30,
            company:           28,
            erp_system:        28,
            wms_feed:          28,
            verified_news:     25,
            industry_news:     22,
            news:              22,
            supplier_official: 22,
            industry_report:   20,
            industry:          20,
            customer_verified: 18,
            user_verified:     15,
            customer_feedback: 12,
            user_generated:    10,
            social:             5,
            anonymous:          5,
        };

        return authorityMap[authorityType] ?? 5;
    }

    private async calculateQualityScore(
        rawText: string,
        pipelineId: string
    ): Promise<number> {
        const prompt = `Analyze this text and return a quality assessment as JSON.

TEXT:
${rawText.slice(0, 2000)}

Respond with ONLY valid JSON, no markdown fences:
{
  "has_citations": true or false,
  "has_numerical_data": true or false,
  "has_coherent_structure": true or false
}

Definitions:
- has_citations: text references specific sources, reports, dates, or named authorities
- has_numerical_data: text contains specific numbers, percentages, quantities, or measurements
- has_coherent_structure: text has clear organization with paragraphs, headers, labels, or dates`;

        try {
            const raw = await this.llmComplete(pipelineId, prompt, false, "quality_scoring");
            const parsed = this.parseJSON<{
                has_citations: boolean;
                has_numerical_data: boolean;
                has_coherent_structure: boolean;
            }>(raw);

            if (parsed) {
                return (parsed.has_citations ? 10 : 0) +
                    (parsed.has_numerical_data ? 10 : 0) +
                    (parsed.has_coherent_structure ? 10 : 0);
            }
        } catch {
            // fall through to heuristic
        }

        // Heuristic fallback
        const hasNumbers = /\d+/.test(rawText);
        const hasCitations = /\b(source|reference|report|according to|study|document|#[A-Z0-9-]+)\b/i.test(rawText);
        const hasStructure = rawText.split("\n").length > 3;

        return (hasCitations ? 10 : 0) + (hasNumbers ? 10 : 0) + (hasStructure ? 10 : 0);
    }

    private parseJSON<T>(raw: string): T | null {
        const attempts = [
            raw,
            (() => { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return m ? m[1] : null; })(),
            (() => { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); return s !== -1 && e > s ? raw.slice(s, e + 1) : null; })(),
        ];
        for (const attempt of attempts) {
            if (!attempt) continue;
            try { return JSON.parse(attempt) as T; } catch { continue; }
        }
        return null;
    }
}

export const credibilityScorerAgent = new CredibilityScorerAgent();

import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput, RetryContext } from "./base.agent";
import { InsightExtractionOutput } from "./insight-extraction.agent";

export interface ComponentScores {
    financial: number;       // 0-100
    operational: number;     // 0-100
    reputational: number;    // 0-100
}

export interface ImpactScorerInput extends AgentInput {
    insights: InsightExtractionOutput;
}

export interface ImpactScorerOutput extends AgentOutput {
    impact_analysis_id: string;
    analyzed_at: string;
    componentScores: ComponentScores;
    impactMagnitudeScore: number;
    reasoning: string;
}

const WEIGHTS = { financial: 0.40, operational: 0.35, reputational: 0.25 };

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

function clamp(n: number, lo = 0, hi = 100): number {
    if (typeof n !== "number" || Number.isNaN(n)) return 0;
    return Math.max(lo, Math.min(hi, Math.round(n)));
}

export class ImpactScorerAgent extends BaseAgent<ImpactScorerInput, ImpactScorerOutput> {
    constructor() {
        super("ImpactScorerAgent", "impact_analysis_v1");
    }

    protected async execute(
        input: ImpactScorerInput,
        retryContext?: RetryContext
    ): Promise<ImpactScorerOutput> {
        const { pipeline_id, insights } = input;

        const summary = this.summarizeInsights(insights);
        const scores = await this.scoreComponents(pipeline_id, summary, !!retryContext);

        const impactMagnitudeScore = Math.round(
            scores.financial * WEIGHTS.financial +
            scores.operational * WEIGHTS.operational +
            scores.reputational * WEIGHTS.reputational
        );

        const confidence = retryContext ? 0.7 : 0.85;
        this.logDecision(
            pipeline_id,
            `Impact magnitude ${impactMagnitudeScore}/100 from F=${scores.financial}, O=${scores.operational}, R=${scores.reputational}`,
            "impact_scored",
            confidence
        );

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            impact_analysis_id: makeId("IMP"),
            analyzed_at: new Date().toISOString(),
            componentScores: scores,
            impactMagnitudeScore: clamp(impactMagnitudeScore),
            reasoning: scores.reasoning,
        };
    }

    private summarizeInsights(insights: InsightExtractionOutput): string {
        const topRisks = insights.risks
            .slice(0, 5)
            .map((r, i) => `${i + 1}. [${r.severity}] ${r.title} — ${r.description}`)
            .join("\n");
        const topTrends = insights.trends
            .slice(0, 5)
            .map((t, i) => `${i + 1}. ${t.title} (confidence ${t.confidence.toFixed(2)}) — ${t.description}`)
            .join("\n");
        const topOpps = insights.opportunities
            .slice(0, 3)
            .map((o, i) => `${i + 1}. ${o.title} — ${o.description}`)
            .join("\n");
        const conflicts = insights.persistentConflicts
            .slice(0, 3)
            .map((c, i) => `${i + 1}. ${c.topic}: ${c.summary}`)
            .join("\n");

        return `RISKS:
${topRisks || "(none)"}

TRENDS:
${topTrends || "(none)"}

OPPORTUNITIES:
${topOpps || "(none)"}

PERSISTENT CONFLICTS:
${conflicts || "(none)"}`;
    }

    private async scoreComponents(
        pipelineId: string,
        summary: string,
        useBaseModel: boolean
    ): Promise<ComponentScores & { reasoning: string }> {
        const prompt = `You are an impact analyst. Given the structured insights below, produce three qualitative impact sub-scores on a 0-100 scale.

Scoring rubric:
  0   = no impact
  25  = minor / contained impact
  50  = material impact requiring attention
  75  = severe impact with strategic consequences
  100 = catastrophic / existential impact

Score each domain INDEPENDENTLY (do not pre-compute weights — that is done downstream):
  - financial:    revenue, cost, margin, capital exposure
  - operational:  throughput, delivery, capacity, supply chain, system uptime
  - reputational: brand, customer trust, regulator/public perception

INSIGHTS:
${summary}

Reply with ONLY valid JSON in this exact shape:
{
  "financial": 0-100,
  "operational": 0-100,
  "reputational": 0-100,
  "reasoning": "2-3 sentence explanation referencing at least one specific risk, trend, opportunity, or conflict from the insights above by title"
}`;

        try {
            const response = await this.llmComplete(pipelineId, prompt, useBaseModel, "impact_component_scoring");
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return {
                    financial:    clamp(parsed.financial),
                    operational:  clamp(parsed.operational),
                    reputational: clamp(parsed.reputational),
                    reasoning:    typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
                        ? parsed.reasoning.trim()
                        : this.fallbackReasoning(summary),
                };
            }
        } catch {
            // fall through to defaults
        }

        return {
            financial: 50,
            operational: 50,
            reputational: 50,
            reasoning: this.fallbackReasoning(summary),
        };
    }

    private fallbackReasoning(summary: string): string {
        const firstRiskLine = summary
            .split("\n")
            .find(l => /^\d+\.\s\[/.test(l));
        const cite = firstRiskLine?.replace(/^\d+\.\s/, "").slice(0, 120) ?? "general risk profile";
        return `LLM scoring fell back to neutral 50/50/50 baseline; manual review recommended. Anchor reference: ${cite}.`;
    }
}

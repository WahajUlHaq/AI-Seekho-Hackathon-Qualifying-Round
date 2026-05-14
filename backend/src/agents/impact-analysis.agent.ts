import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { Insight } from "./insight-extraction.agent";
import { Constraints, ImpactAnalysis } from "../types/simulation.types";

export type { ImpactAnalysis } from "../types/simulation.types";
export type { Constraints } from "../types/simulation.types";

export interface ImpactAnalysisInput extends AgentInput {
    insights: Insight[];
    constraints: Constraints;
}

export interface ImpactAnalysisOutput extends AgentOutput {
    impact_analyses: ImpactAnalysis[];
    constraints: Constraints;
}

const SEVERITY_TO_CATEGORY: Record<string, ImpactAnalysis["impact_category"]> = {
    critical: "risk",
    high: "revenue",
    medium: "operational",
    low: "cost",
};

const SEVERITY_TO_HORIZON: Record<string, ImpactAnalysis["time_horizon"]> = {
    critical: "immediate",
    high: "short_term",
    medium: "medium_term",
    low: "long_term",
};

export class ImpactAnalysisAgent extends BaseAgent<
    ImpactAnalysisInput,
    ImpactAnalysisOutput
> {
    constructor() {
        super("ImpactAnalysisAgent", "");
    }

    protected async execute(input: ImpactAnalysisInput): Promise<ImpactAnalysisOutput> {
        const { pipeline_id, insights, constraints } = input;

        const impact_analyses = await Promise.all(
            insights.map((insight) => this.analyzeOne(insight, constraints, pipeline_id))
        );

        this.logDecision(
            pipeline_id,
            `Impact analysis complete: ${impact_analyses.filter(i => i.impact_severity === "critical").length} critical, ${impact_analyses.filter(i => i.impact_severity === "high").length} high`,
            "impact_analysis_complete",
            1.0
        );

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            impact_analyses,
            constraints,
        };
    }

    private async analyzeOne(
        insight: Insight,
        constraints: Constraints,
        pipelineId: string
    ): Promise<ImpactAnalysis> {
        const prompt = `You are an operations strategist. Analyze the business impact of this insight.

INSIGHT:
- Title: ${insight.title}
- Description: ${insight.description}
- Category: ${insight.category}
- Severity: ${insight.severity}
- Data points: ${insight.data_points.join(", ")}

CONSTRAINTS:
- Budget limit: ${constraints.budget_limit.amount} ${constraints.budget_limit.currency}
- Time limit: ${constraints.time_limit.max_duration_hours} hours
- Urgency: ${constraints.urgency_level}

Respond with ONLY valid JSON, no markdown:
{
  "primary_impact": "one sentence summary of the main business impact",
  "impact_category": "revenue" | "cost" | "risk" | "compliance" | "reputation" | "operational",
  "impact_severity": "critical" | "high" | "medium" | "low",
  "quantified_impact": {
    "estimated_cost": <number in PKR or null>,
    "estimated_time_hours": <number or null>,
    "affected_count": <number of customers/units or null>
  },
  "constraints_violated": ["budget" if cost exceeds limit, "time" if fix takes too long],
  "time_horizon": "immediate" | "short_term" | "medium_term" | "long_term",
  "cascading_effects": ["effect 1", "effect 2"],
  "risk_if_ignored": "what happens if no action is taken"
}`;

        try {
            const raw = await this.llmComplete(pipelineId, prompt, false, "impact_analysis");
            const parsed = this.parseLLMJSON<ImpactAnalysis>(raw);
            if (parsed && parsed.primary_impact) {
                return { ...parsed, insight_id: insight.insight_id };
            }
        } catch {
            // fall through to deterministic fallback
        }

        return this.deterministicFallback(insight, constraints);
    }

    private deterministicFallback(insight: Insight, constraints: Constraints): ImpactAnalysis {
        const sev = insight.severity;
        const constraintsViolated: string[] = [];

        const estimatedCost = sev === "critical" ? 450000 : sev === "high" ? 200000 : 50000;
        if (estimatedCost > constraints.budget_limit.amount) {
            constraintsViolated.push("budget");
        }

        const estimatedTime = sev === "critical" ? 2 : sev === "high" ? 8 : 24;
        if (estimatedTime > constraints.time_limit.max_duration_hours) {
            constraintsViolated.push("time");
        }

        return {
            insight_id: insight.insight_id,
            primary_impact: `${insight.title} — requires immediate operational response`,
            impact_category: SEVERITY_TO_CATEGORY[sev] ?? "operational",
            impact_severity: sev,
            quantified_impact: {
                estimated_cost: estimatedCost,
                estimated_time_hours: estimatedTime,
                affected_count: sev === "critical" ? 200 : sev === "high" ? 50 : 10,
            },
            constraints_violated: constraintsViolated,
            time_horizon: SEVERITY_TO_HORIZON[sev] ?? "short_term",
            cascading_effects: [
                "Customer satisfaction degradation",
                "Revenue loss from unmet demand",
                "Potential reputational damage",
            ],
            risk_if_ignored:
                sev === "critical"
                    ? "Stockout within 24 hours — estimated PKR 2M revenue loss"
                    : "Operational degradation within 3-7 days",
        };
    }

    private parseLLMJSON<T>(raw: string): T | null {
        const attempts: (string | null)[] = [
            raw,
            (() => { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return m ? m[1] : null; })(),
            (() => { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); return s !== -1 && e > s ? raw.slice(s, e + 1) : null; })(),
        ];
        for (const a of attempts) {
            if (!a) continue;
            try { return JSON.parse(a) as T; } catch { continue; }
        }
        return null;
    }
}

export const impactAnalysisAgent = new ImpactAnalysisAgent();

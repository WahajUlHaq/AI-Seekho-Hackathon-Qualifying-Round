/**
 * Module 8 — Impact Analysis (V2).
 *
 * V2 adds explicit CONSTRAINT TRADEOFF MODELING. For every insight we
 * surface 2-3 feasible action paths (lowest_cost / fastest_resolution /
 * balanced) and quantify each in {cost_pkr, time_hours, affected_customers}
 * so Module 9 has explicit data to pick a chain rather than guessing.
 *
 * AMCE: ALERT_ONLY Zod structural validation — fast deterministic check,
 * no expensive LLM judge (the LLM here is only ever a strategy generator,
 * not an autonomous decision-maker).
 */

import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { Insight } from "./insight-extraction.agent";
import {
    Constraints,
    ImpactAnalysis,
    ImpactOption,
} from "../types/simulation.types";
import { antigravityFileLogger } from "../tracing/file-logger";
import {
    ImpactAnalysisOutputSchema,
    evaluateWithZod,
} from "../contracts/zod-schemas";

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
        const startTime = Date.now();

        const impact_analyses = await Promise.all(
            insights.map((insight) => this.analyzeOne(insight, constraints, pipeline_id))
        );

        this.logDecision(
            pipeline_id,
            `Impact analysis complete: ${impact_analyses.filter((i) => i.impact_severity === "critical").length} critical, ${impact_analyses.filter((i) => i.impact_severity === "high").length} high. Total options surfaced: ${impact_analyses.reduce((s, ia) => s + ia.options.length, 0)}`,
            "impact_analysis_complete",
            1.0
        );

        const output: ImpactAnalysisOutput = {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            impact_analyses,
            constraints,
        };

        // AMCE ALERT_ONLY Zod gate — never blocks the pipeline, just surfaces drift.
        const amce = evaluateWithZod(
            output,
            ImpactAnalysisOutputSchema,
            "impact_analysis_v1",
            "ALERT_ONLY"
        );
        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: "AMCE_M8_StructuralValidation",
            tool_called: "ZodValidator",
            reasoning: amce.passed
                ? `M8 output passed Zod structural schema (ALERT_ONLY). Analyses: ${impact_analyses.length}`
                : `M8 output Zod warnings: ${amce.errors.join("; ")}`,
            status: amce.passed ? "SUCCESS" : "FAILED",
            rollback_action: amce.passed ? "none" : "Log warning; continue (ALERT_ONLY)",
            latency_ms: Date.now() - startTime,
            cost: 0,
            rubric_category: "constraint_evaluation",
        });

        return output;
    }

    private async analyzeOne(
        insight: Insight,
        constraints: Constraints,
        pipelineId: string
    ): Promise<ImpactAnalysis> {
        const prompt = this.buildPrompt(insight, constraints);

        try {
            const raw = await this.llmComplete(pipelineId, prompt, false, "impact_analysis");
            const parsed = this.parseLLMJSON<ImpactAnalysis>(raw);
            if (parsed && parsed.primary_impact) {
                const merged = this.normalize(parsed, insight, constraints);
                return merged;
            }
        } catch {
            // fall through
        }

        return this.deterministicFallback(insight, constraints);
    }

    private buildPrompt(insight: Insight, constraints: Constraints): string {
        return `You are an operations strategist. Analyze the BUSINESS IMPACT of this insight and surface 2-3 explicit constraint-tradeoff options.

INSIGHT:
- Title: ${insight.title}
- Description: ${insight.description}
- Category: ${insight.category}
- Severity: ${insight.severity}
- Data points: ${insight.data_points.join(", ")}
- Affected entities: ${insight.affected_entities.join(", ") || "(none specified)"}

CONSTRAINTS:
- Budget limit: ${constraints.budget_limit.amount} ${constraints.budget_limit.currency}
- Time limit: ${constraints.time_limit.max_duration_hours} hours
- Urgency: ${constraints.urgency_level}

RULES FOR OPTIONS:
- Generate 2-3 OPTIONS that trade COST vs TIME (e.g. cheap+slow, fast+expensive, balanced).
- Each option must include cost_pkr (>= 0), time_hours (>= 0), affected_customers (>= 0), and a rationale.
- tradeoff ∈ {"lowest_cost", "fastest_resolution", "balanced", "lowest_risk"}.

Respond with ONLY valid JSON, no markdown:
{
  "primary_impact": "one sentence summary of the main business impact",
  "impact_category": "revenue" | "cost" | "risk" | "compliance" | "reputation" | "operational",
  "impact_severity": "critical" | "high" | "medium" | "low",
  "quantified_impact": {
    "estimated_cost": <number in PKR or null>,
    "estimated_time_hours": <number or null>,
    "affected_count": <number of customers/units or null>,
    "cost_pkr": <number, >= 0>,
    "affected_customers": <integer, >= 0>
  },
  "constraints_violated": ["budget" if estimated_cost > budget_limit, "time" if estimated_time > limit],
  "time_horizon": "immediate" | "short_term" | "medium_term" | "long_term",
  "cascading_effects": ["effect 1", "effect 2"],
  "risk_if_ignored": "what happens if no action is taken",
  "options": [
    {
      "option_id": "OPT-A",
      "label": "Emergency restock via premium air freight",
      "tradeoff": "fastest_resolution",
      "cost_pkr": 480000,
      "time_hours": 6,
      "affected_customers": 50,
      "rationale": "Highest cost but resolves stockout inside 6 h, protects critical SLA"
    },
    {
      "option_id": "OPT-B",
      "label": "Standard freight + customer queueing",
      "tradeoff": "lowest_cost",
      "cost_pkr": 180000,
      "time_hours": 48,
      "affected_customers": 200,
      "rationale": "Cheapest path; ~200 customers see 1-2 day delay"
    }
  ]
}`;
    }

    private normalize(
        parsed: ImpactAnalysis,
        insight: Insight,
        constraints: Constraints
    ): ImpactAnalysis {
        // Ensure 2-3 options always present and well-formed.
        const options = this.sanitizeOptions(parsed.options, insight, constraints);

        // Ensure cost_pkr / affected_customers fields propagate up to quantified_impact.
        const aggregateCostPkr =
            Math.min(...options.map((o) => o.cost_pkr).filter((n) => isFinite(n))) || 0;
        const aggregateCustomers =
            Math.max(...options.map((o) => o.affected_customers).filter((n) => isFinite(n))) || 0;

        return {
            insight_id: insight.insight_id,
            primary_impact: parsed.primary_impact || `Impact for ${insight.title}`,
            impact_category: parsed.impact_category ?? (SEVERITY_TO_CATEGORY[insight.severity] ?? "operational"),
            impact_severity: parsed.impact_severity ?? insight.severity,
            quantified_impact: {
                estimated_cost: parsed.quantified_impact?.estimated_cost ?? aggregateCostPkr,
                estimated_time_hours: parsed.quantified_impact?.estimated_time_hours ?? options[0]?.time_hours ?? null,
                affected_count: parsed.quantified_impact?.affected_count ?? aggregateCustomers,
                cost_pkr: parsed.quantified_impact?.cost_pkr ?? aggregateCostPkr,
                affected_customers: parsed.quantified_impact?.affected_customers ?? aggregateCustomers,
            },
            constraints_violated: Array.isArray(parsed.constraints_violated)
                ? parsed.constraints_violated
                : [],
            time_horizon: parsed.time_horizon ?? (SEVERITY_TO_HORIZON[insight.severity] ?? "short_term"),
            cascading_effects: Array.isArray(parsed.cascading_effects) ? parsed.cascading_effects : [],
            risk_if_ignored:
                parsed.risk_if_ignored ||
                `Insight '${insight.title}' left unaddressed — see severity ${insight.severity}`,
            options,
        };
    }

    private sanitizeOptions(
        raw: ImpactOption[] | undefined,
        insight: Insight,
        constraints: Constraints
    ): ImpactOption[] {
        const allowedTradeoffs = new Set<ImpactOption["tradeoff"]>([
            "lowest_cost",
            "fastest_resolution",
            "balanced",
            "lowest_risk",
        ]);

        const normalized: ImpactOption[] = Array.isArray(raw)
            ? raw.map((o, i) => ({
                  option_id: o.option_id || `OPT-${String.fromCharCode(65 + i)}`,
                  label: o.label || `Option ${i + 1}`,
                  tradeoff: allowedTradeoffs.has(o.tradeoff) ? o.tradeoff : "balanced",
                  cost_pkr: Math.max(0, Number(o.cost_pkr) || 0),
                  time_hours: Math.max(0, Number(o.time_hours) || 0),
                  affected_customers: Math.max(0, Math.round(Number(o.affected_customers) || 0)),
                  rationale: o.rationale || "Tradeoff option proposed by the impact analyzer",
              }))
            : [];

        // Clamp to 3.
        const clamped = normalized.slice(0, 3);

        // Pad to 2 with deterministic templates so the schema (min 2) is always satisfied.
        if (clamped.length < 2) {
            const seeded = this.seedOptions(insight, constraints);
            for (const seed of seeded) {
                if (clamped.length >= 2) break;
                if (!clamped.some((c) => c.tradeoff === seed.tradeoff)) clamped.push(seed);
            }
        }
        return clamped.slice(0, 3);
    }

    private seedOptions(insight: Insight, constraints: Constraints): ImpactOption[] {
        const baseCost = insight.severity === "critical" ? 450000 : insight.severity === "high" ? 200000 : 80000;
        const fastCost = Math.min(baseCost, constraints.budget_limit.amount);
        const cheapCost = Math.round(fastCost * 0.35);

        return [
            {
                option_id: "OPT-A",
                label: "Fastest resolution (premium freight / overtime)",
                tradeoff: "fastest_resolution",
                cost_pkr: fastCost,
                time_hours: 6,
                affected_customers: 40,
                rationale: `Resolves the ${insight.severity} ${insight.category} inside 6 h, highest cost, narrow customer impact`,
            },
            {
                option_id: "OPT-B",
                label: "Lowest cost (standard logistics + customer queueing)",
                tradeoff: "lowest_cost",
                cost_pkr: cheapCost,
                time_hours: 48,
                affected_customers: 200,
                rationale: `Cheapest path; ~200 customers see 1-2 day delay`,
            },
            {
                option_id: "OPT-C",
                label: "Balanced (split shipment + targeted notifications)",
                tradeoff: "balanced",
                cost_pkr: Math.round((fastCost + cheapCost) / 2),
                time_hours: 18,
                affected_customers: 90,
                rationale: `Compromise — half budget, half timeline, mid-impact`,
            },
        ];
    }

    private deterministicFallback(insight: Insight, constraints: Constraints): ImpactAnalysis {
        const sev = insight.severity;
        const constraintsViolated: string[] = [];
        const options = this.sanitizeOptions(undefined, insight, constraints);

        const estimatedCost = options[0]?.cost_pkr ?? 200000;
        if (estimatedCost > constraints.budget_limit.amount) constraintsViolated.push("budget");

        const estimatedTime = options[0]?.time_hours ?? 8;
        if (estimatedTime > constraints.time_limit.max_duration_hours) constraintsViolated.push("time");

        return {
            insight_id: insight.insight_id,
            primary_impact: `${insight.title} — requires immediate operational response`,
            impact_category: SEVERITY_TO_CATEGORY[sev] ?? "operational",
            impact_severity: sev,
            quantified_impact: {
                estimated_cost: estimatedCost,
                estimated_time_hours: estimatedTime,
                affected_count: options[0]?.affected_customers ?? 50,
                cost_pkr: estimatedCost,
                affected_customers: options[0]?.affected_customers ?? 50,
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
            options,
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

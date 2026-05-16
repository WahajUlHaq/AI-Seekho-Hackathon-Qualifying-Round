import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput, RetryContext } from "./base.agent";
import { InsightExtractionOutput } from "./insight-extraction.agent";
import { TemporalAnalysisOutput, MetricAnalysis } from "./temporal-analysis.agent";

export type Horizon = "30-day" | "60-day" | "90-day";
export type ReliabilityFlag = "reliable" | "extrapolation_unreliable";

export interface ForecastScenario {
    horizon: Horizon;
    scenario: string;
    confidence: number;                       // 0..1
    derived_from_metrics: string[];           // metric names referenced
    reliability_flag: ReliabilityFlag;
}

export interface PredictiveForecasterInput extends AgentInput {
    insights: InsightExtractionOutput;
    temporal: TemporalAnalysisOutput;
}

export interface PredictiveForecasterOutput extends AgentOutput {
    strategic_id: string;
    generated_at: string;
    forecastingScenarios: ForecastScenario[];
    strategyProposal: null;                   // progressive — M10 fills this
}

const HORIZONS: Horizon[] = ["30-day", "60-day", "90-day"];
const STABLE_VOLATILITY_RATIO = 0.3;

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

function clampUnit(n: number): number {
    if (typeof n !== "number" || Number.isNaN(n)) return 0.5;
    return Math.max(0, Math.min(1, n));
}

export class PredictiveForecasterAgent extends BaseAgent<
    PredictiveForecasterInput,
    PredictiveForecasterOutput
> {
    constructor() {
        super("PredictiveForecasterAgent", "strategic_recommendation_v1");
    }

    protected async execute(
        input: PredictiveForecasterInput,
        retryContext?: RetryContext
    ): Promise<PredictiveForecasterOutput> {
        const { pipeline_id, insights, temporal } = input;

        const unreliableMetrics = this.detectUnreliableMetrics(pipeline_id, temporal.metrics);

        const rawScenarios = await this.projectScenarios(
            pipeline_id,
            insights,
            temporal.metrics,
            !!retryContext
        );

        const stamped = rawScenarios.map(s => ({
            ...s,
            reliability_flag: this.computeReliabilityFlag(s.derived_from_metrics, unreliableMetrics),
        }));

        const completeScenarios = this.ensureAllHorizons(stamped, temporal.metrics);

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            strategic_id: makeId("STR"),
            generated_at: new Date().toISOString(),
            forecastingScenarios: completeScenarios,
            strategyProposal: null,
        };
    }

    private detectUnreliableMetrics(
        pipelineId: string,
        metrics: MetricAnalysis[]
    ): Set<string> {
        const unreliable = new Set<string>();
        for (const m of metrics) {
            const denom = Math.max(Math.abs(m.meanValue), 1);
            const ratio = Math.abs(m.stdDev) / denom;
            const internallyInconsistent =
                m.classification === "Stable" && ratio > STABLE_VOLATILITY_RATIO;
            if (internallyInconsistent) {
                this.logDecision(
                    pipelineId,
                    `Metric "${m.metric}" flagged Stable but stdDev/meanValue=${ratio.toFixed(2)} exceeds ${STABLE_VOLATILITY_RATIO}`,
                    "extrapolation_unreliable",
                    0.85
                );
                unreliable.add(m.metric);
            }
        }
        return unreliable;
    }

    private computeReliabilityFlag(
        derivedFrom: string[],
        unreliable: Set<string>
    ): ReliabilityFlag {
        return derivedFrom.some(name => unreliable.has(name))
            ? "extrapolation_unreliable"
            : "reliable";
    }

    private async projectScenarios(
        pipelineId: string,
        insights: InsightExtractionOutput,
        metrics: MetricAnalysis[],
        useBaseModel: boolean
    ): Promise<Omit<ForecastScenario, "reliability_flag">[]> {
        const mathTable = metrics
            .map(m => `  - ${m.metric}: classification=${m.classification}, slope=${m.slope.toFixed(4)}, stdDev=${m.stdDev.toFixed(2)}, mean=${m.meanValue.toFixed(2)}, n=${m.dataPoints}`)
            .join("\n") || "  (no temporal metrics available)";

        const topRisks = insights.risks
            .slice(0, 3)
            .map(r => `${r.severity}: ${r.title}`)
            .join("; ") || "(none)";
        const topTrends = insights.trends
            .slice(0, 3)
            .map(t => t.title)
            .join("; ") || "(none)";

        const prompt = `You are a predictive analyst. Extrapolate the mathematical temporal patterns and qualitative insights below into 30-day, 60-day, and 90-day forward scenarios.

MATHEMATICAL TEMPORAL METRICS (Phase 2 output):
${mathTable}

QUALITATIVE CONTEXT:
  Top risks: ${topRisks}
  Top trends: ${topTrends}

Reply with ONLY valid JSON in this exact shape:
{
  "scenarios": [
    {
      "horizon": "30-day",
      "scenario": "concrete narrative description of the projected state at this horizon",
      "confidence": 0.0,
      "derived_from_metrics": ["metric_name_1", "metric_name_2"]
    },
    { "horizon": "60-day", ... },
    { "horizon": "90-day", ... }
  ]
}

Requirements:
- Exactly three entries with horizons "30-day", "60-day", "90-day" (no other values)
- confidence must be a number between 0 and 1; confidence should decrease as horizon lengthens
- derived_from_metrics must cite at least one metric name from the table above (use the exact metric name string)
- scenario should be 1-3 sentences; quantify where possible by extrapolating the slope`;

        try {
            const response = await this.llmComplete(pipelineId, prompt, useBaseModel, "scenario_projection");
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed.scenarios)) {
                    return parsed.scenarios
                        .filter((s: any) => s && HORIZONS.includes(s.horizon))
                        .map((s: any) => ({
                            horizon: s.horizon as Horizon,
                            scenario: typeof s.scenario === "string" && s.scenario.trim()
                                ? s.scenario.trim()
                                : `Projection for ${s.horizon} unavailable.`,
                            confidence: clampUnit(s.confidence),
                            derived_from_metrics: Array.isArray(s.derived_from_metrics)
                                ? s.derived_from_metrics.filter((x: any) => typeof x === "string")
                                : [],
                        }));
                }
            }
        } catch {
            // fall through to stub generation
        }

        return [];
    }

    private ensureAllHorizons(
        scenarios: ForecastScenario[],
        metrics: MetricAnalysis[]
    ): ForecastScenario[] {
        const byHorizon = new Map<Horizon, ForecastScenario>();
        for (const s of scenarios) {
            byHorizon.set(s.horizon, s);
        }

        const allMetricNames = metrics.map(m => m.metric);
        const result: ForecastScenario[] = [];

        for (const h of HORIZONS) {
            const existing = byHorizon.get(h);
            if (existing) {
                result.push(existing);
                continue;
            }
            // Stub fallback — confidence decays with distance
            const decay = h === "30-day" ? 0.4 : h === "60-day" ? 0.25 : 0.15;
            result.push({
                horizon: h,
                scenario: `Projection for ${h} unavailable from LLM; placeholder generated from Phase 2 baseline.`,
                confidence: decay,
                derived_from_metrics: allMetricNames.slice(0, 2),
                reliability_flag: "extrapolation_unreliable",
            });
        }

        return result;
    }
}

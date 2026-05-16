import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput, RetryContext } from "./base.agent";
import { InsightExtractionOutput } from "./insight-extraction.agent";
import { ImpactScorerOutput } from "./impact-scorer.agent";
import {
    PredictiveForecasterOutput,
    ForecastScenario,
    Horizon,
} from "./predictive-forecaster.agent";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ProposedAction {
    action_id: string;                              // ACT-XXXXXX (6-char)
    title: string;
    description: string;
    priority: Priority;
    depends_on: string[];                           // upstream action_ids
}

export interface StrategyProposal {
    proposedActions: ProposedAction[];
    rationale: string;                              // must reference >= 1 horizon
    overall_priority: Priority;
}

export interface StrategicRecommenderInput extends AgentInput {
    insights: InsightExtractionOutput;
    impactAnalysis: ImpactScorerOutput;
    forecast: PredictiveForecasterOutput;
}

export interface StrategicRecommenderOutput extends AgentOutput {
    strategic_id: string;
    generated_at: string;
    forecastingScenarios: ForecastScenario[];       // PROPAGATED from M9
    strategyProposal: StrategyProposal;
}

const HORIZONS: Horizon[] = ["30-day", "60-day", "90-day"];
const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const ACTION_ID_RE = /^ACT-[A-Z0-9]{6}$/;

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

function makeActionId(): string {
    return `ACT-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, 6)}`;
}

function coercePriority(p: unknown): Priority {
    if (typeof p === "string" && PRIORITIES.includes(p.toUpperCase() as Priority)) {
        return p.toUpperCase() as Priority;
    }
    return "MEDIUM";
}

export class StrategicRecommenderAgent extends BaseAgent<
    StrategicRecommenderInput,
    StrategicRecommenderOutput
> {
    constructor() {
        super("StrategicRecommenderAgent", "strategic_recommendation_v1");
    }

    protected async execute(
        input: StrategicRecommenderInput,
        retryContext?: RetryContext
    ): Promise<StrategicRecommenderOutput> {
        const { pipeline_id, insights, impactAnalysis, forecast } = input;

        const proposalRaw = await this.proposeStrategy(
            pipeline_id,
            insights,
            impactAnalysis,
            forecast,
            !!retryContext
        );

        const sanitized = this.sanitizeProposal(pipeline_id, proposalRaw, forecast.forecastingScenarios);

        this.logDecision(
            pipeline_id,
            `Strategy proposed with ${sanitized.proposedActions.length} action(s); overall priority ${sanitized.overall_priority}`,
            "strategy_finalized",
            retryContext ? 0.7 : 0.85
        );

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            strategic_id: makeId("STR"),
            generated_at: new Date().toISOString(),
            forecastingScenarios: forecast.forecastingScenarios,
            strategyProposal: sanitized,
        };
    }

    private async proposeStrategy(
        pipelineId: string,
        insights: InsightExtractionOutput,
        impact: ImpactScorerOutput,
        forecast: PredictiveForecasterOutput,
        useBaseModel: boolean
    ): Promise<StrategyProposal> {
        const prompt = this.buildDefensivePrompt(insights, impact, forecast);

        try {
            const response = await this.llmComplete(pipelineId, prompt, useBaseModel, "strategy_recommendation");
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                const actions: ProposedAction[] = Array.isArray(parsed.proposedActions)
                    ? parsed.proposedActions.map((a: any) => ({
                          action_id: typeof a.action_id === "string" && ACTION_ID_RE.test(a.action_id)
                              ? a.action_id
                              : makeActionId(),
                          title: typeof a.title === "string" ? a.title : "Untitled action",
                          description: typeof a.description === "string" ? a.description : "(no description)",
                          priority: coercePriority(a.priority),
                          depends_on: Array.isArray(a.depends_on) ? a.depends_on.filter((x: any) => typeof x === "string") : [],
                      }))
                    : [];

                return {
                    proposedActions: actions,
                    rationale: typeof parsed.rationale === "string" && parsed.rationale.trim()
                        ? parsed.rationale.trim()
                        : `Plan derived from impact score ${impact.impactMagnitudeScore}/100 and the 30-day forecast.`,
                    overall_priority: coercePriority(parsed.overall_priority),
                };
            }
        } catch {
            // fall through to deterministic fallback
        }

        return this.fallbackProposal(impact, forecast);
    }

    /**
     * Defensive prompt: key signal at top AND bottom, structured sections, anti-LITM.
     */
    private buildDefensivePrompt(
        insights: InsightExtractionOutput,
        impact: ImpactScorerOutput,
        forecast: PredictiveForecasterOutput
    ): string {
        const horizonBlock = forecast.forecastingScenarios
            .map(s => `  ${s.horizon}: [${s.reliability_flag}, conf=${s.confidence.toFixed(2)}] ${s.scenario}`)
            .join("\n");

        const topRisks = insights.risks
            .slice(0, 3)
            .map(r => `[${r.severity}] ${r.title}`)
            .join("; ") || "(none)";
        const topTrends = insights.trends
            .slice(0, 3)
            .map(t => `${t.title} (conf ${t.confidence.toFixed(2)})`)
            .join("; ") || "(none)";
        const persistentConflicts = insights.persistentConflicts
            .slice(0, 2)
            .map(c => c.topic)
            .join("; ") || "(none)";

        const question = `Produce a prioritized strategic action plan (3-5 actions). Output JSON: { "proposedActions": [...], "rationale": "...", "overall_priority": "..." }. Each action needs: action_id (ACT- + 6 uppercase alphanumerics), title, description, priority (CRITICAL|HIGH|MEDIUM|LOW), depends_on (array of earlier action_ids; first action must have []). The rationale MUST mention at least one of "30-day", "60-day", "90-day" explicitly.`;

        return `=== STRATEGIC DECISION REQUEST ===

${question}

--- SECTION A: EXECUTIVE SIGNAL ---
Impact Magnitude Score: ${impact.impactMagnitudeScore}/100
Component Breakdown:    financial=${impact.componentScores.financial}, operational=${impact.componentScores.operational}, reputational=${impact.componentScores.reputational}
Impact Reasoning:       ${impact.reasoning}

--- SECTION B: 30/60/90-DAY FORECAST (primary decision driver) ---
${horizonBlock || "  (no forecast available)"}

--- SECTION C: PHASE 2 SIGNALS (compressed) ---
Top risks:             ${topRisks}
Top trends:            ${topTrends}
Persistent conflicts:  ${persistentConflicts}

--- SECTION D: RULES ---
- 3 to 5 actions, ordered by execution sequence (first action runnable immediately).
- depends_on entries must reference action_ids appearing EARLIER in the proposedActions list.
- Priority must escalate with impact magnitude: score >= 75 generally implies at least one CRITICAL action.
- rationale must EXPLICITLY contain at least one of these literals: "30-day", "60-day", "90-day".

=== QUESTION (RE-STATED) ===
${question}

Reply with ONLY valid JSON, nothing else.`;
    }

    /**
     * Drop dangling depends_on refs, regenerate malformed action_ids,
     * inject a horizon literal into rationale if absent.
     */
    private sanitizeProposal(
        pipelineId: string,
        raw: StrategyProposal,
        scenarios: ForecastScenario[]
    ): StrategyProposal {
        const seen = new Set<string>();
        const cleanedActions: ProposedAction[] = [];
        let droppedDeps = 0;

        for (const action of raw.proposedActions) {
            const action_id = ACTION_ID_RE.test(action.action_id) ? action.action_id : makeActionId();
            const validDeps = action.depends_on.filter(dep => {
                if (seen.has(dep)) return true;
                droppedDeps++;
                return false;
            });
            cleanedActions.push({
                action_id,
                title: action.title,
                description: action.description,
                priority: action.priority,
                depends_on: validDeps,
            });
            seen.add(action_id);
        }

        if (droppedDeps > 0) {
            this.logDecision(
                pipelineId,
                `Dropped ${droppedDeps} dangling depends_on reference(s) from strategy proposal`,
                "dependency_scrubbed",
                0.9
            );
        }

        // Sanitize phantom action_id refs in rationale: any ACT- token not present in
        // the sanitized proposedActions set is replaced with a safe generic label so
        // the freeform rationale string never advertises non-existent IDs.
        const phantomRegex = /ACT-[A-Z0-9]+/g;
        const phantomMatches = raw.rationale.match(phantomRegex) ?? [];
        const phantomCount = phantomMatches.filter(m => !seen.has(m)).length;
        let sanitizedRationale = raw.rationale.replace(phantomRegex, (match) =>
            seen.has(match) ? match : "[Proposed Action]"
        );
        if (phantomCount > 0) {
            this.logDecision(
                pipelineId,
                `Replaced ${phantomCount} phantom action_id reference(s) in rationale with safe label`,
                "phantom_id_scrubbed",
                0.9
            );
        }

        const hasHorizon = HORIZONS.some(h => sanitizedRationale.includes(h));
        const firstHorizon = scenarios[0]?.horizon ?? "30-day";
        if (!hasHorizon) {
            sanitizedRationale = `${sanitizedRationale} Aligned with the ${firstHorizon} forecast.`;
        }

        return {
            proposedActions: cleanedActions,
            rationale: sanitizedRationale,
            overall_priority: raw.overall_priority,
        };
    }

    private fallbackProposal(
        impact: ImpactScorerOutput,
        forecast: PredictiveForecasterOutput
    ): StrategyProposal {
        const score = impact.impactMagnitudeScore;
        const overall: Priority = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
        const a1 = makeActionId();
        const a2 = makeActionId();
        const a3 = makeActionId();
        const firstHorizon = forecast.forecastingScenarios[0]?.horizon ?? "30-day";

        return {
            proposedActions: [
                {
                    action_id: a1,
                    title: "Convene rapid-response review",
                    description: `Schedule a working session within ${firstHorizon === "30-day" ? "72 hours" : "1 week"} to validate the impact assessment (${score}/100) and assign owners for each component bucket.`,
                    priority: overall,
                    depends_on: [],
                },
                {
                    action_id: a2,
                    title: "Mitigate top-weight component",
                    description: `Initiate concrete mitigation for the highest-weight component (financial bucket = ${impact.componentScores.financial}); produce a 1-page risk register by end of week.`,
                    priority: overall === "CRITICAL" ? "CRITICAL" : "HIGH",
                    depends_on: [a1],
                },
                {
                    action_id: a3,
                    title: "Validate forecast assumptions",
                    description: `Stress-test the ${firstHorizon} scenario by reviewing the underlying temporal metrics with the data team; flag any extrapolation_unreliable entries for re-measurement.`,
                    priority: "MEDIUM",
                    depends_on: [a1],
                },
            ],
            rationale: `LLM strategy synthesis fell back to a deterministic 3-action skeleton anchored on the ${firstHorizon} forecast and an impact score of ${score}/100. Manual refinement recommended before execution.`,
            overall_priority: overall,
        };
    }
}

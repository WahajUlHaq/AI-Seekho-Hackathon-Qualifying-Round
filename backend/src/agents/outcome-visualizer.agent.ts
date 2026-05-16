import { BaseAgent, AgentInput, AgentOutput, RetryContext } from "./base.agent";
import { ExecutionSimulatorOutput } from "./execution-simulator.agent";
import { FailureRecoveryOutput } from "./failure-recovery.agent";
import { ImpactScorerOutput } from "./impact-scorer.agent";
import { PredictiveForecasterOutput } from "./predictive-forecaster.agent";

export interface OutcomeVisualizerInput extends AgentInput {
    execution: ExecutionSimulatorOutput;
    recovery: FailureRecoveryOutput;
    impact: ImpactScorerOutput;
    forecast: PredictiveForecasterOutput;
}

export interface OutcomeVisualizerOutput extends AgentOutput {
    pipelineId: string;
    total_cost: number;
    projected_risk_reduction: number;       // 0..100
    simulated_latency_saved: number;        // ms vs manual baseline
    before_state_summary: string;
    after_state_summary: string;
    qualitative_diff: string;
}

const PER_ACTION_COST = 1500;               // mock PKR per attempted action
const MANUAL_BASELINE_MS_PER_ACTION = 5000; // hypothetical human-handled baseline
const ACT_ID_RE = /ACT-[A-Z0-9]+/;

export class OutcomeVisualizerAgent extends BaseAgent<
    OutcomeVisualizerInput,
    OutcomeVisualizerOutput
> {
    constructor() {
        super("OutcomeVisualizerAgent", "outcome_visualization_v1");
    }

    protected async execute(
        input: OutcomeVisualizerInput,
        _retryContext?: RetryContext
    ): Promise<OutcomeVisualizerOutput> {
        const { pipeline_id, execution, recovery, impact, forecast } = input;

        const attempted = execution.execution_results.filter(r => r.status !== "SKIPPED").length;
        const successes = execution.execution_results.filter(r => r.status === "SUCCESS").length;
        const total_cost = attempted * PER_ACTION_COST;

        const totalActions = execution.execution_results.length || 1;
        const successRate = successes / totalActions;
        const projected_risk_reduction = Math.max(
            0,
            Math.min(100, Math.round(successRate * impact.impactMagnitudeScore))
        );

        const manualBaseline = attempted * MANUAL_BASELINE_MS_PER_ACTION;
        const simulated_latency_saved = Math.max(0, manualBaseline - execution.total_execution_ms);

        const narrative = await this.synthesizeNarrative(pipeline_id, input);

        // Sanitize: qualitative_diff must mention at least one ACT- id (semantic check)
        let qualitative_diff = narrative.qualitative_diff;
        if (!ACT_ID_RE.test(qualitative_diff)) {
            const firstAct = execution.execution_results[0]?.action_id ?? "ACT-UNKNOWN";
            qualitative_diff = `${qualitative_diff} Action ${firstAct} was the primary execution anchor.`;
        }

        this.logDecision(
            pipeline_id,
            `Outcome: cost=${total_cost}, risk-reduction=${projected_risk_reduction}%, latency-saved=${simulated_latency_saved}ms`,
            "outcome_visualized",
            0.9
        );

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            pipelineId: pipeline_id,
            total_cost,
            projected_risk_reduction,
            simulated_latency_saved,
            before_state_summary: narrative.before_state_summary,
            after_state_summary: narrative.after_state_summary,
            qualitative_diff,
        };
    }

    private async synthesizeNarrative(
        pipelineId: string,
        input: OutcomeVisualizerInput
    ): Promise<{ before_state_summary: string; after_state_summary: string; qualitative_diff: string }> {
        const { execution, recovery, impact, forecast } = input;

        const execSummary = execution.execution_results
            .slice(0, 8)
            .map(r => `  ${r.action_id}: ${r.status}${r.error_message ? ` (${r.error_message})` : ""}`)
            .join("\n");

        const horizons = forecast.forecastingScenarios
            .map(s => `${s.horizon}: ${s.scenario.slice(0, 120)}`)
            .join("\n");

        const prompt = `You are an operations analyst producing a before/after outcome narrative.

INPUT SIGNAL
Impact magnitude score: ${impact.impactMagnitudeScore}/100 (F=${impact.componentScores.financial} O=${impact.componentScores.operational} R=${impact.componentScores.reputational})
Forecast horizons:
${horizons}

EXECUTION RESULTS (M11)
overall_status: ${execution.overall_status}
total_execution_ms: ${execution.total_execution_ms}
actions:
${execSummary}

RECOVERY (M12)
recovery_plan entries: ${recovery.recovery_plan.length}
cascaded_skips: ${recovery.cascaded_skips.length}

Reply with ONLY valid JSON in this exact shape (no preamble, no markdown):
{
  "before_state_summary": "2-3 sentences describing the operational state BEFORE these actions ran",
  "after_state_summary": "2-3 sentences describing the operational state AFTER (or projected after) these actions",
  "qualitative_diff": "2-4 sentences explaining the net change; MUST reference at least one specific ACT- action_id from the execution results above"
}`;

        try {
            const raw = await this.llmComplete(pipelineId, prompt, false, "outcome_narrative_synthesis");
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return {
                    before_state_summary: typeof parsed.before_state_summary === "string" && parsed.before_state_summary.trim()
                        ? parsed.before_state_summary.trim()
                        : "Operational baseline prior to action execution.",
                    after_state_summary: typeof parsed.after_state_summary === "string" && parsed.after_state_summary.trim()
                        ? parsed.after_state_summary.trim()
                        : "Post-execution state reflecting the strategic actions.",
                    qualitative_diff: typeof parsed.qualitative_diff === "string" && parsed.qualitative_diff.trim()
                        ? parsed.qualitative_diff.trim()
                        : `Net change driven by ${execution.execution_results.length} actions with ${execution.overall_status} overall outcome.`,
                };
            }
        } catch {
            // fall through to deterministic fallback
        }

        const first = execution.execution_results[0]?.action_id ?? "ACT-UNKNOWN";
        return {
            before_state_summary: `Baseline state pre-execution: impact magnitude ${impact.impactMagnitudeScore}/100, ${execution.execution_results.length} actions proposed.`,
            after_state_summary: `Post-execution: ${execution.overall_status}, total runtime ${execution.total_execution_ms}ms.`,
            qualitative_diff: `Action ${first} anchored the execution chain. Overall status ${execution.overall_status} with ${recovery.cascaded_skips.length} cascaded skips.`,
        };
    }
}

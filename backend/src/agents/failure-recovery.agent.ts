import { BaseAgent, AgentInput, AgentOutput, RetryContext } from "./base.agent";
import { ProposedAction } from "./strategic-recommender.agent";
import {
    ActionExecutionResult,
    ExecutionSimulatorOutput,
} from "./execution-simulator.agent";

export type RecoveryStrategy = "RETRY" | "FALLBACK" | "SKIP";
export type MitigationStatus = "PROPOSED" | "BLOCKED" | "RESOLVED";

export interface RecoveryEntry {
    intercepted_action_id: string;
    applied_strategy: RecoveryStrategy;
    mitigation_status: MitigationStatus;
    rationale: string;
}

export interface FailureRecoveryInput extends AgentInput {
    execution: ExecutionSimulatorOutput;
    originalActions: ProposedAction[];
}

export interface FailureRecoveryOutput extends AgentOutput {
    pipelineId: string;
    recovery_plan: RecoveryEntry[];
    cascaded_skips: string[];
}

const STRATEGIES: RecoveryStrategy[] = ["RETRY", "FALLBACK", "SKIP"];
const STATUSES: MitigationStatus[] = ["PROPOSED", "BLOCKED", "RESOLVED"];

function coerceStrategy(v: unknown): RecoveryStrategy {
    if (typeof v === "string" && STRATEGIES.includes(v.toUpperCase() as RecoveryStrategy)) {
        return v.toUpperCase() as RecoveryStrategy;
    }
    return "SKIP";
}

function coerceStatus(v: unknown): MitigationStatus {
    if (typeof v === "string" && STATUSES.includes(v.toUpperCase() as MitigationStatus)) {
        return v.toUpperCase() as MitigationStatus;
    }
    return "BLOCKED";
}

export class FailureRecoveryAgent extends BaseAgent<
    FailureRecoveryInput,
    FailureRecoveryOutput
> {
    constructor() {
        super("FailureRecoveryAgent", "failure_recovery_v1");
    }

    protected async execute(
        input: FailureRecoveryInput,
        _retryContext?: RetryContext
    ): Promise<FailureRecoveryOutput> {
        const { pipeline_id, execution, originalActions } = input;

        const actionById = new Map<string, ProposedAction>(
            originalActions.map(a => [a.action_id, a])
        );

        const failed = execution.execution_results.filter(r => r.status === "FAILED");
        const cascaded_skips = execution.execution_results
            .filter(r => r.status === "SKIPPED")
            .map(r => r.action_id);

        const recovery_plan: RecoveryEntry[] = [];
        for (const failure of failed) {
            const entry = await this.proposeRecovery(pipeline_id, failure, actionById);
            recovery_plan.push(entry);
            this.logDecision(
                pipeline_id,
                `Recovery for ${failure.action_id}: ${entry.applied_strategy} (${entry.mitigation_status}) — ${entry.rationale}`,
                "recovery_proposed",
                0.85
            );
        }

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            pipelineId: pipeline_id,
            recovery_plan,
            cascaded_skips,
        };
    }

    private async proposeRecovery(
        pipelineId: string,
        failure: ActionExecutionResult,
        actionById: Map<string, ProposedAction>
    ): Promise<RecoveryEntry> {
        const action = actionById.get(failure.action_id);
        const actionContext = action
            ? `Title: ${action.title}\nDescription: ${action.description}\nPriority: ${action.priority}`
            : "(original action metadata unavailable)";

        const prompt = `An action in our automated execution pipeline has FAILED. Propose a recovery strategy.

ACTION CONTEXT:
${actionContext}

FAILURE INFO:
action_id: ${failure.action_id}
error_message: ${failure.error_message ?? "(no message)"}
latency_ms: ${failure.latency_ms}

Reply with ONLY valid JSON in this exact shape (no preamble, no markdown):
{
  "applied_strategy": "RETRY|FALLBACK|SKIP",
  "mitigation_status": "PROPOSED|BLOCKED|RESOLVED",
  "rationale": "one short sentence explaining the choice"
}

Choose strategy:
- RETRY if the error suggests a transient/network/timeout issue
- FALLBACK if an alternative approach is feasible
- SKIP if the action is not worth retrying

Choose mitigation_status:
- PROPOSED for any newly generated plan (default for this metadata-only flow)
- BLOCKED if no recovery is feasible at all`;

        try {
            const raw = await this.llmComplete(pipelineId, prompt, false, "recovery_strategy_synthesis");
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return {
                    intercepted_action_id: failure.action_id,
                    applied_strategy: coerceStrategy(parsed.applied_strategy),
                    mitigation_status: coerceStatus(parsed.mitigation_status),
                    rationale: typeof parsed.rationale === "string" && parsed.rationale.trim()
                        ? parsed.rationale.trim().slice(0, 240)
                        : `Default rationale: fall back to SKIP for ${failure.action_id}.`,
                };
            }
        } catch {
            // fall through
        }

        const errMsg = String(failure.error_message).toLowerCase();
        const isTransient = errMsg.includes("timeout") || errMsg.includes("network") || errMsg.includes("rate") || errMsg.includes("temp");
        const defaultStrategy = isTransient ? "RETRY" : "SKIP";
        const defaultStatus = isTransient ? "PROPOSED" : "BLOCKED";

        return {
            intercepted_action_id: failure.action_id,
            applied_strategy: defaultStrategy as any,
            mitigation_status: defaultStatus as any,
            rationale: `LLM recovery synthesis unavailable; adaptive fallback to ${defaultStrategy} based on error diagnostics.`,
        };
    }
}

import { BaseAgent, AgentInput, AgentOutput, RetryContext } from "./base.agent";
import { ProposedAction } from "./strategic-recommender.agent";
import { traceCollector } from "../tracing/collector";

export type ActionStatus = "SUCCESS" | "FAILED" | "SKIPPED";
export type OverallStatus = "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";

export interface ActionExecutionResult {
    action_id: string;
    status: ActionStatus;
    latency_ms: number;
    error_message?: string;
    output_summary?: string;
}

export interface ExecutionSimulatorInput extends AgentInput {
    actions: ProposedAction[];                  // already topologically sorted
    approved_by: string;
    approval_timestamp: string;
}

export interface ExecutionSimulatorOutput extends AgentOutput {
    pipelineId: string;                         // contract field (camelCase)
    overall_status: OverallStatus;
    approved_by?: string;
    approval_timestamp: string;
    total_execution_ms: number;
    execution_results: ActionExecutionResult[];
}

const FAILURE_RATE = 0.15;
const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 800;

function randomDelayMs(): number {
    return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

export class ExecutionSimulatorAgent extends BaseAgent<
    ExecutionSimulatorInput,
    ExecutionSimulatorOutput
> {
    constructor() {
        super("ExecutionSimulatorAgent", "action_chain_v1");
    }

    protected async execute(
        input: ExecutionSimulatorInput,
        _retryContext?: RetryContext
    ): Promise<ExecutionSimulatorOutput> {
        const { pipeline_id, actions, approved_by, approval_timestamp } = input;

        const tainted = new Set<string>();           // ids that FAILED or were SKIPPED
        const results: ActionExecutionResult[] = [];

        for (const action of actions) {
            const upstreamTainted = action.depends_on.some(dep => tainted.has(dep));

            traceCollector.log(pipeline_id, {
                pipeline_id,
                event_type: "action_start",
                agent: this.agentName,
                message: `Action ${action.action_id} starting (${action.title})`,
                data: {
                    action_id: action.action_id,
                    priority: action.priority,
                    depends_on: action.depends_on,
                    will_skip: upstreamTainted,
                },
            });

            if (upstreamTainted) {
                const skipResult: ActionExecutionResult = {
                    action_id: action.action_id,
                    status: "SKIPPED",
                    latency_ms: 0,
                    error_message: "Upstream dependency failed or was skipped",

                };
                results.push(skipResult);
                tainted.add(action.action_id);

                traceCollector.log(pipeline_id, {
                    pipeline_id,
                    event_type: "action_complete",
                    agent: this.agentName,
                    message: `Action ${action.action_id} SKIPPED (upstream FAILED)`,
                    latency_ms: 0,
                    data: { action_id: action.action_id, status: "SKIPPED" },
                });
                continue;
            }

            const start = Date.now();
            const delay = randomDelayMs();
            await sleep(delay);

            const willFail = Math.random() < FAILURE_RATE;
            let result: ActionExecutionResult;

            if (willFail) {
                const errorMessage = await this.synthesizeFailureCause(pipeline_id, action);
                result = {
                    action_id: action.action_id,
                    status: "FAILED",
                    latency_ms: Date.now() - start,
                    error_message: errorMessage,
                };
                tainted.add(action.action_id);
            } else {
                const summary = await this.synthesizeSuccessSummary(pipeline_id, action);
                result = {
                    action_id: action.action_id,
                    status: "SUCCESS",
                    latency_ms: Date.now() - start,
                    output_summary: summary,
                };
            }
            results.push(result);

            traceCollector.log(pipeline_id, {
                pipeline_id,
                event_type: "action_complete",
                agent: this.agentName,
                message: `Action ${action.action_id} ${result.status} in ${result.latency_ms}ms`,
                latency_ms: result.latency_ms,
                data: { action_id: action.action_id, status: result.status },
            });
        }

        const successCount = results.filter(r => r.status === "SUCCESS").length;
        const overall_status: OverallStatus =
            successCount === results.length ? "SUCCESS"
                : successCount === 0 ? "FAILED"
                    : "PARTIAL_SUCCESS";

        const total_execution_ms = results.reduce((sum, r) => sum + r.latency_ms, 0);

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            pipelineId: pipeline_id,
            overall_status,
            approved_by,
            approval_timestamp,
            total_execution_ms,
            execution_results: results,
        };
    }

    private async synthesizeFailureCause(
        pipelineId: string,
        action: ProposedAction
    ): Promise<string> {
        const prompt = `Simulated execution of action "${action.title}" (${action.description}) has failed. Give exactly ONE short sentence (max 20 words) describing one plausible cause of failure. Output only the sentence, no preamble.`;
        try {
            const raw = await this.llmComplete(pipelineId, prompt, false, "failure_cause_synthesis");
            return raw.trim().split("\n")[0].slice(0, 200) || "Simulated failure with unknown root cause.";
        } catch {
            return "Simulated failure (LLM unavailable to synthesize cause).";
        }
    }

    private async synthesizeSuccessSummary(
        pipelineId: string,
        action: ProposedAction
    ): Promise<string> {
        const prompt = `Simulated execution of action "${action.title}" (${action.description}) has succeeded. Give exactly ONE short sentence (max 20 words) describing the outcome. Output only the sentence, no preamble.`;
        try {
            const raw = await this.llmComplete(pipelineId, prompt, false, "success_outcome_synthesis");
            return raw.trim().split("\n")[0].slice(0, 200) || `Action ${action.action_id} executed successfully.`;
        } catch {
            return `Action ${action.action_id} executed successfully (LLM unavailable to synthesize summary).`;
        }
    }
}

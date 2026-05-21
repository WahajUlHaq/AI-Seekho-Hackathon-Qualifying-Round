import { llmClient } from "../utils/llm-client";
import { contractRegistry } from "../contracts/registry";
import { decisionGate } from "../contracts/decision-gate";
import { traceCollector } from "../tracing/collector";

export interface AgentInput {
    pipeline_id: string;
    [key: string]: unknown;
}

export interface AgentOutput {
    pipeline_id: string;
    agent_name: string;
    completed_at: string;
    [key: string]: unknown;
}

export interface RetryContext {
    attempt: number;
    previousErrors: string[];
}

export abstract class BaseAgent<
    TInput extends AgentInput,
    TOutput extends AgentOutput
> {
    protected readonly agentName: string;
    protected readonly contractName: string;
    protected readonly maxRetries: number = 2;

    constructor(agentName: string, contractName: string) {
        this.agentName = agentName;
        this.contractName = contractName;
    }

    async run(input: TInput): Promise<TOutput> {
        const { pipeline_id } = input;
        const runStart = Date.now();

        traceCollector.log(pipeline_id, {
            pipeline_id,
            event_type: "agent_start",
            agent: this.agentName,
            message: `${this.agentName} started`,
        });

        let output: TOutput | null = null;
        let lastAction: "PASS" | "WARN" | "REJECT" | "NO_CONTRACT" = "NO_CONTRACT";
        let lastErrors: string[] = [];

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            const retryContext: RetryContext | undefined =
                attempt > 1 ? { attempt, previousErrors: lastErrors } : undefined;

            output = await this.execute(input, retryContext);

            const contract = contractRegistry.get(this.contractName);
            if (contract) {
                const gateResult = await decisionGate.evaluate(output, contract);
                lastAction = gateResult.action;

                traceCollector.log(pipeline_id, {
                    ...gateResult.traceEvent,
                    pipeline_id,
                    agent: this.agentName,
                    message: `Contract gate: ${gateResult.action} (attempt ${attempt}/${this.maxRetries})`,
                });

                if (gateResult.action !== "REJECT") break;

                lastErrors = gateResult.errors;

                if (attempt < this.maxRetries) {
                    console.warn(
                        `[${this.agentName}] Contract REJECT on attempt ${attempt}, retrying with base model...`
                    );
                    traceCollector.log(pipeline_id, {
                        pipeline_id,
                        event_type: "recovery",
                        agent: this.agentName,
                        message: `Retrying after contract rejection (attempt ${attempt + 1}/${this.maxRetries}) — switching to base model`,
                    });
                }
            } else {
                break;
            }
        }

        const execution_duration_ms = Date.now() - runStart;

        traceCollector.log(pipeline_id, {
            pipeline_id,
            event_type: "agent_complete",
            agent: this.agentName,
            message: `${this.agentName} completed`,
            data: {
                validation_level: lastAction,
                execution_duration_ms,
            },
        });

        return output!;
    }

    protected abstract execute(
        input: TInput,
        retryContext?: RetryContext
    ): Promise<TOutput>;

    protected async llmComplete(
        pipelineId: string,
        prompt: string,
        useBaseModel = false,
        purpose = "inference"
    ): Promise<string> {
        const start = Date.now();
        const result = await llmClient.complete(prompt, useBaseModel);
        const latency_ms = Date.now() - start;

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "llm_call",
            agent: this.agentName,
            message: `LLM call: ${purpose}`,
            provider: process.env.PRIMARY_PROVIDER || "gemini-free",
            latency_ms,
            data: {
                tool: "llm_complete",
                purpose,
                use_base_model: useBaseModel,
                input_summary: prompt.slice(0, 150),
                output_summary: result.slice(0, 150),
            },
        });

        return result;
    }

    protected async llmEmbed(pipelineId: string, text: string): Promise<number[]> {
        const start = Date.now();
        const result = await llmClient.generateEmbedding(text);
        const latency_ms = Date.now() - start;

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "llm_call",
            agent: this.agentName,
            message: "Embedding generation",
            provider: "gemini-free",
            latency_ms,
            data: {
                tool: "generate_embedding",
                input_summary: text.slice(0, 100),
                output_summary: `${result.length}-dim vector`,
            },
        });

        return result;
    }

    protected logDecision(
        pipelineId: string,
        reasoning: string,
        decision: string,
        confidence: number
    ): void {
        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "decision",
            agent: this.agentName,
            message: reasoning,
            decision,
            confidence,
        });
    }
}

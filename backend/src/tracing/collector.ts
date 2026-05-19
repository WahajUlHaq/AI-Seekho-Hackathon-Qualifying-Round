import { v4 as uuidv4 } from "uuid";

export type TraceEventType =
    | "agent_start"
    | "agent_complete"
    | "llm_call"
    | "contract_gate"
    | "action_execute"
    | "failure"
    | "ingestion_error"
    | "recovery"
    | "decision"
    | "action_start"
    | "action_complete"
    | "graph_cycle_detected"
    | "hitl_pending"
    | "hitl_approved"
    | "hitl_rejected"
    | "thinking";

export interface TraceEvent {
    event_id: string;
    pipeline_id: string;
    timestamp: string;
    event_type: TraceEventType;
    agent: string;
    message: string;
    data?: Record<string, unknown>;
    decision?: string;
    confidence?: number;
    provider?: string;
    latency_ms?: number;
}

export interface PipelineTrace {
    pipeline_id: string;
    environment: string;
    ai_provider_used: string;
    started_at: string;
    completed_at?: string;
    workplan: string;
    task_plan: string[];
    reasoning_steps: Array<{
        step: number;
        agent: string;
        reasoning: string;
        decision: string;
        confidence: number;
    }>;
    tool_calls: Array<{
        tool: string;
        provider: string;
        input_summary: string;
        output_summary: string;
        latency_ms: number;
    }>;
    action_execution: TraceEvent[];
    recovery_steps: string[];
    events: TraceEvent[];
}

export class TraceCollector {
    private traces: Map<string, PipelineTrace> = new Map();

    initPipeline(pipelineId: string, workplan: string, taskPlan: string[]): void {
        this.traces.set(pipelineId, {
            pipeline_id: pipelineId,
            environment: process.env.APP_ENV || "development",
            ai_provider_used: process.env.PRIMARY_PROVIDER || "gemini-free",
            started_at: new Date().toISOString(),
            workplan,
            task_plan: taskPlan,
            reasoning_steps: [],
            tool_calls: [],
            action_execution: [],
            recovery_steps: [],
            events: [],
        });
    }

    log(pipelineId: string, event: Omit<TraceEvent, "event_id" | "timestamp">): void {
        const trace = this.traces.get(pipelineId);
        if (!trace) return;

        const full: TraceEvent = {
            event_id: uuidv4(),
            timestamp: new Date().toISOString(),
            ...event,
        };

        trace.events.push(full);

        if (event.event_type === "decision" && event.decision !== undefined) {
            trace.reasoning_steps.push({
                step: trace.reasoning_steps.length + 1,
                agent: event.agent,
                reasoning: event.message,
                decision: event.decision,
                confidence: event.confidence ?? 1.0,
            });
        }

        if (event.event_type === "llm_call") {
            const provider = event.provider ?? trace.ai_provider_used;
            if (trace.tool_calls.length === 0) {
                trace.ai_provider_used = provider;
            }
            trace.tool_calls.push({
                tool: (event.data?.tool as string) ?? "llm",
                provider,
                input_summary: (event.data?.input_summary as string) ?? event.message.slice(0, 100),
                output_summary: (event.data?.output_summary as string) ?? "",
                latency_ms: event.latency_ms ?? 0,
            });
        }

        if (
            event.event_type === "action_execute" ||
            event.event_type === "action_start" ||
            event.event_type === "action_complete"
        ) {
            trace.action_execution.push(full);
        }

        if (event.event_type === "recovery") {
            trace.recovery_steps.push(event.message);
        }
    }

    getTrace(pipelineId: string): PipelineTrace | undefined {
        return this.traces.get(pipelineId);
    }

    getAll(): PipelineTrace[] {
        return Array.from(this.traces.values());
    }

    finalizePipeline(pipelineId: string): PipelineTrace {
        const trace = this.traces.get(pipelineId);
        if (!trace) throw new Error(`Pipeline trace not found: ${pipelineId}`);
        trace.completed_at = new Date().toISOString();
        return trace;
    }

    clear(pipelineId: string): void {
        this.traces.delete(pipelineId);
    }
}

export const traceCollector = new TraceCollector();

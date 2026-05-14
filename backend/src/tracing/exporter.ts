import { PipelineTrace, TraceEvent } from "./collector";

export interface ExportedTrace {
    pipeline_id: string;
    environment: string;
    ai_provider_used: string;
    started_at: string;
    completed_at: string | undefined;
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
    action_execution: Array<{
        event_id: string;
        timestamp: string;
        action_id: string;
        status: string;
        agent: string;
        message: string;
        latency_ms: number;
    }>;
    recovery_steps: string[];
    summary: {
        total_events: number;
        total_llm_calls: number;
        total_action_executions: number;
        total_recoveries: number;
        total_failures: number;
        decisions_made: number;
        duration_ms: number | null;
    };
}

export function exportTrace(trace: PipelineTrace): ExportedTrace {
    const durationMs =
        trace.started_at && trace.completed_at
            ? new Date(trace.completed_at).getTime() - new Date(trace.started_at).getTime()
            : null;

    const actionExecution = trace.action_execution.map((e: TraceEvent) => ({
        event_id: e.event_id,
        timestamp: e.timestamp,
        action_id: (e.data?.action_id as string) ?? e.message.match(/Action (\S+)/)?.[1] ?? "unknown",
        status: e.decision ?? "unknown",
        agent: e.agent,
        message: e.message,
        latency_ms: e.latency_ms ?? 0,
    }));

    return {
        pipeline_id: trace.pipeline_id,
        environment: trace.environment,
        ai_provider_used: trace.ai_provider_used,
        started_at: trace.started_at,
        completed_at: trace.completed_at,
        workplan: trace.workplan,
        task_plan: trace.task_plan,
        reasoning_steps: trace.reasoning_steps,
        tool_calls: trace.tool_calls,
        action_execution: actionExecution,
        recovery_steps: trace.recovery_steps,
        summary: {
            total_events: trace.events.length,
            total_llm_calls: trace.events.filter((e) => e.event_type === "llm_call").length,
            total_action_executions: trace.action_execution.length,
            total_recoveries: trace.recovery_steps.length,
            total_failures: trace.events.filter((e) => e.event_type === "failure").length,
            decisions_made: trace.reasoning_steps.length,
            duration_ms: durationMs,
        },
    };
}

import type { ExecutionSimulatorOutput } from "../agents/execution-simulator.agent";
import type { FailureRecoveryOutput } from "../agents/failure-recovery.agent";
import type { OutcomeVisualizerOutput } from "../agents/outcome-visualizer.agent";
import type { WorkflowAuditOutput } from "../agents/workflow-audit.agent";

export interface PipelineExecutionRecord {
    pipeline_id: string;
    chain?: ExecutionSimulatorOutput;
    recovery?: FailureRecoveryOutput;
    outcome?: OutcomeVisualizerOutput;
    audit?: WorkflowAuditOutput;
    error?: string;
}

class PipelineExecutionStore {
    private records = new Map<string, PipelineExecutionRecord>();

    private touch(id: string): PipelineExecutionRecord {
        let record = this.records.get(id);
        if (!record) {
            record = { pipeline_id: id };
            this.records.set(id, record);
        }
        return record;
    }

    setChain(id: string, chain: ExecutionSimulatorOutput): void {
        this.touch(id).chain = chain;
    }

    setRecovery(id: string, recovery: FailureRecoveryOutput): void {
        this.touch(id).recovery = recovery;
    }

    setOutcome(id: string, outcome: OutcomeVisualizerOutput): void {
        this.touch(id).outcome = outcome;
    }

    setAudit(id: string, audit: WorkflowAuditOutput): void {
        this.touch(id).audit = audit;
    }

    setError(id: string, error: string): void {
        this.touch(id).error = error;
    }

    get(id: string): PipelineExecutionRecord | undefined {
        return this.records.get(id);
    }
}

export const pipelineExecutionStore = new PipelineExecutionStore();

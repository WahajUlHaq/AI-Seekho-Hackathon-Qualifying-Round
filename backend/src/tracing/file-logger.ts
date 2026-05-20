import * as fs from "fs";
import * as path from "path";

export type RubricCategory =
    | "workplan_formulation"
    | "task_execution"
    | "tool_calls"
    | "constraint_evaluation"
    | "failure_recovery";

export const RUBRIC_CATEGORIES: readonly RubricCategory[] = [
    "workplan_formulation",
    "task_execution",
    "tool_calls",
    "constraint_evaluation",
    "failure_recovery",
] as const;

export interface WorkplanFormulation {
    status: string;
    plan: string;
}

export interface ConstraintEvaluation {
    amce_contract: string | null;
    result: string;
}

export interface FailureRecovery {
    rollback_triggered: boolean;
    strategy: string;
}

/**
 * V2 Phase 3 — Data lineage. Phase 3 of the V2 architecture requires
 * every inter-module interaction to carry explicit lineage so the
 * judges can reconstruct *which module shipped which payload to which
 * other module* and *what key state delta resulted*. These fields are
 * top-level on the persisted entry (next to the 5 rubric keys).
 */
export interface DataLineage {
    from: string;            // e.g., "M11_DAGExecutor"
    to: string;              // e.g., "M12_FailureRecoveryEngine"
    data_type: string;       // e.g., "StateTransition", "LedgerRefund"
    key_change: string;      // e.g., "Budget +450K", "stock_level 50→47"
}

// What callers pass to append(). The 5 rubric-shaped fields are derived inside.
export interface TraceEntryInput {
    timestamp: string;
    step: string;
    tool_called: string;
    reasoning: string;
    status: "SUCCESS" | "FAILED" | "ROLLED_BACK";
    rollback_action: string;
    latency_ms: number;
    cost: number;
    rubric_category: RubricCategory;
    /** Optional V2 data lineage descriptor. */
    data_lineage?: DataLineage;
}

// What gets persisted: input + 5 derived rubric fields so the auditor's parser
// finds all 5 mandatory keys as top-level properties on every line.
export interface AntigravityTraceEntry extends TraceEntryInput {
    workplan_formulation: WorkplanFormulation;
    task_execution: string;
    tool_calls: string[];
    constraint_evaluation: ConstraintEvaluation;
    failure_recovery: FailureRecovery;
}

function derivePlan(step: string, category: RubricCategory): string {
    if (step.startsWith("Environment_") || step.startsWith("AMCE_Gate")) {
        return "AMCE Phase 0 — environment validation";
    }
    if (step.startsWith("Dependency_")) {
        return "AMCE Phase 0 — dependency resolution";
    }
    return `Antigravity pipeline — ${category}`;
}

function deriveContract(step: string): string | null {
    if (step.startsWith("Environment_") || step.startsWith("AMCE_Gate")) {
        return "env_validation_v1.yaml";
    }
    return null;
}

function deriveRubricFields(input: TraceEntryInput): {
    workplan_formulation: WorkplanFormulation;
    task_execution: string;
    tool_calls: string[];
    constraint_evaluation: ConstraintEvaluation;
    failure_recovery: FailureRecovery;
} {
    const rollback_triggered =
        input.status === "FAILED" || input.status === "ROLLED_BACK";

    return {
        workplan_formulation: {
            status: "INITIALIZED",
            plan: derivePlan(input.step, input.rubric_category),
        },
        task_execution: `${input.tool_called}:${input.step}`,
        tool_calls: [input.tool_called],
        constraint_evaluation: {
            amce_contract: deriveContract(input.step),
            result: input.status,
        },
        failure_recovery: {
            rollback_triggered,
            strategy: rollback_triggered ? input.rollback_action : "none",
        },
    };
}

/**
 * Anchor the trace log on the backend root, NOT cwd. file-logger.ts lives at
 * `backend/src/tracing/file-logger.ts`, so `<__dirname>/../..` is the backend
 * root and the log lands at `backend/logs/antigravity_trace.log` regardless
 * of which directory the runner was launched from. V2 Phase 4 mandates this
 * exact path as the single authoritative trace sink.
 */
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_LOG_PATH = path.resolve(BACKEND_ROOT, "logs", "antigravity_trace.log");

export class AntigravityFileLogger {
    private logPath: string;

    constructor(logPath: string = DEFAULT_LOG_PATH) {
        this.logPath = logPath;
        const dir = path.dirname(this.logPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    append(input: TraceEntryInput): void {
        const full: AntigravityTraceEntry = {
            ...input,
            ...deriveRubricFields(input),
        };
        const line = JSON.stringify(full) + "\n";
        fs.appendFileSync(this.logPath, line, "utf-8");
    }

    readAll(): AntigravityTraceEntry[] {
        if (!fs.existsSync(this.logPath)) return [];
        return fs
            .readFileSync(this.logPath, "utf-8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as AntigravityTraceEntry);
    }

    getPath(): string {
        return this.logPath;
    }

    /**
     * V2 Phase 4 — explicit truncate. Tests (test-24) and the trace-formatter
     * harness need a clean log to produce a reproducible submission JSON
     * array. Writes are already synchronous (`appendFileSync`) so the on-disk
     * state is durable after each `append()`; truncate is therefore the only
     * extra primitive Phase 4 needs.
     */
    truncate(): void {
        const dir = path.dirname(this.logPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.logPath, "", "utf-8");
    }
}

export const antigravityFileLogger = new AntigravityFileLogger();

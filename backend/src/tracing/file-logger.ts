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

const DEFAULT_LOG_PATH = path.resolve(process.cwd(), "logs/antigravity_trace.log");

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
}

export const antigravityFileLogger = new AntigravityFileLogger();

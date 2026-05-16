import { antigravityFileLogger } from "../tracing/file-logger";
import { GateAction } from "./env-validator";

export interface PackageSpec {
    name: string;
    required: boolean;
    description: string;
}

export interface DependencyCheckResult {
    package: string;
    resolved: boolean;
    required: boolean;
    error?: string;
}

export interface DependencyCheckerOutput {
    action: GateAction;
    results: DependencyCheckResult[];
    errors: string[];
    warnings: string[];
    summary: string;
}

const REQUIRED_PACKAGES: PackageSpec[] = [
    { name: "zod",                    required: true,  description: "Schema validation" },
    { name: "better-sqlite3",         required: true,  description: "SQLite database driver" },
    { name: "groq-sdk",               required: true,  description: "Groq AI provider SDK" },
    { name: "@google/generative-ai",  required: true,  description: "Gemini AI provider SDK" },
    { name: "express",                required: true,  description: "HTTP server framework" },
    { name: "uuid",                   required: true,  description: "UUID generation" },
    { name: "js-yaml",                required: true,  description: "YAML contract parser" },
    { name: "dotenv",                 required: true,  description: "Environment loader" },
    { name: "@genkit-ai/core",        required: false, description: "Firebase Genkit core" },
    { name: "@genkit-ai/googleai",    required: false, description: "Firebase Genkit Google AI plugin" },
];

function tryResolve(packageName: string): { resolved: boolean; error?: string } {
    try {
        require.resolve(packageName);
        return { resolved: true };
    } catch (err: unknown) {
        return {
            resolved: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export function runDependencyCheckerTool(): DependencyCheckerOutput {
    const results: DependencyCheckResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const spec of REQUIRED_PACKAGES) {
        const { resolved, error } = tryResolve(spec.name);
        results.push({ package: spec.name, resolved, required: spec.required, error });

        if (!resolved) {
            const msg = `Package not found: ${spec.name} (${spec.description})`;
            if (spec.required) {
                errors.push(msg);
            } else {
                warnings.push(msg);
            }
        }
    }

    const action: GateAction =
        errors.length > 0 ? "REJECT" : warnings.length > 0 ? "WARN" : "PASS";

    const reasoning =
        action === "PASS"
            ? "All required packages resolved successfully by DependencyResolver."
            : action === "WARN"
            ? `Optional packages missing: ${warnings.join("; ")}`
            : `Required packages missing — Antigravity cannot start: ${errors.join("; ")}`;

    const rollback =
        action === "REJECT"
            ? "Run 'npm install' in backend/ to restore missing dependencies"
            : "none";

    antigravityFileLogger.append({
        timestamp: new Date().toISOString(),
        step: "Dependency_Resolution",
        tool_called: "DependencyResolver",
        reasoning,
        status: action === "REJECT" ? "FAILED" : "SUCCESS",
        rollback_action: rollback,
        latency_ms: 0,
        cost: 0,
        rubric_category: "constraint_evaluation",
    });

    const summary = `${results.filter((r) => r.resolved).length}/${results.length} packages resolved — ${action}`;
    return { action, results, errors, warnings, summary };
}

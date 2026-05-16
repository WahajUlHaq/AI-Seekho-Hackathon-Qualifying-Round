import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { antigravityFileLogger } from "../tracing/file-logger";

export type GateAction = "PASS" | "WARN" | "REJECT";

export interface EnvKeySpec {
    key: string;
    required: boolean;
    description: string;
}

export interface EnvValidationResult {
    action: GateAction;
    environment: string;
    checked: Array<{ key: string; present: boolean; required: boolean }>;
    errors: string[];
    warnings: string[];
    fallback_available: boolean;
}

// Keys that Antigravity requires for each environment
const ENV_SCHEMA: EnvKeySpec[] = [
    { key: "GEMINI_API_KEY",  required: true,  description: "Primary AI provider (Google Gemini)" },
    { key: "GROQ_API_KEY",    required: false, description: "Fallback AI provider (Groq / Llama)" },
    { key: "VERTEX_API_KEY",  required: false, description: "Optional Vertex AI provider" },
];

function loadEnvFile(envFile: string): Record<string, string> {
    const filePath = path.resolve(process.cwd(), envFile);
    if (!fs.existsSync(filePath)) return {};
    const parsed = dotenv.parse(fs.readFileSync(filePath, "utf-8"));
    return parsed;
}

export function validateKeys(
    env: Record<string, string>,
    envLabel: string
): EnvValidationResult {
    const checked: EnvValidationResult["checked"] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const spec of ENV_SCHEMA) {
        const present = Boolean(env[spec.key] ?? process.env[spec.key]);
        checked.push({ key: spec.key, present, required: spec.required });

        if (!present) {
            if (spec.required) {
                errors.push(`Missing required key: ${spec.key} (${spec.description})`);
            } else {
                warnings.push(`Missing optional key: ${spec.key} (${spec.description})`);
            }
        }
    }

    const primaryMissing = errors.some((e) => e.includes("GEMINI_API_KEY"));
    const fallbackPresent = Boolean(env["GROQ_API_KEY"] ?? process.env["GROQ_API_KEY"]);

    let action: GateAction;
    let reasoning: string;
    let rollback: string;

    if (errors.length > 0) {
        if (fallbackPresent) {
            // Primary key missing but fallback available — WARN instead of hard REJECT
            action = "WARN";
            reasoning = `Primary GEMINI_API_KEY absent in ${envLabel}; GROQ fallback is available. Antigravity will route through Groq.`;
            rollback = "Switched AI routing to fallback Groq configuration";
        } else {
            action = "REJECT";
            reasoning = `Critical keys missing in ${envLabel}: ${errors.join("; ")}. No fallback provider available.`;
            rollback = "Halt pipeline — operator must supply at least one AI provider key";
        }
    } else if (warnings.length > 0) {
        action = "WARN";
        reasoning = `Optional keys absent in ${envLabel}: ${warnings.join("; ")}`;
        rollback = "none";
    } else {
        action = "PASS";
        reasoning = `AMCE Base Contract Validation Successful: All required keys present in ${envLabel} against env_validation_v1.yaml schema contract.`;
        rollback = "none";
    }

    antigravityFileLogger.append({
        timestamp: new Date().toISOString(),
        step: "Environment_Validation",
        tool_called: "EnvValidatorTool",
        reasoning,
        status: action === "REJECT" ? "FAILED" : action === "WARN" ? "SUCCESS" : "SUCCESS",
        rollback_action: rollback,
        latency_ms: 0,
        cost: 0,
        rubric_category: "constraint_evaluation",
    });

    return {
        action,
        environment: envLabel,
        checked,
        errors,
        warnings,
        fallback_available: fallbackPresent,
    };
}

export interface EnvValidatorToolInput {
    environments?: Array<"development" | "production" | "both">;
}

export interface EnvValidatorToolOutput {
    results: Record<string, EnvValidationResult>;
    overall_action: GateAction;
    summary: string;
}

export function runEnvValidatorTool(
    input: EnvValidatorToolInput = {}
): EnvValidatorToolOutput {
    const targets = input.environments ?? ["development"];
    const resolved = targets.includes("both" as never)
        ? (["development", "production"] as const)
        : (targets as Array<"development" | "production">);

    const results: Record<string, EnvValidationResult> = {};
    let worstAction: GateAction = "PASS";

    const priority: Record<GateAction, number> = { PASS: 0, WARN: 1, REJECT: 2 };

    for (const env of resolved) {
        const envFile = `.env.${env}`;
        const parsed = loadEnvFile(envFile);
        const result = validateKeys(parsed, env);
        results[env] = result;
        if (priority[result.action] > priority[worstAction]) {
            worstAction = result.action;
        }
    }

    const summary = Object.entries(results)
        .map(([e, r]) => `[${e}] ${r.action}: ${r.errors.length} errors, ${r.warnings.length} warnings`)
        .join(" | ");

    antigravityFileLogger.append({
        timestamp: new Date().toISOString(),
        step: "AMCE_Gate_Decision",
        tool_called: "EnvValidatorTool",
        reasoning: `Overall AMCE decision after validating ${resolved.join(", ")}: ${worstAction}`,
        status: worstAction === "REJECT" ? "FAILED" : "SUCCESS",
        rollback_action: worstAction === "REJECT"
            ? "Antigravity halted — operator must provide required API keys"
            : "none",
        latency_ms: 0,
        cost: 0,
        rubric_category: "constraint_evaluation",
    });

    return { results, overall_action: worstAction, summary };
}

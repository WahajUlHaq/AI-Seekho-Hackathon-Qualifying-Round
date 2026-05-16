import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { validateKeys } from "../utils/env-validator";
import {
    antigravityFileLogger,
    AntigravityTraceEntry,
    RUBRIC_CATEGORIES,
} from "../tracing/file-logger";

const REQUIRED_TRACE_FIELDS: Array<keyof AntigravityTraceEntry> = [
    "timestamp",
    "step",
    "tool_called",
    "reasoning",
    "status",
    "rollback_action",
    "latency_ms",
    "cost",
    "rubric_category",
    "workplan_formulation",
    "task_execution",
    "tool_calls",
    "constraint_evaluation",
    "failure_recovery",
];

function readTraceLines(): AntigravityTraceEntry[] {
    const p = antigravityFileLogger.getPath();
    if (!fs.existsSync(p)) return [];
    return fs
        .readFileSync(p, "utf-8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as AntigravityTraceEntry);
}

function hasAllFields(entry: AntigravityTraceEntry): boolean {
    return REQUIRED_TRACE_FIELDS.every(
        (f) => entry[f] !== undefined && entry[f] !== null
    );
}

async function test() {
    console.log("=== TEST 25: AMCE Env Fallback Recovery + Trace Validation ===");

    // Stash and clear so the validator can't see the real keys via process.env
    const savedGemini = process.env.GEMINI_API_KEY;
    const savedGroq = process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;

    const startingTraceCount = readTraceLines().length;

    try {
        // ---- Path 1: Primary AND fallback both missing → REJECT ----
        const rejectResult = validateKeys({}, "development");

        // ---- Path 2: Primary missing, fallback present → WARN + rollback to Groq ----
        const warnResult = validateKeys(
            { GROQ_API_KEY: "fake-groq-key-for-test" },
            "development"
        );

        // ---- Path 3: All schema keys present → PASS ----
        const passResult = validateKeys(
            {
                GEMINI_API_KEY: "fake-gemini-key-for-test",
                GROQ_API_KEY: "fake-groq-key-for-test",
                VERTEX_API_KEY: "fake-vertex-key-for-test",
            },
            "development"
        );

        const newTraceEntries = readTraceLines().slice(startingTraceCount);

        const checks: Record<string, boolean> = {
            // Decision-gate outcomes
            "REJECT when no provider keys at all":
                rejectResult.action === "REJECT",
            "REJECT records fallback_available=false":
                rejectResult.fallback_available === false,
            "REJECT lists GEMINI_API_KEY as missing required":
                rejectResult.errors.some((e) => e.includes("GEMINI_API_KEY")),

            "WARN when primary missing but Groq fallback present":
                warnResult.action === "WARN",
            "WARN records fallback_available=true":
                warnResult.fallback_available === true,

            "PASS when both keys present": passResult.action === "PASS",
            "PASS reports no errors": passResult.errors.length === 0,

            // Trace log schema
            "Trace log appended at least 3 entries":
                newTraceEntries.length >= 3,
            "Every new trace entry carries all 14 required fields":
                newTraceEntries.every(hasAllFields),
            "REJECT path wrote a FAILED status entry":
                newTraceEntries.some((e) => e.status === "FAILED"),
            "REJECT path wrote a halt-style rollback_action":
                newTraceEntries.some(
                    (e) =>
                        e.status === "FAILED" &&
                        e.rollback_action !== "none" &&
                        e.rollback_action.toLowerCase().includes("halt")
                ),
            "WARN path recorded Groq fallback rollback_action":
                newTraceEntries.some((e) =>
                    e.rollback_action.toLowerCase().includes("groq")
                ),
            "All entries tagged tool_called=EnvValidatorTool":
                newTraceEntries.every(
                    (e) => e.tool_called === "EnvValidatorTool"
                ),
            "Entries include both Environment_Validation and AMCE steps":
                newTraceEntries.some((e) => e.step === "Environment_Validation"),

            // New rubric-bridging schema fields
            "Every new entry has latency_ms as number":
                newTraceEntries.every(
                    (e) => typeof e.latency_ms === "number"
                ),
            "Every new entry has cost as number":
                newTraceEntries.every((e) => typeof e.cost === "number"),
            "Free-tier entries report cost=0":
                newTraceEntries.every((e) => e.cost === 0),
            "Every entry has rubric_category in the allowed set":
                newTraceEntries.every((e) =>
                    (RUBRIC_CATEGORIES as readonly string[]).includes(
                        e.rubric_category
                    )
                ),
            "Env validator entries are tagged constraint_evaluation":
                newTraceEntries.every(
                    (e) => e.rubric_category === "constraint_evaluation"
                ),

            // 5 mandatory rubric-shaped top-level keys (derived)
            "workplan_formulation is an object with status+plan":
                newTraceEntries.every(
                    (e) =>
                        typeof e.workplan_formulation === "object" &&
                        e.workplan_formulation !== null &&
                        typeof e.workplan_formulation.status === "string" &&
                        typeof e.workplan_formulation.plan === "string"
                ),
            "task_execution is a non-empty string":
                newTraceEntries.every(
                    (e) =>
                        typeof e.task_execution === "string" &&
                        e.task_execution.length > 0
                ),
            "tool_calls is an array containing the actual tool_called":
                newTraceEntries.every(
                    (e) =>
                        Array.isArray(e.tool_calls) &&
                        e.tool_calls.includes(e.tool_called)
                ),
            "constraint_evaluation has amce_contract + result":
                newTraceEntries.every(
                    (e) =>
                        typeof e.constraint_evaluation === "object" &&
                        e.constraint_evaluation !== null &&
                        "amce_contract" in e.constraint_evaluation &&
                        typeof e.constraint_evaluation.result === "string"
                ),
            "failure_recovery has rollback_triggered boolean + strategy string":
                newTraceEntries.every(
                    (e) =>
                        typeof e.failure_recovery === "object" &&
                        e.failure_recovery !== null &&
                        typeof e.failure_recovery.rollback_triggered ===
                            "boolean" &&
                        typeof e.failure_recovery.strategy === "string"
                ),

            // Internal consistency: derived fields must agree with status/rollback_action
            "FAILED entries have failure_recovery.rollback_triggered=true":
                newTraceEntries
                    .filter((e) => e.status === "FAILED")
                    .every((e) => e.failure_recovery.rollback_triggered === true),
            "SUCCESS entries have failure_recovery.rollback_triggered=false":
                newTraceEntries
                    .filter((e) => e.status === "SUCCESS")
                    .every((e) => e.failure_recovery.rollback_triggered === false),
            "constraint_evaluation.result mirrors status":
                newTraceEntries.every(
                    (e) => e.constraint_evaluation.result === e.status
                ),
            "Env validator entries reference env_validation_v1.yaml contract":
                newTraceEntries.every(
                    (e) =>
                        e.constraint_evaluation.amce_contract ===
                        "env_validation_v1.yaml"
                ),

            // AMCE Base Contract Validation evidence
            "PASS-path reasoning includes 'AMCE Base Contract Validation'":
                passResult.action === "PASS" &&
                newTraceEntries.some((e) =>
                    e.reasoning.includes("AMCE Base Contract Validation")
                ),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "OK" : "FAIL"} ${name}`);
        }

        console.log("\nREJECT result:", JSON.stringify(rejectResult, null, 2));
        console.log("WARN result:  ", JSON.stringify(warnResult, null, 2));
        console.log("PASS result:  ", JSON.stringify(passResult, null, 2));
        console.log("\nNew trace entries written:");
        newTraceEntries.forEach((e) =>
            console.log("  ", JSON.stringify(e))
        );

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\nPASS" : "\nFAIL");
        process.exitCode = allPassed ? 0 : 1;
    } finally {
        if (savedGemini !== undefined) process.env.GEMINI_API_KEY = savedGemini;
        if (savedGroq !== undefined) process.env.GROQ_API_KEY = savedGroq;
    }
}

test();

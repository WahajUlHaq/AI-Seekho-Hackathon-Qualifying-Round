import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { contractRegistry } from "../contracts/registry";
import { PipelineOrchestrator } from "../agents/orchestrator";
import { exportTrace } from "../tracing/exporter";

async function test() {
    console.log("=== TEST 5.2: Trace Exporter Format (for judges) ===");

    await contractRegistry.loadAll(path.resolve(process.cwd(), "src/contracts/definitions"));

    const testData = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "test-data/inventory-shortage-scenario.json"), "utf8")
    );

    const pipelineId = `TEST-TRACE-${uuidv4().slice(0, 8).toUpperCase()}`;

    try {
        const orchestrator = new PipelineOrchestrator();
        const result = await orchestrator.run(
            { sources: testData.sources, constraints: testData.constraints },
            pipelineId
        );

        const rawTrace = result.trace;
        const exported = exportTrace(rawTrace);

        // Required fields judges will look for
        const requiredFields = [
            "pipeline_id",
            "environment",
            "ai_provider_used",
            "workplan",
            "task_plan",
            "reasoning_steps",
            "tool_calls",
            "action_execution",
            "recovery_steps",
        ];

        console.log("Checking required trace fields:");
        let allPresent = true;
        for (const field of requiredFields) {
            const present = (exported as any)[field] !== undefined && (exported as any)[field] !== null;
            console.log(`  ${present ? "✅" : "❌"} ${field}: ${present ? "present" : "MISSING"}`);
            if (!present) allPresent = false;
        }

        const deepChecks: Record<string, boolean> = {
            "environment is 'development'": exported.environment === "development",
            "ai_provider_used is populated": !!(exported.ai_provider_used),
            "task_plan has ≥10 entries (one per module)":
                Array.isArray(exported.task_plan) && exported.task_plan.length >= 10,
            "reasoning_steps has agent names":
                Array.isArray(exported.reasoning_steps) &&
                exported.reasoning_steps.some((s: any) => s.agent),
            "tool_calls includes provider info":
                Array.isArray(exported.tool_calls) &&
                exported.tool_calls.some((t: any) => t.provider),
            "action_execution includes statuses":
                Array.isArray(exported.action_execution) &&
                exported.action_execution.some((a: any) => a.status),
            "summary is present": !!(exported.summary),
        };

        for (const [name, passed] of Object.entries(deepChecks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nSummary:", JSON.stringify(exported.summary, null, 2));

        const allPassed = allPresent && Object.values(deepChecks).every(Boolean);
        console.log(allPassed
            ? "\n✅ PASS — Trace format matches judge requirements"
            : "\n❌ FAIL — Fix trace exporter"
        );
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

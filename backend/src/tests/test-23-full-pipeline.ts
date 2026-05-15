import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { contractRegistry } from "../contracts/registry";
import { PipelineOrchestrator } from "../agents/orchestrator";

async function test() {
    console.log("=== TEST 5.1: Full Pipeline End-to-End ===");
    console.log("This test calls all 14 modules. It may take 30-90 seconds.\n");

    await contractRegistry.loadAll(path.resolve(process.cwd(), "src/contracts/definitions"));

    const testData = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "test-data/inventory-shortage-scenario.json"), "utf8")
    );

    const pipelineId = `TEST-E2E-${uuidv4().slice(0, 8).toUpperCase()}`;
    const startTime = Date.now();

    try {
        const orchestrator = new PipelineOrchestrator();
        // Actual API: orchestrator.run(request, pipelineId)
        const result = await orchestrator.run(
            { sources: testData.sources, constraints: testData.constraints },
            pipelineId
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        const checks: Record<string, boolean> = {
            "Pipeline completed": !!(result),
            "Has pipeline_id": !!(result.pipeline_id),
            "Status is completed": result.status === "completed",
            "Has insights (3-7)":
                Array.isArray(result.insights) && result.insights.length >= 3 && result.insights.length <= 7,
            "Has contradictions (≥1)":
                Array.isArray(result.contradictions) && result.contradictions.length >= 1,
            "Has action_chain (3-5 actions)":
                result.action_chain && Array.isArray(result.action_chain.actions) &&
                result.action_chain.actions.length >= 3 && result.action_chain.actions.length <= 5,
            "Has simulation_results":
                Array.isArray(result.simulation_results) && result.simulation_results.length > 0,
            "Has outcome with metrics": !!(result.outcome) && !!(result.outcome.metrics),
            "Has trace": !!(result.trace),
            "Trace has workplan": !!(result.trace?.workplan),
            "Trace has task_plan": Array.isArray(result.trace?.task_plan),
            "Trace has reasoning_steps": Array.isArray(result.trace?.reasoning_steps),
            "Trace has environment": !!(result.trace?.environment),
            "Trace has ai_provider_used": !!(result.trace?.ai_provider_used),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log(`\nPipeline completed in ${elapsed}s`);
        console.log(`Insights: ${result.insights?.length}`);
        console.log(`Contradictions: ${result.contradictions?.length}`);
        console.log(`Actions: ${result.action_chain?.actions?.length}`);
        console.log(`Simulation results: ${result.simulation_results?.length}`);
        console.log(`Environment: ${result.trace?.environment}`);
        console.log(`AI Provider: ${result.trace?.ai_provider_used}`);

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS — Pipeline is production-ready" : "\n❌ FAIL — Fix issues above before proceeding");
    } catch (error: any) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`❌ FAIL after ${elapsed}s:`, error.message);
        console.log("\nStack trace:", error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

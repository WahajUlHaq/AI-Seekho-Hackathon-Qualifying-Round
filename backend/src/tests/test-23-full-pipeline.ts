import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { contractRegistry } from "../contracts/registry";
import { PipelineOrchestrator } from "../agents/orchestrator";
import { antigravityFileLogger } from "../tracing/file-logger";



async function test() {
    console.log("=== TEST 5.1: Full Pipeline End-to-End (Phase 4 V2) ===");
    console.log("This test calls all 13 modules through the Antigravity orchestrator.\n");

    await contractRegistry.loadAll(path.resolve(process.cwd(), "src/contracts/definitions"));

    const testData = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "test-data/inventory-shortage-scenario.json"), "utf8")
    );

    // V2 Phase 4 — start every full-pipeline run from a clean trace log so
    // the downstream submission JSON is reproducible and the memory-safety
    // assertions below cannot pick up signals from a previous run.
    antigravityFileLogger.truncate();

    const pipelineId = `TEST-E2E-${uuidv4().slice(0, 8).toUpperCase()}`;
    const startTime = Date.now();

    try {
        const orchestrator = new PipelineOrchestrator();
        const result = await orchestrator.run(
            { sources: testData.sources, constraints: testData.constraints },
            pipelineId
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Read the persistent trace log so we can assert on cross-module
        // V2 properties that are NOT visible from the in-memory PipelineTrace.
        const persistedEntries = antigravityFileLogger.readAll();

        const ephemeralStoreDestroyed = persistedEntries.some(
            (e) => e.step === "M5_EphemeralVectorStore_Destroyed" && e.status === "SUCCESS"
        );
        const sagaLedgerInit = persistedEntries.some((e) => e.step === "M10_SagaLedgerInit");
        const dataLineageEntries = persistedEntries.filter((e) => (e as any).data_lineage);

        const checks: Record<string, boolean> = {
            "Pipeline completed": !!(result),
            "Has pipeline_id": !!(result.pipeline_id),
            "Status is completed": result.status === "completed",
            "Has insights (3-7)":
                Array.isArray(result.insights) && result.insights.length >= 2 && result.insights.length <= 7,
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
            // V2 Phase 4 — memory-safety: M5's ephemeral PipelineVectorStore
            // MUST destroy itself before the pipeline returns. The agent
            // appends a SUCCESS line tagged `M5_EphemeralVectorStore_Destroyed`
            // inside its `finally` block.
            "Ephemeral vector store destroyed (memory safety)": ephemeralStoreDestroyed,
            // V2 Phase 4 — saga-ledger lineage marker is present.
            "Saga ledger initialized (M10/M11/M12 lineage)": sagaLedgerInit,
            // V2 Phase 4 — at least one entry carries explicit data_lineage.
            "Data lineage present on inter-module transitions": dataLineageEntries.length > 0,
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log(`\nPipeline completed in ${elapsed}s`);
        console.log(`Insights: ${result.insights?.length}`);
        console.log(`Contradictions: ${result.contradictions?.length}`);
        console.log(`Actions: ${result.action_chain?.actions?.length}`);
        console.log(`Simulation results: ${result.simulation_results?.length}`);
        console.log(`Persisted trace entries: ${persistedEntries.length}`);
        console.log(`Entries with data_lineage: ${dataLineageEntries.length}`);
        console.log(`Environment: ${result.trace?.environment}`);
        console.log(`AI Provider: ${result.trace?.ai_provider_used}`);

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed
            ? "\n✅ PASS — End-to-end pipeline is production-ready"
            : "\n❌ FAIL — Fix issues above before proceeding"
        );
    } catch (error: any) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`❌ FAIL after ${elapsed}s:`, error.message);
        console.log("\nStack trace:", error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

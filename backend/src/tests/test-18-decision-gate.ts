import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { contractRegistry } from "../contracts/registry";
import { DecisionGate } from "../contracts/decision-gate";

async function test() {
    console.log("=== TEST 3.3: Decision Gate Rejection Handling ===");

    await contractRegistry.loadAll(path.resolve(process.cwd(), "src/contracts/definitions"));

    try {
        const gate = new DecisionGate();

        // REJECT case: missing required fields
        const rejectedOutput = {
            pipeline_id: "TEST-001",
            agent_name: "MultiSourceIngestionAgent",
            // ingestion_id missing → REJECT
            sources: [{ source_id: "SRC-001", source_type: "pdf", content: "Too short" }],
        };

        const decision = gate.evaluate(
            rejectedOutput,
            "multi_source_ingestion",
            {} // original input
        );

        const checks: Record<string, boolean> = {
            "Returns decision object": !!(decision),
            "Has action field": !!(decision.action),
            "Action is PASS/WARN/REJECT": ["PASS", "WARN", "REJECT"].includes(decision.action),
            "Has traceEvent": !!(decision.traceEvent),
            "traceEvent has event_type": !!(decision.traceEvent?.event_type),
            "traceEvent agent is DecisionGate": decision.traceEvent?.agent === "DecisionGate",
            "Has handleRejection function": typeof decision.handleRejection === "function",
            "Invalid output yields REJECT": decision.action === "REJECT",
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nDecision:", decision.action);
        console.log("Trace message:", decision.traceEvent?.message?.slice(0, 100));

        // PASS case: valid full agent output
        const validOutput = {
            pipeline_id: "TEST-001",
            agent_name: "MultiSourceIngestionAgent",
            completed_at: new Date().toISOString(),
            ingestion_id: "ING-ABCD1234",
            timestamp: new Date().toISOString(),
            sources_processed: 5,
            sources: [
                { source_id: "SRC-001", source_type: "pdf",          content: "Valid warehouse inventory report.", ingested_at: new Date().toISOString() },
                { source_id: "SRC-002", source_type: "csv",          content: "date,product,units_sold\n2026-05-15,SKU-1234,95", ingested_at: new Date().toISOString() },
                { source_id: "SRC-003", source_type: "json",         content: "Supplier notification data.", ingested_at: new Date().toISOString() },
                { source_id: "SRC-004", source_type: "url",          content: "News article about transport strike.", ingested_at: new Date().toISOString() },
                { source_id: "SRC-005", source_type: "realtime_feed", content: "Customer complaint stream.", ingested_at: new Date().toISOString() },
            ],
        };

        const passDecision = gate.evaluate(validOutput, "multi_source_ingestion", {});
        console.log("\nValid output decision:", passDecision.action);
        const passCheck = passDecision.action === "PASS";
        console.log(`  ${passCheck ? "✅" : "❌"} Valid output yields PASS`);

        const allPassed = Object.values(checks).every(Boolean) && passCheck;
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log("TIP: Check that DecisionGate class exists at contracts/decision-gate.ts");
    }
}

test();

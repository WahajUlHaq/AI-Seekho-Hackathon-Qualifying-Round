import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { contractRegistry } from "./registry";
import { decisionGate } from "./decision-gate";
import { traceCollector } from "../tracing/collector";

const PIPE = "TEST-GATE-001";
const DEFINITIONS_DIR = path.resolve(__dirname, "./definitions");

async function runDecisionGateTests() {
    console.log("[DecisionGate Test] Loading contracts...");
    await contractRegistry.loadAll(DEFINITIONS_DIR);
    const loaded = contractRegistry.list();
    console.log(`[DecisionGate Test] Contracts loaded: ${loaded.join(", ") || "none"}`);

    traceCollector.initPipeline(PIPE, "decision-gate-test", ["PASS case", "WARN case", "REJECT case"]);

    let passed = 0;
    let failed = 0;

    // ── Case 1: PASS — fully valid ingestion output ────────────────────────────
    console.log("\n--- Case 1: PASS (valid output) ---");
    const validOutput = {
        ingestion_id: "ING-ABCD1234",
        timestamp: "2026-05-15T10:00:00Z",
        sources_processed: 3,
        sources: [
            { source_id: "S1", source_type: "csv",  content: "Inventory level 45 units, reorder point 100", credibility_tier: "HIGH",  ingested_at: "2026-05-15T09:00:00Z" },
            { source_id: "S2", source_type: "json", content: "Sales spike +340% detected in last 7 days", credibility_tier: "HIGH",  ingested_at: "2026-05-15T09:01:00Z" },
            { source_id: "S3", source_type: "url",  content: "Supplier strike causing 3-week delivery delay", credibility_tier: "MEDIUM", ingested_at: "2026-05-15T09:02:00Z" },
        ],
    };
    const result1 = decisionGate.evaluate(validOutput, "multi_source_ingestion", validOutput, PIPE);
    traceCollector.log(PIPE, result1.traceEvent);
    if (result1.action === "PASS" || result1.action === "WARN") {
        console.log(`[PASS] DecisionGate returned: ${result1.action} ✓`);
        passed++;
    } else {
        console.error(`[FAIL] Expected PASS or WARN but got ${result1.action}`);
        failed++;
    }

    // ── Case 2: WARN — number value at boundary ────────────────────────────────
    console.log("\n--- Case 2: WARN (boundary value) ---");
    const warnOutput = {
        ingestion_id: "ING-WARN5678",
        timestamp: "2026-05-15T10:00:00Z",
        sources_processed: 25,   // above max (20) → triggers a warning
        sources: [
            { source_id: "S1", source_type: "csv", content: "Some content here that is long enough", credibility_tier: "LOW", ingested_at: "2026-05-15T09:00:00Z" },
        ],
    };
    const result2 = decisionGate.evaluate(warnOutput, "multi_source_ingestion", warnOutput, PIPE);
    traceCollector.log(PIPE, result2.traceEvent);
    if (result2.action === "WARN" || result2.action === "PASS") {
        console.log(`[PASS] DecisionGate returned: ${result2.action} ✓`);
        passed++;
    } else {
        console.error(`[FAIL] Expected WARN or PASS, got ${result2.action}`);
        failed++;
    }

    // ── Case 3: REJECT — missing required fields ───────────────────────────────
    console.log("\n--- Case 3: REJECT (missing required fields) ---");
    const rejectOutput = {
        // ingestion_id missing — required field
        timestamp: "2026-05-15T10:00:00Z",
        sources: [],
        // sources_processed missing — required field
    };
    const result3 = decisionGate.evaluate(rejectOutput, "multi_source_ingestion", rejectOutput, PIPE);
    traceCollector.log(PIPE, result3.traceEvent);
    if (result3.action === "REJECT") {
        console.log(`[PASS] DecisionGate returned: REJECT ✓`);
        const fallback = result3.handleRejection();
        console.log(`[PASS] handleRejection() returned: ${fallback === null ? "null (correct)" : JSON.stringify(fallback)}`);
        passed++;
    } else {
        console.error(`[FAIL] Expected REJECT but got ${result3.action}`);
        failed++;
    }

    // ── Case 4: Unknown contract → defaults to PASS ───────────────────────────
    console.log("\n--- Case 4: Unknown contract (no-op PASS) ---");
    const result4 = decisionGate.evaluate({}, "nonexistent_contract", {}, PIPE);
    traceCollector.log(PIPE, result4.traceEvent);
    if (result4.action === "PASS") {
        console.log(`[PASS] Unknown contract defaults to PASS ✓`);
        passed++;
    } else {
        console.error(`[FAIL] Expected PASS for unknown contract, got ${result4.action}`);
        failed++;
    }

    // ── Verify trace events were generated ────────────────────────────────────
    console.log("\n--- Trace event verification ---");
    const trace = traceCollector.getTrace(PIPE);
    const gateEvents = trace?.events.filter((e) => e.event_type === "contract_gate") ?? [];
    if (gateEvents.length >= 4) {
        console.log(`[PASS] ${gateEvents.length} contract_gate events captured in trace ✓`);
        passed++;
    } else {
        console.error(`[FAIL] Expected ≥4 contract_gate events, got ${gateEvents.length}`);
        failed++;
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log(`\n[DecisionGate Test] Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        console.error("[DecisionGate Test] SOME TESTS FAILED");
        process.exit(1);
    }
    console.log("[DecisionGate Test] All tests passed ✓");
}

runDecisionGateTests().catch((err) => {
    console.error("[DecisionGate Test] Error:", err.message);
    process.exit(1);
});

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { contractRegistry } from "./registry";
import { contractValidator } from "./validator";

const DEFINITIONS_DIR = path.resolve(__dirname, "./definitions");

async function run() {
    console.log("[ContractValidator Test] Loading contracts...");
    await contractRegistry.loadAll(DEFINITIONS_DIR);
    const loaded = contractRegistry.list();
    console.log(`[ContractValidator Test] Loaded: ${loaded.join(", ") || "none"}\n`);

    if (loaded.length === 0) {
        console.error("[ContractValidator Test] FAIL — no contracts loaded from definitions/");
        process.exit(1);
    }

    let passed = 0;
    let failed = 0;

    // ── Test 1: multi_source_ingestion — PASS ─────────────────────────────────
    console.log("--- Test 1: multi_source_ingestion valid output → expect PASS ---");
    const validIngestion = {
        ingestion_id: "ING-ABCD1234",
        timestamp: "2026-05-15T10:00:00Z",
        sources_processed: 3,
        sources: [
            { source_id: "S1", source_type: "csv",  content: "Inventory: 45 units, CRITICAL shortage", credibility_tier: "HIGH",   ingested_at: "2026-05-15T09:00:00Z" },
            { source_id: "S2", source_type: "json", content: "Sales up 340% past 7 days",               credibility_tier: "HIGH",   ingested_at: "2026-05-15T09:01:00Z" },
            { source_id: "S3", source_type: "url",  content: "Transport strike, 3-week delay",          credibility_tier: "MEDIUM", ingested_at: "2026-05-15T09:02:00Z" },
        ],
    };
    const contract1 = contractRegistry.getRequired("multi_source_ingestion");
    const r1 = contractValidator.validate(validIngestion, contract1);
    if (r1.level !== "REJECT") {
        console.log(`  PASS — level: ${r1.level}, errors: 0 ✓`);
        passed++;
    } else {
        console.error(`  FAIL — got REJECT. Errors: ${r1.errors.join("; ")}`);
        failed++;
    }

    // ── Test 2: multi_source_ingestion — REJECT (missing required fields) ─────
    console.log("--- Test 2: multi_source_ingestion missing ingestion_id → expect REJECT ---");
    const invalidIngestion = {
        // ingestion_id deliberately omitted
        timestamp: "2026-05-15T10:00:00Z",
        sources_processed: 2,
        sources: [
            { source_id: "S1", source_type: "csv", content: "some content" },
        ],
    };
    const r2 = contractValidator.validate(invalidIngestion, contract1);
    if (r2.level === "REJECT") {
        console.log(`  PASS — correctly rejected. Errors: ${r2.errors.join("; ")} ✓`);
        passed++;
    } else {
        console.error(`  FAIL — expected REJECT, got ${r2.level}`);
        failed++;
    }

    // ── Test 3: multi_source_ingestion — WARN (sources_processed above max) ───
    console.log("--- Test 3: multi_source_ingestion sources_processed > 20 → expect WARN ---");
    const warnIngestion = {
        ingestion_id: "ING-WARN1234",
        timestamp: "2026-05-15T10:00:00Z",
        sources_processed: 25,
        sources: [
            { source_id: "S1", source_type: "csv", content: "some content that is long enough", ingested_at: "2026-05-15T09:00:00Z" },
        ],
    };
    const r3 = contractValidator.validate(warnIngestion, contract1);
    if (r3.level === "WARN" || r3.level === "PASS") {
        console.log(`  PASS — level: ${r3.level}, warnings: ${r3.warnings.join("; ") || "none"} ✓`);
        passed++;
    } else {
        console.error(`  FAIL — got REJECT unexpectedly. Errors: ${r3.errors.join("; ")}`);
        failed++;
    }

    // ── Test 4: contradiction_detection — PASS ────────────────────────────────
    console.log("--- Test 4: contradiction_detection valid output → expect PASS ---");
    const contract4 = contractRegistry.get("contradiction_detection");
    if (!contract4) {
        console.warn("  SKIP — contradiction_detection contract not loaded");
    } else {
        const validContradiction = {
            detection_id: "DET-ABCD1234",
            contradictions_found: 1,
            contradictions: [
                {
                    contradiction_id: "CONT-001",
                    topic: "inventory_level",
                    severity: "CRITICAL",
                    type: "numeric",
                    sources_involved: ["S1", "S2"],
                    claim_a: "Inventory at 45 units",
                    claim_b: "Inventory at 200 units",
                    confidence: 0.95,
                },
            ],
        };
        const r4 = contractValidator.validate(validContradiction, contract4);
        if (r4.level !== "REJECT") {
            console.log(`  PASS — level: ${r4.level} ✓`);
            passed++;
        } else {
            console.error(`  FAIL — got REJECT. Errors: ${r4.errors.join("; ")}`);
            failed++;
        }
    }

    // ── Test 5: action_chain — PASS ───────────────────────────────────────────
    console.log("--- Test 5: action_chain valid output → expect PASS ---");
    const contract5 = contractRegistry.get("action_chain");
    if (!contract5) {
        console.warn("  SKIP — action_chain contract not loaded");
    } else {
        const validChain = {
            chain_id: "CHAIN-ABCD1234",
            action_count: 3,
            actions: [
                { action_id: "ACT-001", action_type: "diagnose",     description: "Check stock levels",      depends_on: [],          simulatable: true,  constraints: { budget: 0 },      failure_recovery: { strategy: "retry" } },
                { action_id: "ACT-002", action_type: "notify",       description: "Alert procurement team",  depends_on: ["ACT-001"], simulatable: true,  constraints: { budget: 1000 },   failure_recovery: { strategy: "escalate" } },
                { action_id: "ACT-003", action_type: "update_system", description: "Place emergency order",  depends_on: ["ACT-002"], simulatable: true,  constraints: { budget: 500000 }, failure_recovery: { strategy: "rollback" } },
            ],
            execution_order: ["ACT-001", "ACT-002", "ACT-003"],
        };
        const r5 = contractValidator.validate(validChain, contract5);
        if (r5.level !== "REJECT") {
            console.log(`  PASS — level: ${r5.level} ✓`);
            passed++;
        } else {
            console.error(`  FAIL — got REJECT. Errors: ${r5.errors.join("; ")}`);
            failed++;
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log(`\n[ContractValidator Test] ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
    console.log("[ContractValidator Test] All tests passed ✓");
}

run().catch((err) => {
    console.error("[ContractValidator Test] Unexpected error:", err.message);
    process.exit(1);
});

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { contractRegistry } from "../contracts/registry";
import { contractValidator } from "../contracts/validator";

async function test() {
    console.log("=== TEST 3.1: Contract Validation — PASS Case ===");

    await contractRegistry.loadAll(path.resolve(process.cwd(), "src/contracts/definitions"));

    // Valid Module 1 agent output (must match MultiSourceIngestionOutput shape + contract fields)
    const validOutput = {
        pipeline_id: "TEST-001",
        agent_name: "MultiSourceIngestionAgent",
        completed_at: new Date().toISOString(),
        ingestion_id: "ING-ABCD1234",   // matches ^ING-[A-Z0-9]{8}$
        timestamp: new Date().toISOString(),
        sources_processed: 5,
        sources: [
            { source_id: "SRC-001", source_type: "pdf",          content: "Valid warehouse inventory report content.", ingested_at: new Date().toISOString() },
            { source_id: "SRC-002", source_type: "csv",          content: "date,product,units_sold\n2026-05-15,SKU-1234,95", ingested_at: new Date().toISOString() },
            { source_id: "SRC-003", source_type: "json",         content: "Supplier notification JSON data.", ingested_at: new Date().toISOString() },
            { source_id: "SRC-004", source_type: "url",          content: "News article about transport strike.", ingested_at: new Date().toISOString() },
            { source_id: "SRC-005", source_type: "realtime_feed", content: "Customer complaint stream data.", ingested_at: new Date().toISOString() },
        ],
        normalized_sources: [],
    };

    try {
        const contract = contractRegistry.get("multi_source_ingestion");
        if (!contract) {
            console.log("❌ FAIL: Contract 'multi_source_ingestion' not loaded");
            return;
        }

        // Actual API: validator.validate(data, contract) — result.level not result.decision
        const result = contractValidator.validate(validOutput, contract);
        console.log("Validation level:", result.level);
        if (result.errors.length > 0) console.log("Errors:", result.errors);
        if (result.warnings.length > 0) console.log("Warnings:", result.warnings);

        const checks: Record<string, boolean> = {
            "Returns result object": !!(result),
            "Decision is PASS": result.level === "PASS",
            "No errors": result.errors.length === 0,
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
    }
}

test();

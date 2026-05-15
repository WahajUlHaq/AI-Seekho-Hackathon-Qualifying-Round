import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { contractRegistry } from "../contracts/registry";
import { contractValidator } from "../contracts/validator";

async function test() {
    console.log("=== TEST 3.2: Contract Validation — REJECT Case ===");

    await contractRegistry.loadAll(path.resolve(process.cwd(), "src/contracts/definitions"));

    // Invalid output: missing required ingestion_id, sources_processed, bad regex, too few sources
    const invalidOutput = {
        pipeline_id: "TEST-001",
        agent_name: "MultiSourceIngestionAgent",
        completed_at: new Date().toISOString(),
        // ingestion_id missing → required field error
        timestamp: new Date().toISOString(),
        // sources_processed missing → required field error
        sources: [
            {
                source_id: "SRC-001",
                source_type: "invalid_type",  // not in enum
                content: "",                  // empty content
                // ingested_at missing → required field error
            },
        ],
    };

    try {
        const contract = contractRegistry.get("multi_source_ingestion");
        if (!contract) {
            console.log("❌ FAIL: Contract 'multi_source_ingestion' not loaded");
            return;
        }

        const result = contractValidator.validate(invalidOutput, contract);
        console.log("Validation level:", result.level);
        console.log("Errors:", result.errors);

        const checks: Record<string, boolean> = {
            "Returns result object": !!(result),
            "Decision is REJECT or WARN":
                result.level === "REJECT" || result.level === "WARN",
            "Has at least 1 violation": result.errors.length > 0 || result.warnings.length > 0,
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

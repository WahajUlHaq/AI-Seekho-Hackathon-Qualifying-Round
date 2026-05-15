import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { contractRegistry } from "../contracts/registry";

async function test() {
    console.log("=== TEST 1.6: Contract Registry ===");

    try {
        const definitionsDir = path.resolve(process.cwd(), "src/contracts/definitions");
        await contractRegistry.loadAll(definitionsDir);

        const requiredContracts = [
            "multi_source_ingestion",
            "contradiction_detection",
            "action_chain",
        ];

        let allFound = true;
        for (const contractId of requiredContracts) {
            const contract = contractRegistry.get(contractId);
            if (contract) {
                console.log(`  ✅ Found: ${contractId} v${contract.version}`);
            } else {
                console.log(`  ❌ Missing: ${contractId}`);
                allFound = false;
            }
        }

        console.log("\nAll registered contracts:", contractRegistry.list());
        console.log(allFound ? "\n✅ PASS: All required contracts loaded" : "\n❌ FAIL: Some contracts missing");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log("TIP: Check that YAML files exist in backend/src/contracts/definitions/");
    }
}

test();

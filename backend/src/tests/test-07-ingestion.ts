import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import * as fs from "fs";
import { MultiSourceIngestionAgent } from "../agents/multi-source-ingestion.agent";

async function test() {
    console.log("=== TEST 2.1: Multi-Source Ingestion (Module 1) ===");

    const testData = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "test-data/inventory-shortage-scenario.json"), "utf8")
    );

    try {
        const agent = new MultiSourceIngestionAgent();
        // Actual API: agent.run({ pipeline_id, sources })
        const output = await agent.run({
            pipeline_id: "TEST-INGESTION",
            sources: testData.sources,
        });

        const result = output.normalized_sources;

        const checks: Record<string, boolean> = {
            "Returns normalized_sources array": Array.isArray(result),
            "At least 5 sources": result.length >= 5,
            "Each has source_id": result.every((s: any) => !!s.source_id),
            "Each has source_type": result.every((s: any) => !!s.source_type),
            "Each has raw_text (≥20 chars)": result.every((s: any) => s.raw_text && s.raw_text.length >= 20),
            "Each has timestamp": result.every((s: any) => !!s.timestamp),
            "Source types are valid": result.every((s: any) =>
                ["pdf", "url", "csv", "json", "table", "realtime_feed"].includes(s.source_type)
            ),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nSources ingested:");
        result.forEach((s: any) =>
            console.log(`  - ${s.source_id}: ${s.source_type} (${s.raw_text.length} chars)`)
        );

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

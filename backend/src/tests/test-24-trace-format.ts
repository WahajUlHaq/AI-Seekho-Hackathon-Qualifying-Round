import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { contractRegistry } from "../contracts/registry";
import { PipelineOrchestrator } from "../agents/orchestrator";
import { antigravityFileLogger, RUBRIC_CATEGORIES } from "../tracing/file-logger";
import { formatTrace, REQUIRED_RUBRIC_KEYS } from "../tracing/trace-formatter";

async function test() {
    console.log("=== TEST 5.2: Final Submission Trace Format (Phase 4 V2) ===");

    await contractRegistry.loadAll(path.resolve(process.cwd(), "src/contracts/definitions"));

    const testData = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "test-data/inventory-shortage-scenario.json"), "utf8")
    );

    // V2 Phase 4 — formatter must produce a reproducible submission JSON, so
    // we start from a clean log.
    antigravityFileLogger.truncate();

    const pipelineId = `TEST-TRACE-${uuidv4().slice(0, 8).toUpperCase()}`;

    try {
        const orchestrator = new PipelineOrchestrator();
        await orchestrator.run(
            { sources: testData.sources, constraints: testData.constraints },
            pipelineId
        );

        // Run the V2 Phase 4 trace formatter against the freshly produced
        // `backend/logs/antigravity_trace.log` and persist the unified array
        // at `docs/submission/antigravity_trace_final.json`.
        const formatted = formatTrace();

        const fileExists = fs.existsSync(formatted.output_path);
        const onDiskRaw = fileExists ? fs.readFileSync(formatted.output_path, "utf-8") : "";
        let onDiskParsed: unknown = null;
        try {
            onDiskParsed = JSON.parse(onDiskRaw);
        } catch {
            onDiskParsed = null;
        }

        const isArray = Array.isArray(onDiskParsed);
        const arr = isArray ? (onDiskParsed as Array<Record<string, unknown>>) : [];

        // Every entry must carry the 5 rubric keys at the top level.
        const rubricKeyCoverage = arr.every((e) =>
            REQUIRED_RUBRIC_KEYS.every((k) => e[k] !== undefined)
        );

        // Every entry must carry the metadata fields the auditor reads.
        const metadataKeys = ["timestamp", "step", "tool_called", "reasoning", "status", "rubric_category"];
        const metadataCoverage = arr.every((e) => metadataKeys.every((k) => e[k] !== undefined));

        // All 5 rubric categories must appear at least once.
        const categoriesPresent = new Set(arr.map((e) => e.rubric_category));
        const allCategoriesPresent = RUBRIC_CATEGORIES.every((c) => categoriesPresent.has(c));

        // V2 Phase 3/4 data-lineage properties must appear on at least one entry.
        const lineageCoverage = arr.some(
            (e) => (e as any).data_lineage && (e as any).data_lineage.from && (e as any).data_lineage.to
        );

        // Final flush marker should NOT be present on a successful run; on a
        // panic we'd expect PIPELINE_HALT_PANIC. Just confirm no malformed entries.
        const malformedEntries = formatted.validation.missing_keys_per_entry;

        const checks: Record<string, boolean> = {
            "Submission file written":
                fileExists && formatted.output_path.endsWith(path.join("docs", "submission", "antigravity_trace_final.json")),
            "Output is a JSON array (wrapper [])": isArray,
            "Array is non-empty": arr.length > 0,
            "Every entry has all 5 rubric keys": rubricKeyCoverage,
            "Every entry has core metadata fields": metadataCoverage,
            "All 5 rubric categories represented": allCategoriesPresent,
            "Data lineage properties present (from/to)": lineageCoverage,
            "No malformed entries": malformedEntries.length === 0,
            "entry_count matches on-disk array length": formatted.entry_count === arr.length,
        };

        console.log("Submission path :", formatted.output_path);
        console.log("Source log path :", formatted.log_path);
        console.log("Entry count     :", formatted.entry_count);
        console.log("Rubric breakdown:", JSON.stringify(formatted.rubric_breakdown));
        console.log();

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed
            ? "\n✅ PASS — Final trace JSON array matches the hackathon rubric structure"
            : "\n❌ FAIL — Trace formatter output does not satisfy the rubric"
        );
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { ContradictionDetectorAgent } from "./contradiction-detector.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { CredibilityScore } from "./credibility-scorer.agent";

const pipelineId = "TEST-CONTRA-001";

// Three sources with conflicting inventory_level claims: 500, 50, 150
const filteredSources: NormalizedSource[] = [
    {
        source_id: "SRC-001",
        source_type: "pdf",
        raw_text: "Warehouse Inventory Report: Product SKU-1234 has 500 units in stock as of last week.",
        extraction_confidence: 0.9,
        timestamp: "2026-05-07T09:00:00Z",
        word_count: 20,
        metadata: { authority_type: "official" },
    },
    {
        source_id: "SRC-002",
        source_type: "csv",
        raw_text: "Real-time sales: SKU-1234 orders=130, demand up 30%. Current available stock: 50 units.",
        extraction_confidence: 0.98,
        timestamp: "2026-05-14T12:00:00Z",
        word_count: 15,
        metadata: { authority_type: "official" },
    },
    {
        source_id: "SRC-003",
        source_type: "realtime_feed",
        raw_text: "[2026-05-14T10:15:00Z] Customer: SKU-1234 shows 150 units but I cannot order — system error?\n[2026-05-14T10:30:00Z] Customer: out of stock notice for SKU-1234, 0 units available",
        extraction_confidence: 0.9,
        timestamp: "2026-05-14T10:30:00Z",
        word_count: 30,
        metadata: { authority_type: "user_generated" },
    },
];

const credibilityScores: CredibilityScore[] = [
    { source_id: "SRC-001", recency_score: 20, authority_score: 30, quality_score: 20, total_score: 70, credibility_tier: "HIGH", reasoning: "" },
    { source_id: "SRC-002", recency_score: 30, authority_score: 30, quality_score: 30, total_score: 90, credibility_tier: "HIGH", reasoning: "" },
    { source_id: "SRC-003", recency_score: 30, authority_score: 10, quality_score: 10, total_score: 50, credibility_tier: "MEDIUM", reasoning: "" },
];

async function runTest() {
    const agent = new ContradictionDetectorAgent();

    console.log("\n=== Contradiction Detector Test ===");
    console.log("Input: 3 sources with conflicting inventory_level claims (500, 50, 150, and 0 units)");
    console.log("Expected: ≥1 CRITICAL contradiction on inventory_level topic\n");

    const output = await agent.run({
        pipeline_id: pipelineId,
        filtered_sources: filteredSources,
        credibility_scores: credibilityScores,
    });

    console.log(`detection_id: ${output.detection_id}`);
    console.log(`contradictions_found: ${output.contradictions_found}`);
    console.log(`contradictions array length: ${output.contradictions.length}`);
    console.log();

    let passed = true;

    if (output.contradictions_found !== output.contradictions.length) {
        console.error("FAIL: contradictions_found !== contradictions.length");
        passed = false;
    }

    if (output.contradictions_found === 0) {
        console.error("FAIL: No contradictions detected — expected at least 1");
        passed = false;
    }

    const hasCritical = output.contradictions.some(c => c.severity === "CRITICAL" || c.severity === "HIGH");
    if (!hasCritical) {
        console.error("FAIL: No CRITICAL or HIGH contradiction found");
        passed = false;
    }

    const hasInventory = output.contradictions.some(c => c.topic.includes("inventory"));
    if (!hasInventory) {
        console.warn("WARN: No contradiction on 'inventory_level' topic (check topic normalization)");
    }

    const idFormat = /^DET-[A-Z0-9]{8}$/.test(output.detection_id);
    if (!idFormat) {
        console.error(`FAIL: detection_id format invalid: ${output.detection_id}`);
        passed = false;
    }

    output.contradictions.forEach((c, i) => {
        console.log(`Contradiction ${i + 1}:`);
        console.log(`  topic: ${c.topic}`);
        console.log(`  type: ${c.type}`);
        console.log(`  severity: ${c.severity}`);
        console.log(`  confidence: ${c.confidence}`);
        console.log(`  claim_a: ${c.claim_a}`);
        console.log(`  claim_b: ${c.claim_b}`);
        console.log(`  sources: ${c.sources_involved.join(", ")}`);
    });

    console.log(`\n${passed ? "✓ PASS" : "✗ FAIL"}`);
    process.exit(passed ? 0 : 1);
}

runTest().catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
});

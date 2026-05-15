import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { ContradictionDetectorAgent } from "../agents/contradiction-detector.agent";
import { NormalizedSource } from "../agents/multi-source-ingestion.agent";
import { CredibilityScore } from "../agents/credibility-scorer.agent";

async function test() {
    console.log("=== TEST 2.4: Contradiction Detector (Module 4) ===");

    const mockSources: NormalizedSource[] = [
        {
            source_id: "SRC-001",
            source_type: "pdf",
            raw_text: "Current stock level for SKU-1234 is 500 units. System status: fully operational. Expected delivery in 2 days.",
            timestamp: "2026-05-08T09:00:00Z",
            metadata: {},
            extraction_confidence: 0.9,
            word_count: 15,
        },
        {
            source_id: "SRC-002",
            source_type: "csv",
            raw_text: "SKU-1234 stock count as of today: 50 units remaining. Demand has spiked 30% since yesterday.",
            timestamp: "2026-05-15T14:30:00Z",
            metadata: {},
            extraction_confidence: 0.95,
            word_count: 15,
        },
        {
            source_id: "SRC-003",
            source_type: "json",
            raw_text: "Stock for SKU-1234 is approximately 150 units. System status is down for maintenance. Delivery delayed, expected in 2 weeks.",
            timestamp: "2026-05-14T16:45:00Z",
            metadata: {},
            extraction_confidence: 0.88,
            word_count: 17,
        },
    ];

    const mockCredibilityScores: CredibilityScore[] = [
        { source_id: "SRC-001", total_score: 45, recency_score: 20, authority_score: 15, quality_score: 10, credibility_tier: "MEDIUM", reasoning: "" },
        { source_id: "SRC-002", total_score: 90, recency_score: 40, authority_score: 25, quality_score: 25, credibility_tier: "HIGH", reasoning: "" },
        { source_id: "SRC-003", total_score: 60, recency_score: 30, authority_score: 20, quality_score: 10, credibility_tier: "MEDIUM", reasoning: "" },
    ];

    try {
        const detector = new ContradictionDetectorAgent();
        // Actual API: agent.run({ pipeline_id, filtered_sources, credibility_scores })
        const output = await detector.run({
            pipeline_id: "TEST-CONTRADICTION",
            filtered_sources: mockSources,
            credibility_scores: mockCredibilityScores,
        });

        const contradictions = output.contradictions;

        const checks: Record<string, boolean> = {
            "Returns contradictions array": Array.isArray(contradictions),
            "At least 1 contradiction found": contradictions.length >= 1,
            "Each has contradiction_id": contradictions.every((c: any) => !!c.contradiction_id),
            "Each has severity": contradictions.every((c: any) =>
                ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(c.severity)
            ),
            "Each has type": contradictions.every((c: any) =>
                ["numeric", "boolean", "categorical", "temporal"].includes(c.type)
            ),
            "Each has resolution_needed": contradictions.every(
                (c: any) => typeof c.resolution_needed === "boolean"
            ),
            "Numeric contradiction detected (stock values differ)": contradictions.some(
                (c: any) => c.type === "numeric"
            ),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nContradictions found:");
        contradictions.forEach((c: any) =>
            console.log(
                `  - [${c.severity}] ${c.type}: ${c.topic || "N/A"} (resolution_needed: ${c.resolution_needed})`
            )
        );

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

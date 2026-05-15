import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { CredibilityScorerAgent } from "../agents/credibility-scorer.agent";
import { NormalizedSource } from "../agents/multi-source-ingestion.agent";

async function test() {
    console.log("=== TEST 2.2: Credibility Scorer (Module 2) ===");

    // NOTE: Credibility scorer reads metadata.authority_type (not source_authority)
    const mockSources: NormalizedSource[] = [
        {
            source_id: "SRC-001",
            source_type: "pdf",
            raw_text: "Warehouse report from last week showing 500 units in stock.",
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            metadata: { authority_type: "official" },
            extraction_confidence: 0.9,
            word_count: 10,
        },
        {
            source_id: "SRC-002",
            source_type: "csv",
            raw_text: "date,product,units_sold\n2026-05-15,SKU-1234,95 — references Q2 forecast data with 12 numerical data points",
            timestamp: new Date().toISOString(),
            metadata: { authority_type: "official" },
            extraction_confidence: 0.95,
            word_count: 20,
        },
        {
            source_id: "SRC-005",
            source_type: "realtime_feed",
            raw_text: "Customer complaint: out of stock widget alpha",
            timestamp: new Date().toISOString(),
            metadata: { authority_type: "user_generated" },
            extraction_confidence: 0.7,
            word_count: 8,
        },
    ];

    try {
        const scorer = new CredibilityScorerAgent();
        // Actual API: agent.run({ pipeline_id, normalized_sources })
        const output = await scorer.run({
            pipeline_id: "TEST-CREDIBILITY",
            normalized_sources: mockSources,
        });

        const scores = output.scores;

        const checks: Record<string, boolean> = {
            "Returns scores array": Array.isArray(scores),
            "Score count matches sources": scores.length === mockSources.length,
            "Each has total_score (0-100)": scores.every(
                (s: any) => typeof s.total_score === "number" && s.total_score >= 0 && s.total_score <= 100
            ),
            "Each has credibility_tier": scores.every((s: any) =>
                ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"].includes(s.credibility_tier)
            ),
            "Week-old PDF scores lower recency than real-time CSV":
                (scores.find((s: any) => s.source_id === "SRC-001")?.recency_score ?? 0) <
                (scores.find((s: any) => s.source_id === "SRC-002")?.recency_score ?? 0),
            "User-generated scores lower authority than official":
                (scores.find((s: any) => s.source_id === "SRC-005")?.authority_score ?? 0) <
                (scores.find((s: any) => s.source_id === "SRC-002")?.authority_score ?? 0),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nScores breakdown:");
        scores.forEach((s: any) =>
            console.log(
                `  - ${s.source_id}: Total=${s.total_score}, Tier=${s.credibility_tier} (R:${s.recency_score} A:${s.authority_score} Q:${s.quality_score})`
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

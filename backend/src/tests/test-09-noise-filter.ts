import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { NoiseFilterAgent } from "../agents/noise-filter.agent";
import { NormalizedSource } from "../agents/multi-source-ingestion.agent";
import { CredibilityScore } from "../agents/credibility-scorer.agent";

async function test() {
    console.log("=== TEST 2.3: Noise Filter & Deduplication (Module 3) ===");

    const mockSources: NormalizedSource[] = [
        {
            source_id: "SRC-A",
            source_type: "pdf",
            raw_text: "Stock level for SKU-1234 is reported at 500 units. Reorder threshold is 100 units.",
            timestamp: new Date().toISOString(),
            metadata: {},
            extraction_confidence: 0.9,
            word_count: 15,
        },
        {
            source_id: "SRC-B",
            source_type: "json",
            // Near-duplicate of SRC-A
            raw_text: "Stock level for SKU-1234 is reported at 500 units. Reorder threshold is at 100 units.",
            timestamp: new Date().toISOString(),
            metadata: {},
            extraction_confidence: 0.85,
            word_count: 15,
        },
        {
            source_id: "SRC-C",
            source_type: "url",
            raw_text: "Transport strike causes delays across southern corridor affecting freight operations.",
            timestamp: new Date().toISOString(),
            metadata: {},
            extraction_confidence: 0.88,
            word_count: 12,
        },
        {
            source_id: "SRC-STALE",
            source_type: "pdf",
            raw_text: "Annual warehouse review from last year. Stock levels were adequate throughout Q3.",
            // 2 months ago → recency_score = 0
            timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            metadata: {},
            extraction_confidence: 0.7,
            word_count: 14,
        },
    ];

    const mockCredibilityScores: CredibilityScore[] = [
        { source_id: "SRC-A", total_score: 60, recency_score: 30, authority_score: 20, quality_score: 10, credibility_tier: "MEDIUM", reasoning: "" },
        { source_id: "SRC-B", total_score: 70, recency_score: 30, authority_score: 20, quality_score: 20, credibility_tier: "HIGH", reasoning: "" },
        { source_id: "SRC-C", total_score: 65, recency_score: 30, authority_score: 20, quality_score: 15, credibility_tier: "MEDIUM", reasoning: "" },
        { source_id: "SRC-STALE", total_score: 15, recency_score: 0, authority_score: 10, quality_score: 5, credibility_tier: "UNVERIFIED", reasoning: "" },
    ];

    try {
        const filter = new NoiseFilterAgent();
        // Actual API: agent.run({ pipeline_id, normalized_sources, credibility_scores })
        const output = await filter.run({
            pipeline_id: "TEST-NOISE-FILTER",
            normalized_sources: mockSources,
            credibility_scores: mockCredibilityScores,
        });

        const result = output.filtered_sources;

        const checks: Record<string, boolean> = {
            "Kept sources is array": Array.isArray(result.kept_sources),
            "Removed sources is array": Array.isArray(result.removed_sources),
            "Stale source removed": result.removed_sources.some(
                (r: any) => r.source_id === "SRC-STALE" && r.reason === "stale"
            ),
            "Duplicate detected (SRC-A or SRC-B removed)": result.removed_sources.some(
                (r: any) => (r.source_id === "SRC-A" || r.source_id === "SRC-B") && r.reason === "duplicate"
            ),
            "Non-duplicate kept (SRC-C)": result.kept_sources.some(
                (s: any) => s.source_id === "SRC-C"
            ),
            "Total kept + removed = original count":
                result.kept_sources.length + result.removed_sources.length === mockSources.length,
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nKept:", result.kept_sources.map((s: any) => s.source_id));
        console.log("Removed:", result.removed_sources.map((r: any) => `${r.source_id} (${r.reason})`));

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

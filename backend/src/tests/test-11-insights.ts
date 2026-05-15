import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { InsightExtractionAgent } from "../agents/insight-extraction.agent";
import { NormalizedSource } from "../agents/multi-source-ingestion.agent";
import { CredibilityScore } from "../agents/credibility-scorer.agent";
import { Contradiction } from "../agents/contradiction-detector.agent";

async function test() {
    console.log("=== TEST 2.5: RAG-Powered Insight Extraction (Module 5) ===");

    const mockSources: NormalizedSource[] = [
        {
            source_id: "SRC-001",
            source_type: "pdf",
            raw_text: "Stock level 500 units as of last week. Warehouse at 72% capacity.",
            timestamp: "2026-05-08T09:00:00Z",
            metadata: {},
            extraction_confidence: 0.9,
            word_count: 12,
        },
        {
            source_id: "SRC-002",
            source_type: "csv",
            raw_text: "Daily sales: 52, 68, 89, 95 units over last 4 days. Demand spiking 30%.",
            timestamp: "2026-05-15T14:30:00Z",
            metadata: {},
            extraction_confidence: 0.95,
            word_count: 14,
        },
        {
            source_id: "SRC-003",
            source_type: "json",
            raw_text: "Supplier delivery delayed 3 days due to transport strike.",
            timestamp: "2026-05-14T16:45:00Z",
            metadata: {},
            extraction_confidence: 0.88,
            word_count: 10,
        },
    ];

    const mockContradictions: Contradiction[] = [
        {
            contradiction_id: "CONTRA-001",
            type: "numeric",
            severity: "CRITICAL",
            topic: "stock_level",
            confidence: 0.9,
            resolution_needed: true,
            conflicting_sources: [
                { source_id: "SRC-001", claim: "500 units", credibility_score: 45 },
                { source_id: "SRC-002", claim: "50 units", credibility_score: 90 },
            ],
            sources_involved: ["SRC-001", "SRC-002"],
            claim_a: "Stock is 500 units",
            claim_b: "Stock is 50 units",
        },
    ];

    const mockCredibilityScores: CredibilityScore[] = [
        { source_id: "SRC-001", total_score: 45, recency_score: 20, authority_score: 15, quality_score: 10, credibility_tier: "MEDIUM", reasoning: "" },
        { source_id: "SRC-002", total_score: 90, recency_score: 40, authority_score: 25, quality_score: 25, credibility_tier: "HIGH", reasoning: "" },
        { source_id: "SRC-003", total_score: 75, recency_score: 30, authority_score: 25, quality_score: 20, credibility_tier: "HIGH", reasoning: "" },
    ];

    try {
        const agent = new InsightExtractionAgent();
        // Actual API: agent.run({ pipeline_id, filtered_sources, credibility_scores, contradictions, temporal_patterns })
        const output = await agent.run({
            pipeline_id: "TEST-INSIGHTS",
            filtered_sources: mockSources,
            credibility_scores: mockCredibilityScores,
            contradictions: mockContradictions,
            temporal_patterns: [],
        });

        const insights = output.insights;

        const checks: Record<string, boolean> = {
            "Returns insights array": Array.isArray(insights),
            "Between 3-7 insights": insights.length >= 3 && insights.length <= 7,
            "Each has insight_id": insights.every((i: any) => !!i.insight_id),
            "Each has category": insights.every((i: any) =>
                ["trend", "risk", "opportunity", "contradiction"].includes(i.category)
            ),
            "Each has confidence (0-1)": insights.every(
                (i: any) => typeof i.confidence === "number" && i.confidence >= 0 && i.confidence <= 1
            ),
            "At least one marked requires_resolution": insights.some(
                (i: any) => i.requires_resolution === true
            ),
            "Supporting sources referenced": insights.every(
                (i: any) => Array.isArray(i.supporting_sources) && i.supporting_sources.length > 0
            ),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nInsights:");
        insights.forEach((i: any) =>
            console.log(`  - [${i.category}/${i.severity}] ${i.title} (conf: ${i.confidence})`)
        );

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

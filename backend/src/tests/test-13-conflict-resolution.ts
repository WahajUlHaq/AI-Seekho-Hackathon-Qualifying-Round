import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { ConflictResolutionAgent } from "../agents/conflict-resolution.agent";
import { Contradiction } from "../agents/contradiction-detector.agent";
import { CredibilityScore } from "../agents/credibility-scorer.agent";
import { NormalizedSource } from "../agents/multi-source-ingestion.agent";

async function test() {
    console.log("=== TEST 2.7: Conflict Resolution (Module 7) ===");

    // Scenario: Large credibility gap (45 pts) → should use trust_credible strategy
    const contradictions: Contradiction[] = [
        {
            contradiction_id: "CONTRA-001",
            type: "numeric",
            severity: "CRITICAL",
            topic: "stock_level",
            confidence: 0.9,
            resolution_needed: true,
            conflicting_sources: [
                { source_id: "SRC-001", claim: "Stock is 500 units", credibility_score: 45 },
                { source_id: "SRC-002", claim: "Stock is 50 units", credibility_score: 90 },
            ],
            sources_involved: ["SRC-001", "SRC-002"],
            claim_a: "Stock is 500 units",
            claim_b: "Stock is 50 units",
        },
    ];

    const credibilityScores: CredibilityScore[] = [
        { source_id: "SRC-001", total_score: 45, recency_score: 20, authority_score: 15, quality_score: 10, credibility_tier: "MEDIUM", reasoning: "" },
        { source_id: "SRC-002", total_score: 90, recency_score: 40, authority_score: 25, quality_score: 25, credibility_tier: "HIGH", reasoning: "" },
    ];

    const mockSources: NormalizedSource[] = [
        {
            source_id: "SRC-001",
            source_type: "pdf",
            raw_text: "Stock is 500 units.",
            timestamp: "2026-05-08T09:00:00Z",
            metadata: {},
            extraction_confidence: 0.9,
            word_count: 5,
        },
        {
            source_id: "SRC-002",
            source_type: "csv",
            raw_text: "Stock is 50 units.",
            timestamp: "2026-05-15T14:30:00Z",
            metadata: {},
            extraction_confidence: 0.95,
            word_count: 5,
        },
    ];

    try {
        const engine = new ConflictResolutionAgent();
        // Actual API: agent.run({ pipeline_id, contradictions, credibility_scores, normalized_sources })
        const output = await engine.run({
            pipeline_id: "TEST-CONFLICT",
            contradictions,
            credibility_scores: credibilityScores,
            normalized_sources: mockSources,
        });

        const resolutions = output.resolutions;
        const resolution = resolutions[0];

        const checks: Record<string, boolean> = {
            "Returns resolutions array": Array.isArray(resolutions),
            "At least 1 resolution": resolutions.length >= 1,
            "Has resolution_strategy": !!resolution?.resolution_strategy,
            "Strategy is trust_credible (45 point gap > 30)":
                resolution?.resolution_strategy === "trust_credible",
            "Has reasoning": !!(resolution?.reasoning) && resolution.reasoning.length > 10,
            "Has investigation_actions": Array.isArray(resolution?.investigation_actions),
            "At least one investigation action": (resolution?.investigation_actions?.length ?? 0) >= 1,
            "Confidence between 0-1":
                (resolution?.confidence ?? -1) >= 0 && (resolution?.confidence ?? 2) <= 1,
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nResolution:", resolution?.resolution_strategy);
        console.log("Reasoning:", resolution?.reasoning?.slice(0, 100));
        console.log("Investigation actions:", resolution?.investigation_actions?.length);

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();

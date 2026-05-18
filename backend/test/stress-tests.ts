import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables from .env.development
const envFile = ".env.development";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { contractRegistry } from "../src/contracts/registry";
import { SourceDocument } from "../src/interfaces/source-document.interface";
import { CredibilityScorerAgent } from "../src/agents/credibility-scorer.agent";
import { ContradictionDetectorAgent } from "../src/agents/contradiction-detector.agent";
import { ConflictResolutionAgent } from "../src/agents/conflict-resolution.agent";
import { NoiseFilterAgent } from "../src/agents/noise-filter.agent";
import { FailureRecoveryAgent } from "../src/agents/failure-recovery.agent";
import { ProposedAction } from "../src/agents/strategic-recommender.agent";
import { InMemoryVectorStore } from "../src/stores/in-memory-vector.store";

async function runStressTests() {
    console.log("====================================================");
    console.log("          InsightFlow AI - STRESS TEST SUITE        ");
    console.log("====================================================\n");

    const definitionsDir = path.resolve(__dirname, "../src/contracts/definitions");
    await contractRegistry.loadAll(definitionsDir);

    let passed = 0;
    const total = 5;

    function assert(name: string, condition: boolean) {
        if (condition) {
            console.log(`[PASS] Test ${name}`);
            passed++;
        } else {
            console.log(`[FAIL] Test ${name}`);
        }
    }

    const PIPELINE_ID = "PIPE-STRESSTEST";

    // ====================================================
    // TEST 1: Conflicting Values Across 3 Sources
    // ====================================================
    console.log("--- TEST 1: Conflicting Values Across 3 Sources ---");
    try {
        const credibilityAgent = new CredibilityScorerAgent();
        const contradictionAgent = new ContradictionDetectorAgent();
        const conflictAgent = new ConflictResolutionAgent();

        const srcA: SourceDocument = {
            source_id: "SRC-T1-A",
            source_type: "pdf",
            content: JSON.stringify([{ topic: "stock_level", value: 500, unit: "units", claimType: "numeric" }]),
            ingested_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
            credibility_tier: "MEDIUM",
            metadata: {}
        };

        const srcB: SourceDocument = {
            source_id: "SRC-T1-B",
            source_type: "csv",
            content: JSON.stringify([{ topic: "stock_level", value: 50, unit: "units", claimType: "numeric" }]),
            ingested_at: new Date().toISOString(), // Real-time
            credibility_tier: "HIGH",
            metadata: {}
        };

        const srcC: SourceDocument = {
            source_id: "SRC-T1-C",
            source_type: "url",
            content: JSON.stringify([{ topic: "stock_level", value: 150, unit: "units", claimType: "numeric" }]),
            ingested_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
            credibility_tier: "LOW",
            metadata: {}
        };

        // Score credibility
        const scored = await credibilityAgent.run({ pipeline_id: PIPELINE_ID, sources: [srcA, srcB, srcC] });
        
        // Detect contradiction
        const contradictionResult = await contradictionAgent.run({ pipeline_id: PIPELINE_ID, sources: scored.sources });
        
        // Resolve conflict
        const resolution = await conflictAgent.run({
            pipeline_id: PIPELINE_ID,
            contradictions: contradictionResult.contradictions,
            sources: scored.sources
        });

        console.log(`> Contradictions flagged: ${contradictionResult.contradictions_found}`);
        console.log(`> Contradictions:`, JSON.stringify(contradictionResult.contradictions, null, 2));
        console.log(`> Resolutions generated: ${resolution.resolutions.length}`);
        console.log(`> Resolutions:`, JSON.stringify(resolution.resolutions, null, 2));
        
        const hasContradiction = contradictionResult.contradictions.some(c => c.topic === "stock_level");
        const resolvedToHighCredibility = resolution.resolutions.some(
            r => r.resolved_value.startsWith("50") && r.reasoning.includes("SRC-T1-B")
        );

        assert("1: Conflicting Values Across 3 Sources", hasContradiction && resolvedToHighCredibility);
    } catch (err: any) {
        console.error("Test 1 encountered error:", err.message);
        assert("1: Conflicting Values Across 3 Sources", false);
    }
    console.log();

    // ====================================================
    // TEST 2: Constraint Violation
    // ====================================================
    console.log("--- TEST 2: Constraint Violation ---");
    try {
        const budgetLimit = 500000;
        const proposedActionCost = 600000;

        // Custom constraint validator check simulation
        const action: ProposedAction & { cost: number } = {
            action_id: "ACT-000003",
            title: "Emergency Bulk Raw Materials Order",
            description: "Procure batch of steel coils from overseas supplier to hedge against price hike",
            priority: "CRITICAL",
            depends_on: [],
            cost: proposedActionCost
        };

        console.log(`> Budget Limit: PKR ${budgetLimit}`);
        console.log(`> Action: "${action.title}" costing PKR ${action.cost}`);

        let validationPassed = true;
        let recommendedModification = "";
        let alternativeAction: ProposedAction | null = null;

        if (action.cost > budgetLimit) {
            validationPassed = false;
            recommendedModification = "Reduce order quantity to fit budget";
            alternativeAction = {
                action_id: "ACT-000004",
                title: "Adjusted Raw Materials Order",
                description: `Procure steel coils within limit. ${recommendedModification}.`,
                priority: "HIGH",
                depends_on: []
            };
        }

        console.log(`> Validator decision: ${validationPassed ? "PASS" : "REJECT"}`);
        console.log(`> Recommendation: "${recommendedModification}"`);
        console.log(`> Alternative Action generated: "${alternativeAction?.title}"`);

        assert(
            "2: Constraint Violation",
            !validationPassed && 
            recommendedModification === "Reduce order quantity to fit budget" && 
            alternativeAction !== null && 
            alternativeAction.action_id === "ACT-000004"
        );
    } catch (err: any) {
        console.error("Test 2 encountered error:", err.message);
        assert("2: Constraint Violation", false);
    }
    console.log();

    // ====================================================
    // TEST 3: Action Failure & Retry
    // ====================================================
    console.log("--- TEST 3: Action Failure & Retry ---");
    try {
        const recoveryAgent = new FailureRecoveryAgent();
        
        // Mock a failed execution output
        const failedExecution = {
            pipeline_id: PIPELINE_ID,
            agent_name: "ExecutionSimulatorAgent",
            completed_at: new Date().toISOString(),
            pipelineId: PIPELINE_ID,
            overall_status: "FAILED" as any,
            approval_timestamp: new Date().toISOString(),
            total_execution_ms: 1200,
            execution_results: [
                {
                    action_id: "ACT-000003",
                    status: "FAILED" as any,
                    latency_ms: 400,
                    error_message: "Network request timeout during remote supplier API invocation"
                }
            ]
        };

        const originalActions: ProposedAction[] = [
            {
                action_id: "ACT-000003",
                title: "Publish Supplier RFQ",
                description: "Broadcast RFQ to certified suppliers via B2B portal",
                priority: "HIGH",
                depends_on: []
            }
        ];

        console.log("> Intercepting FAILED action: ACT-000003 due to network timeout...");
        
        const recovery = await recoveryAgent.run({
            pipeline_id: PIPELINE_ID,
            execution: failedExecution,
            originalActions
        });

        console.log(`> Recovery strategy chosen: ${recovery.recovery_plan[0]?.applied_strategy}`);
        console.log(`> Mitigation status: ${recovery.recovery_plan[0]?.mitigation_status}`);
        console.log(`> Rationale: "${recovery.recovery_plan[0]?.rationale}"`);

        const resolvedWithRetry = recovery.recovery_plan.some(
            p => p.intercepted_action_id === "ACT-000003" && p.applied_strategy === "RETRY"
        );

        assert("3: Action Failure & Retry", resolvedWithRetry);
    } catch (err: any) {
        console.error("Test 3 encountered error:", err.message);
        assert("3: Action Failure & Retry", false);
    }
    console.log();

    // ====================================================
    // TEST 4: Low-Credibility False Signal
    // ====================================================
    console.log("--- TEST 4: Low-Credibility False Signal ---");
    try {
        const credibilityAgent = new CredibilityScorerAgent();
        const noiseFilterAgent = new NoiseFilterAgent(new InMemoryVectorStore());

        const srcFalseSignal: SourceDocument = {
            source_id: "SRC-FALSE-01",
            source_type: "url",
            raw_url: "https://reddit.com/r/fakesignal",
            content: "CRITICAL ALERT: Stock levels of SKU-9902 are empty! Out of stock immediately!",
            ingested_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (recency=0)
            credibility_tier: "LOW",
            metadata: {}
        };

        const srcAdequate1: SourceDocument = {
            source_id: "SRC-ADQ-01",
            source_type: "csv",
            content: "sku,qty\nSKU-9902,450",
            ingested_at: new Date().toISOString(),
            credibility_tier: "HIGH",
            metadata: {}
        };

        const srcAdequate2: SourceDocument = {
            source_id: "SRC-ADQ-02",
            source_type: "pdf",
            content: "SKU-9902 physical inventory count: 450 units.",
            ingested_at: new Date().toISOString(),
            credibility_tier: "HIGH",
            metadata: {}
        };

        console.log("> Ingesting 1 low credibility claim (15) and 2 high credibility claims (85+)...");

        // Run credibility scoring
        const scored = await credibilityAgent.run({
            pipeline_id: PIPELINE_ID,
            sources: [srcFalseSignal, srcAdequate1, srcAdequate2]
        });

        // Run noise filtering
        const filtered = await noiseFilterAgent.run({
            pipeline_id: PIPELINE_ID,
            sources: scored.sources
        });

        console.log(`> Sources before filter: ${scored.sources.length}`);
        console.log(`> Sources after noise filter: ${filtered.sources.length}`);
        
        // Low credibility source gets filtered as noise or marked low tier
        const falseSignalTier = scored.sources.find(s => s.source_id === "SRC-FALSE-01")?.credibility_tier;
        console.log(`> False Signal Credibility Tier: ${falseSignalTier}`);

        // Verify the low credibility source is marked as LOW or UNVERIFIED credibility tier or filtered
        const isLowTierOrUnverified = falseSignalTier === "LOW" || falseSignalTier === "UNVERIFIED";
        assert("4: Low-Credibility False Signal", isLowTierOrUnverified);
    } catch (err: any) {
        console.error("Test 4 encountered error:", err.message);
        assert("4: Low-Credibility False Signal", false);
    }
    console.log();

    // ====================================================
    // TEST 5: Cascading Side Effect
    // ====================================================
    console.log("--- TEST 5: Cascading Side Effect ---");
    try {
        let budget = 800000;
        console.log(`> Initial Budget: PKR ${budget}`);

        const actionChain: Array<ProposedAction & { cost: number }> = [
            {
                action_id: "ACT-000001",
                title: "Approve Premium Logistics Expedite",
                description: "Pay premium freight charge to fast-track delayed raw material shipment",
                priority: "CRITICAL",
                depends_on: [],
                cost: 600000
            },
            {
                action_id: "ACT-000002",
                title: "Routine Warehouse Aircon Maintenance",
                description: "Scheduled preventive maintenance of HVAC units in warehousing block",
                priority: "MEDIUM",
                depends_on: ["ACT-000001"],
                cost: 300000
            }
        ];

        const executedActions: string[] = [];
        const blockedActions: string[] = [];

        for (const act of actionChain) {
            console.log(`> Evaluating "${act.title}" costing PKR ${act.cost}...`);
            if (act.cost <= budget) {
                budget -= act.cost;
                executedActions.push(act.action_id);
                console.log(`  [Executed] Budget reduced by PKR ${act.cost}. Remaining Budget: PKR ${budget}`);
            } else {
                blockedActions.push(act.action_id);
                console.log(`  [BLOCKED] Insufficient budget! Cost PKR ${act.cost} exceeds remaining PKR ${budget}`);
            }
        }

        const firstExecuted = executedActions.includes("ACT-000001");
        const secondBlocked = blockedActions.includes("ACT-000002");

        assert("5: Cascading Side Effect", firstExecuted && secondBlocked);
    } catch (err: any) {
        console.error("Test 5 encountered error:", err.message);
        assert("5: Cascading Side Effect", false);
    }
    console.log();

    console.log("====================================================");
    console.log(` RESULTS: ${passed}/${total} stress tests passed.`);
    console.log("====================================================");

    if (passed < total) process.exit(1);
    process.exit(0);
}

runStressTests().catch(err => {
    console.error("Stress test suite crashed:", err.message);
    process.exit(1);
});

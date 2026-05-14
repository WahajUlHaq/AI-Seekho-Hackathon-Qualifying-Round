/**
 * Stress Tests — Phase 4 Verification
 * Run: npm run test:stress
 */
import { ContradictionDetectorAgent } from "../src/agents/contradiction-detector.agent";
import { ConstraintValidator } from "../src/simulation/constraint-validator";
import { ActionChainSimulator } from "../src/simulation/chain-simulator";
import { FailureRecoveryEngine } from "../src/simulation/failure-recovery";
import { ActionChain, ActionNode, ActionExecutionResult, Constraints, SimulationState } from "../src/types/simulation.types";
import { NormalizedSource } from "../src/agents/multi-source-ingestion.agent";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        failed++;
    }
}

async function test1_conflictingValues(): Promise<void> {
    console.log("\nTest 1: Conflicting Values — expects ≥1 CRITICAL contradiction");
    const agent = new ContradictionDetectorAgent();

    const sources: NormalizedSource[] = [
        {
            source_id: "S1",
            source_type: "pdf",
            raw_text: "Current inventory_level is 500 units. Stock is healthy.",
            timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
            metadata: { title: "Warehouse Report" },
            extraction_confidence: 0.95,
            word_count: 10,
        },
        {
            source_id: "S2",
            source_type: "json",
            raw_text: "inventory_level: 0 units. Multiple customers report out of stock.",
            timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
            metadata: { title: "Customer Complaints" },
            extraction_confidence: 0.9,
            word_count: 11,
        },
        {
            source_id: "S3",
            source_type: "url",
            raw_text: "inventory_level shows 150 units available in system.",
            timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
            metadata: { title: "Sales Dashboard" },
            extraction_confidence: 0.85,
            word_count: 9,
        },
    ];

    const credibilityScores = [
        { source_id: "S1", total_score: 80, recency_score: 40, authority_score: 20, quality_score: 20, credibility_tier: "HIGH" as const, reasoning: "High authority" },
        { source_id: "S2", total_score: 75, recency_score: 35, authority_score: 20, quality_score: 20, credibility_tier: "HIGH" as const, reasoning: "Recent source" },
        { source_id: "S3", total_score: 70, recency_score: 30, authority_score: 20, quality_score: 20, credibility_tier: "HIGH" as const, reasoning: "Credible source" },
    ];

    const result = await agent.run({
        pipeline_id: "TEST-001",
        filtered_sources: sources,
        credibility_scores: credibilityScores,
    });

    const criticalCount = result.contradictions.filter(
        (c) => c.severity === "CRITICAL" || c.severity === "HIGH"
    ).length;

    assert(result.contradictions.length >= 1, `At least 1 contradiction detected (found ${result.contradictions.length})`);
    assert(criticalCount >= 1, `At least 1 CRITICAL/HIGH contradiction (found ${criticalCount})`);
}

function test2_constraintViolation(): void {
    console.log("\nTest 2: Constraint Violation — action exceeds budget");
    const validator = new ConstraintValidator();

    const constraints: Constraints = {
        budget_limit: { amount: 500000, currency: "PKR" },
        time_limit: { max_duration_hours: 24 },
        resource_limits: { api_calls_per_hour: 100, compute_units: 10, human_hours_available: 8 },
        urgency_level: "high",
    };

    const overBudgetAction: ActionNode = {
        action_id: "ACT-001",
        action_type: "mitigate",
        title: "Emergency bulk order",
        description: "Order 10,000 units immediately",
        priority: "critical",
        depends_on: [],
        blocks: [],
        constraints: { max_cost: 600000, max_duration_hours: 2, required_resources: ["supplier_api"], api_rate_limit: 10 },
        simulatable: true,
        simulation_details: { simulation_type: "place_order", parameters: {}, expected_success_rate: 0.9 },
        failure_recovery: { retry_count: 2, fallback_action_id: null, rollback_required: false },
    };

    const chain: ActionChain = {
        chain_id: "CHAIN-TEST0001",
        action_count: 1,
        insight_id: "INS-001",
        actions: [overBudgetAction],
        execution_order: ["ACT-001"],
        total_estimated_cost: 600000,
        total_estimated_duration_hours: 2,
        constraint_violations: [],
    };

    const validations = validator.validateActionChain(chain, constraints);
    const v = validations.find((r) => r.action_id === "ACT-001");

    assert(v !== undefined, "Validation result exists for ACT-001");
    assert(v?.is_feasible === false, "Action marked as infeasible due to budget violation");
    const budgetViolation = v?.violations.find((vl) => vl.constraint_type === "budget");
    assert(budgetViolation !== undefined, "Budget constraint violation recorded");
    assert(budgetViolation?.severity === "blocking", "Budget violation is blocking");
}

async function test3_actionFailureAndRetry(): Promise<void> {
    console.log("\nTest 3: Action Failure & Recovery — expects RecoveryPlan with strategy 'retry'");
    const recoveryEngine = new FailureRecoveryEngine();

    const failedAction: ActionNode = {
        action_id: "ACT-FAIL",
        action_type: "verify",
        title: "Failed database query",
        description: "Simulated failure",
        priority: "critical",
        depends_on: [],
        blocks: [],
        constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: ["db"], api_rate_limit: 10 },
        simulatable: true,
        simulation_details: { simulation_type: "database_query", parameters: {}, expected_success_rate: 0.0 },
        failure_recovery: { retry_count: 3, fallback_action_id: null, rollback_required: false },
    };

    const failureResult: ActionExecutionResult = {
        action_id: "ACT-FAIL",
        status: "failed" as const,
        before_state: { state_id: "S0", timestamp: new Date().toISOString(), variables: {} },
        after_state: { state_id: "S0", timestamp: new Date().toISOString(), variables: {} },
        execution_log: ["FAILURE: Database connection timeout"],
        cost: 0,
        duration_ms: 50,
        failure_reason: "Database connection timeout",
    };

    const chain: ActionChain = {
        chain_id: "CHAIN-TEST0002",
        action_count: 1,
        insight_id: "INS-001",
        actions: [failedAction],
        execution_order: ["ACT-FAIL"],
        total_estimated_cost: 0,
        total_estimated_duration_hours: 0.5,
        constraint_violations: [],
    };

    const stateHistory: SimulationState[] = [
        { state_id: "S0", timestamp: new Date().toISOString(), variables: {} },
    ];

    const plan = await recoveryEngine.handleFailure(failedAction, failureResult, chain, stateHistory);

    assert(plan !== undefined, "Recovery plan generated");
    assert(plan.failed_action_id === "ACT-FAIL", "Recovery plan references failed action");
    assert(plan.recovery_strategy === "retry", `Recovery strategy is 'retry' (got: ${plan.recovery_strategy})`);
    assert(plan.retry_attempts > 0, `Retry attempts > 0 (got: ${plan.retry_attempts})`);
}

async function test4_lowCredibilityOutlier(): Promise<void> {
    console.log("\nTest 4: Low-Credibility Outlier — outlier insights suppressed or low-confidence");
    const agent = new ContradictionDetectorAgent();

    const sources: NormalizedSource[] = [
        {
            source_id: "HIGH1",
            source_type: "pdf",
            raw_text: "inventory_level is 500 units.",
            timestamp: new Date().toISOString(),
            metadata: { title: "Authority Report A" },
            extraction_confidence: 0.98,
            word_count: 5,
        },
        {
            source_id: "HIGH2",
            source_type: "pdf",
            raw_text: "inventory_level confirms 490 units.",
            timestamp: new Date().toISOString(),
            metadata: { title: "Authority Report B" },
            extraction_confidence: 0.97,
            word_count: 5,
        },
        {
            source_id: "LOW1",
            source_type: "url",
            raw_text: "inventory_level is 9999 units according to rumor.",
            timestamp: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
            metadata: { title: "Unverified Blog" },
            extraction_confidence: 0.3,
            word_count: 8,
        },
    ];

    const credibilityScores = [
        { source_id: "HIGH1", total_score: 85, recency_score: 40, authority_score: 25, quality_score: 20, credibility_tier: "HIGH" as const, reasoning: "Authority source" },
        { source_id: "HIGH2", total_score: 80, recency_score: 40, authority_score: 20, quality_score: 20, credibility_tier: "HIGH" as const, reasoning: "Authority source" },
        { source_id: "LOW1", total_score: 15, recency_score: 0, authority_score: 10, quality_score: 5, credibility_tier: "UNVERIFIED" as const, reasoning: "Stale unverified blog" },
    ];

    const result = await agent.run({
        pipeline_id: "TEST-004",
        filtered_sources: sources,
        credibility_scores: credibilityScores,
    });

    // Contradictions involving only LOW1 vs high-credibility sources should be low confidence or zero
    const lowConfidenceContradictions = result.contradictions.filter(
        (c) =>
            c.conflicting_sources?.some((cs) => cs.source_id === "LOW1") &&
            c.confidence < 0.5
    );

    const highConfidenceWithLow = result.contradictions.filter(
        (c) =>
            c.conflicting_sources?.some((cs) => cs.source_id === "LOW1") &&
            c.confidence >= 0.8
    );

    assert(
        result.contradictions.length === 0 || highConfidenceWithLow.length === 0,
        `No high-confidence (≥0.8) CRITICAL contradictions driven solely by low-credibility source (found ${highConfidenceWithLow.length} such contradictions)`
    );
    console.log(`    Info: ${result.contradictions.length} total contradictions, ${lowConfidenceContradictions.length} involving low-credibility source`);
}

async function test5_cascadingBudget(): Promise<void> {
    console.log("\nTest 5: Cascading Side Effect — budget_remaining decreases after order action");
    const simulator = new ActionChainSimulator();

    const orderAction: ActionNode = {
        action_id: "ACT-ORDER",
        action_type: "mitigate",
        title: "Place emergency order",
        description: "Order 500 units",
        priority: "critical",
        depends_on: [],
        blocks: ["ACT-MONITOR"],
        constraints: { max_cost: 450000, max_duration_hours: 2, required_resources: ["supplier_api"], api_rate_limit: 10 },
        simulatable: true,
        simulation_details: {
            simulation_type: "place_order",
            parameters: { order_cost: 450000, quantity: 500 },
            expected_success_rate: 1.0, // force success
        },
        failure_recovery: { retry_count: 2, fallback_action_id: null, rollback_required: false },
    };

    const monitorAction: ActionNode = {
        action_id: "ACT-MONITOR",
        action_type: "monitor",
        title: "Schedule monitoring",
        description: "Monitor stock levels",
        priority: "high",
        depends_on: ["ACT-ORDER"],
        blocks: [],
        constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: ["monitoring_service"], api_rate_limit: 5 },
        simulatable: true,
        simulation_details: {
            simulation_type: "schedule_monitoring",
            parameters: { interval_hours: 1 },
            expected_success_rate: 1.0,
        },
        failure_recovery: { retry_count: 1, fallback_action_id: null, rollback_required: false },
    };

    const chain: ActionChain = {
        chain_id: "CHAIN-TEST0005",
        action_count: 2,
        insight_id: "INS-001",
        actions: [orderAction, monitorAction],
        execution_order: ["ACT-ORDER", "ACT-MONITOR"],
        total_estimated_cost: 450000,
        total_estimated_duration_hours: 2.5,
        constraint_violations: [],
    };

    const initialBudget = 500000;
    const initialState: SimulationState = {
        state_id: "S0",
        timestamp: new Date().toISOString(),
        variables: { budget_remaining: initialBudget },
    };

    const results = await simulator.simulateChain(chain, initialState, false);

    const orderResult = results.find((r) => r.action_id === "ACT-ORDER");
    const monitorResult = results.find((r) => r.action_id === "ACT-MONITOR");

    assert(orderResult?.status === "success", "Order action succeeded");
    const budgetAfterOrder = orderResult?.after_state.variables["budget_remaining"] as number;
    assert(
        typeof budgetAfterOrder === "number" && budgetAfterOrder < initialBudget,
        `budget_remaining decreased after order (${initialBudget} → ${budgetAfterOrder})`
    );
    assert(
        budgetAfterOrder === initialBudget - 450000,
        `budget_remaining exactly deducted: ${initialBudget} - 450000 = ${budgetAfterOrder}`
    );
    assert(monitorResult?.status === "success", "Monitor action succeeded (dependency chain intact)");
}

async function main(): Promise<void> {
    console.log("=== Stress Tests: Phase 3+4 Verification ===");

    await test1_conflictingValues();
    test2_constraintViolation();
    await test3_actionFailureAndRetry();
    await test4_lowCredibilityOutlier();
    await test5_cascadingBudget();

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Unhandled error in stress tests:", err);
    process.exit(1);
});

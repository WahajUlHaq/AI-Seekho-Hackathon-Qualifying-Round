import * as path from "path";
import { contractRegistry } from "./registry";
import { contractValidator } from "./validator";

async function runTests() {
    const definitionsDir = path.resolve(__dirname, "./definitions");
    await contractRegistry.loadAll(definitionsDir);

    let passed = 0;
    const total = 7;

    function assert(name: string, condition: boolean) {
        if (condition) {
            console.log(`✅ Test ${name}: PASS`);
            passed++;
        } else {
            console.log(`❌ Test ${name}: FAIL`);
        }
    }

    const ingestionContract = contractRegistry.getRequired("multi_source_ingestion_v1");
    const contradictionContract = contractRegistry.getRequired("contradiction_detection_v1");
    const actionChainContract = contractRegistry.getRequired("action_chain_v1");

    // Test 1: Valid multi_source_ingestion → PASS
    const validIngestion = {
        ingestion_id: "ING-AB12CD34",
        timestamp: new Date().toISOString(),
        sources_processed: 1,
        sources: [{
            source_id: "SRC-001",
            source_type: "url",
            content: "Some content here",
            ingested_at: new Date().toISOString(),
        }],
    };
    const t1 = contractValidator.validate(validIngestion, ingestionContract);
    assert("1 (valid ingestion → PASS)", t1.level === "PASS");

    // Test 2: Missing ingestion_id → REJECT
    const missingId = {
        timestamp: new Date().toISOString(),
        sources_processed: 1,
        sources: [{
            source_id: "SRC-001",
            source_type: "url",
            content: "content",
            ingested_at: new Date().toISOString(),
        }],
    };
    const t2 = contractValidator.validate(missingId, ingestionContract);
    assert("2 (missing ingestion_id → REJECT)", t2.level === "REJECT");

    // Test 3: Invalid enum source_type → REJECT
    const invalidEnum = {
        ingestion_id: "ING-AB12CD34",
        timestamp: new Date().toISOString(),
        sources_processed: 1,
        sources: [{
            source_id: "SRC-001",
            source_type: "invalid",
            content: "content",
            ingested_at: new Date().toISOString(),
        }],
    };
    const t3 = contractValidator.validate(invalidEnum, ingestionContract);
    assert("3 (invalid source_type enum → REJECT)", t3.level === "REJECT");

    // Test 4: Regex mismatch ingestion_id → REJECT
    const badRegex = {
        ingestion_id: "BAD-FORMAT",
        timestamp: new Date().toISOString(),
        sources_processed: 1,
        sources: [{
            source_id: "SRC-001",
            source_type: "url",
            content: "content",
            ingested_at: new Date().toISOString(),
        }],
    };
    const t4 = contractValidator.validate(badRegex, ingestionContract);
    assert("4 (bad ingestion_id regex → REJECT)", t4.level === "REJECT");

    // Test 5: Valid contradiction_detection → PASS
    const validContradiction = {
        detection_id: "DET-AB12CD34",
        contradictions_found: 1,
        contradictions: [{
            contradiction_id: "CONT-001",
            topic: "pricing",
            severity: "HIGH",
            type: "numeric",
            sources_involved: ["SRC-001", "SRC-002"],
            claim_a: "Price is $100",
            claim_b: "Price is $150",
            confidence: 0.9,
        }],
    };
    const t5 = contractValidator.validate(validContradiction, contradictionContract);
    assert("5 (valid contradiction_detection → PASS)", t5.level === "PASS");

    // Test 6: Valid action_chain → PASS
    const validActionChain = {
        pipelineId: "123e4567-e89b-12d3-a456-426614174000",
        overall_status: "SUCCESS",
        approved_by: "Areeb",
        approval_timestamp: "2026-05-18T17:44:00Z",
        total_execution_ms: 1500,
        execution_results: [
            {
                action_id: "ACT-000001",
                status: "SUCCESS",
                latency_ms: 500,
                output_summary: "Query returned inventory count"
            }
        ]
    };
    const t6 = contractValidator.validate(validActionChain, actionChainContract);
    assert("6 (valid action_chain → PASS)", t6.level === "PASS");

    // Test 7: total_execution_ms below min:0 → WARN
    const overMaxChain = {
        pipelineId: "123e4567-e89b-12d3-a456-426614174000",
        overall_status: "SUCCESS",
        approval_timestamp: "2026-05-18T17:44:00Z",
        total_execution_ms: -5,
        execution_results: []
    };
    const t7 = contractValidator.validate(overMaxChain, actionChainContract);
    assert("7 (total_execution_ms below min → WARN)", t7.level === "WARN");

    console.log(`\n${passed}/${total} tests passed`);
    if (passed < total) process.exit(1);
}

runTests().catch((err) => {
    console.error("Test suite crashed:", err.message);
    process.exit(1);
});

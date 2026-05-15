import { llmClient } from "./llm-client";

(async () => {
    console.log("\n=== Smoke Test: LLMClient Singleton ===");
    let passed = 0;

    // Check 1: complete() returns a non-empty string
    try {
        const result = await llmClient.complete("Hello from smoke test");
        if (typeof result === "string" && result.length > 0) {
            console.log("✅ Check 1 PASS: complete() returned string");
            passed++;
        } else {
            console.log("❌ Check 1 FAIL: complete() did not return a non-empty string");
        }
    } catch (e: any) {
        console.log(`❌ Check 1 FAIL: ${e.message}`);
    }

    // Check 2: generateEmbedding() returns number[] with length > 0
    try {
        const embedding = await llmClient.generateEmbedding("test");
        if (Array.isArray(embedding) && embedding.length > 0) {
            console.log(`✅ Check 2 PASS: generateEmbedding() returned ${embedding.length}-dim vector`);
            passed++;
        } else {
            console.log("❌ Check 2 FAIL: generateEmbedding() returned empty array");
        }
    } catch (e: any) {
        console.log(`❌ Check 2 FAIL: ${e.message}`);
    }

    // Check 3: complete() with useBaseModel=true returns a string
    try {
        const result = await llmClient.complete("Validate this", true);
        if (typeof result === "string" && result.length > 0) {
            console.log("✅ Check 3 PASS: complete(useBaseModel=true) returned string");
            passed++;
        } else {
            console.log("❌ Check 3 FAIL: complete(useBaseModel=true) did not return a non-empty string");
        }
    } catch (e: any) {
        console.log(`❌ Check 3 FAIL: ${e.message}`);
    }

    console.log(`\n${passed}/3 checks passed`);
    if (passed < 3) process.exit(1);
})();

// Import the singleton — this is the exact pattern every agent must use
import { llmClient } from "./llm-client";

async function smokeTest() {
    console.log("\n=== LLMClient Singleton Smoke Test ===");
    console.log(`Environment : ${process.env.APP_ENV || "development"}`);
    console.log(`Primary     : ${process.env.PRIMARY_PROVIDER || "gemini-free"}`);

    // Test 1: Basic completion via singleton
    console.log("\n--- Test 1: complete() via singleton ---");
    const result = await llmClient.complete(
        `Say exactly: "LLMClient singleton is working in ${process.env.APP_ENV} mode."`
    );
    console.log("Response:", result.trim());
    console.log("PASS: complete() succeeded");

    // Test 2: Base model flag (useBaseModel=true routes to config.baseModel)
    console.log("\n--- Test 2: complete() with useBaseModel=true ---");
    const baseResult = await llmClient.complete(
        "Reply with only the word: BASEMODEL",
        true
    );
    console.log("Response:", baseResult.trim());
    console.log("PASS: base model call succeeded");

    // Test 3: Embedding (always free Gemini — never burns Vertex credits)
    console.log("\n--- Test 3: generateEmbedding() ---");
    const embedding = await llmClient.generateEmbedding("autonomous content-to-action agent");
    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Embedding returned empty array");
    }
    console.log(`Embedding dimensions: ${embedding.length}`);
    console.log("PASS: generateEmbedding() succeeded");

    // Test 4: Vertex AI — skipped on Days 1-5 by design
    console.log("\n--- Test 4: Vertex AI (production only) ---");
    const vertexKeySet =
        process.env.VERTEX_KEY_1 &&
        process.env.VERTEX_KEY_1 !== "person_b_service_account_key_json_path";
    if (process.env.APP_ENV === "production" && vertexKeySet) {
        const vertexResult = await llmClient.complete("Confirm Vertex AI is routing correctly.");
        console.log("Vertex AI response:", vertexResult.trim());
        console.log("PASS: Vertex AI active");
    } else {
        console.log("SKIPPED — APP_ENV is not production or VERTEX_KEY_1 not configured.");
        console.log("Expected on Days 1-5. Vertex keys are added on Day 6.");
    }

    console.log("\n=== All smoke tests passed ===");
    console.log("Singleton pattern confirmed. All agents must use:");
    console.log('  import { llmClient } from "../utils/llm-client";');
}

smokeTest().catch((err) => {
    console.error("\nSMOKE TEST FAILED:", err.message);
    process.exit(1);
});
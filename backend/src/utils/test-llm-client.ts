import { LLMClient } from "./llm-client";

async function testEnvironments() {
    const client = new LLMClient();

    // Test 1: Basic completion (works in both environments)
    console.log("\n--- Test 1: Basic Completion ---");
    const result = await client.complete("Say hello from " + process.env.APP_ENV + "!");
    console.log("✓ Response:", result);

    // Test 2: Fallback simulation
    console.log("\n--- Test 2: Embedding (always free tier) ---");
    const embedding = await client.generateEmbedding("test embedding");
    console.log("✓ Embedding dimensions:", embedding.length);

    // Test 3: Vertex AI (only when keys are ready — won't fail if missing)
    if (process.env.APP_ENV === "production" && process.env.VERTEX_KEY_1) {
        console.log("\n--- Test 3: Vertex AI accounts ---");
        const vertexResult = await client.complete("Confirm Vertex AI is working.");
        console.log("✓ Vertex AI response:", vertexResult);
    } else {
        console.log("\n--- Test 3: Vertex AI ---");
        console.log("⚠ Skipped (APP_ENV is not production or VERTEX_KEY_1 not set yet — this is expected on Days 1-5)");
    }

    console.log("\n✓ LLMClient ready for", process.env.APP_ENV, "environment.");
}

testEnvironments().catch(console.error);
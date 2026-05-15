import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

// Both imports must resolve to the exact same module instance
import { llmClient as clientA } from "./llm-client";
import { llmClient as clientB } from "./llm-client";

async function runSmokeTest() {
    console.log("[Singleton Smoke] Starting LLMClient singleton verification...");

    // 1 — Reference equality (singleton guarantee)
    const isSingleton = clientA === clientB;
    console.log(`[Singleton Smoke] Reference equality: ${isSingleton ? "PASS ✓" : "FAIL ✗"}`);
    if (!isSingleton) {
        throw new Error("LLMClient is NOT a singleton — two different instances detected");
    }

    // 2 — complete() call
    console.log("[Singleton Smoke] Calling complete()...");
    const text = await clientA.complete("Reply with exactly three words: singleton test passed");
    console.log(`[Singleton Smoke] complete() response: "${text.trim().slice(0, 80)}"`);
    if (!text || text.trim().length === 0) throw new Error("complete() returned empty string");
    console.log("[Singleton Smoke] complete(): PASS ✓");

    // 3 — generateEmbedding() call
    console.log("[Singleton Smoke] Calling generateEmbedding()...");
    const embedding = await clientA.generateEmbedding("singleton smoke test embedding");
    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("generateEmbedding() returned empty or non-array");
    }
    console.log(`[Singleton Smoke] generateEmbedding() returned ${embedding.length} dimensions: PASS ✓`);

    console.log("\n[Singleton Smoke] All checks passed ✓");
}

runSmokeTest().catch((err) => {
    console.error("[Singleton Smoke] FAILED:", err.message);
    process.exit(1);
});

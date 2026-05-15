import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { llmClient } from "../utils/llm-client";

async function test() {
    console.log("=== TEST 1.3: Embedding Generation ===");

    try {
        const embedding = await llmClient.generateEmbedding("Inventory stock level is critically low");
        console.log("Embedding dimensions:", embedding.length);
        console.log("First 5 values:", embedding.slice(0, 5));

        const pass = embedding.length > 0 && typeof embedding[0] === "number";
        console.log(pass ? `✅ PASS: Embedding generated (${embedding.length} dimensions)` : "❌ FAIL: Wrong dimensions or type");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
    }
}

test();

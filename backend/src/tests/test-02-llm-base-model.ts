import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { llmClient } from "../utils/llm-client";

async function test() {
    console.log("=== TEST 1.2: LLMClient Base Model (useBaseModel=true) ===");

    try {
        const response = await llmClient.complete("Reply with exactly: BASE_MODEL_OK", true);
        console.log("Response:", response);

        const pass = response.includes("BASE_MODEL_OK");
        console.log(pass ? "✅ PASS: Base model responded correctly" : "❌ FAIL: Unexpected response");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
    }
}

test();

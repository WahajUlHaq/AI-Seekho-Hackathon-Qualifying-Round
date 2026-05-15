import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { llmClient } from "../utils/llm-client";

async function test() {
    console.log("=== TEST 1.1: LLMClient Basic Completion ===");

    try {
        const response = await llmClient.complete("Reply with exactly: HELLO_TEST_PASS");
        console.log("Response:", response);

        const pass = response.includes("HELLO_TEST_PASS");
        console.log(pass ? "✅ PASS: LLMClient returned valid response" : "❌ FAIL: Unexpected response");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
    }
}

test();

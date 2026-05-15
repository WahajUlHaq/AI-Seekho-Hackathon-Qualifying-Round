import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import Groq from "groq-sdk";

async function test() {
    console.log("=== TEST 1.4: Groq Fallback Reachability ===");

    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
            model: process.env.FALLBACK_MODEL || "llama-3.1-70b-versatile",
            messages: [{ role: "user", content: "Reply with exactly: GROQ_FALLBACK_OK" }],
            temperature: 0.1,
        });

        const response = completion.choices[0].message.content || "";
        console.log("Groq response:", response);

        const pass = response.includes("GROQ_FALLBACK_OK");
        console.log(pass ? "✅ PASS: Groq fallback is reachable" : "❌ FAIL: Unexpected response");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
    }
}

test();

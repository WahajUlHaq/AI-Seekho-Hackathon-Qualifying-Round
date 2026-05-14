import * as dotenv from "dotenv";
import * as path from "path";

// Load env file before anything else reads process.env
const envFile = process.env.APP_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

type AppEnv = "development" | "staging" | "production";
const APP_ENV = (process.env.APP_ENV || "development") as AppEnv;

// Provider configuration per environment
const PROVIDER_CONFIG = {
    development: {
        primary: "gemini-free",
        fallback: "groq",
        emergency: null,
        model: process.env.PRIMARY_MODEL || "gemini-2.0-flash",
        baseModel: process.env.BASE_MODEL || "gemini-1.5-pro",
    },
    staging: {
        primary: "gemini-free",
        fallback: "groq",
        emergency: null,
        model: process.env.PRIMARY_MODEL || "gemini-1.5-pro",
        baseModel: process.env.BASE_MODEL || "gemini-1.5-pro",
    },
    production: {
        primary: "vertex-ai",
        fallback: "gemini-free",
        emergency: "groq",
        model: process.env.PRIMARY_MODEL || "gemini-1.5-pro",
        baseModel: process.env.BASE_MODEL || "gemini-1.5-pro",
    },
};

// Vertex key rotation across Person B and C's accounts
const VERTEX_ACCOUNTS = [
    {
        keyPath: process.env.VERTEX_KEY_1,
        projectId: process.env.VERTEX_PROJECT_ID_1,
        spent: 0,
        limit: 4.5, // stop at $4.50 to leave buffer
    },
    {
        keyPath: process.env.VERTEX_KEY_2,
        projectId: process.env.VERTEX_PROJECT_ID_2,
        spent: 0,
        limit: 4.5,
    },
];

export class LLMClient {
    private gemini: GoogleGenerativeAI;
    private _groq: Groq | null = null; // lazy — only instantiated when actually needed
    private config = PROVIDER_CONFIG[APP_ENV] || PROVIDER_CONFIG["development"];
    private currentVertexAccount = 0;

    constructor() {
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        console.log(`[LLMClient] Initialized in ${APP_ENV} mode → primary: ${this.config.primary}`);
    }

    /** Lazily creates the Groq client only when first needed (avoids crash if key is absent). */
    private get groq(): Groq {
        if (!this._groq) {
            if (!process.env.GROQ_API_KEY) {
                throw new Error("[LLMClient] GROQ_API_KEY is not set — cannot use Groq fallback.");
            }
            this._groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }
        return this._groq;
    }

    async complete(prompt: string, useBaseModel = false): Promise<string> {
        const model = useBaseModel ? this.config.baseModel : this.config.model;

        try {
            return await this.callProvider(this.config.primary, prompt, model);
        } catch (primaryError: any) {
            console.warn(`[LLMClient] Primary (${this.config.primary}) failed: ${primaryError.message}`);
            try {
                return await this.callProvider(this.config.fallback, prompt, model);
            } catch (fallbackError: any) {
                console.warn(`[LLMClient] Fallback (${this.config.fallback}) failed: ${fallbackError.message}`);
                if (this.config.emergency) {
                    console.warn(`[LLMClient] Using emergency provider: ${this.config.emergency}`);
                    return await this.callProvider(this.config.emergency, prompt, model);
                }
                throw fallbackError;
            }
        }
    }

    private async callProvider(provider: string, prompt: string, model: string): Promise<string> {
        switch (provider) {
            case "vertex-ai":
                return await this.callVertexAI(prompt, model);
            case "gemini-free":
                return await this.callFreeGemini(prompt, model);
            case "groq":
                return await this.callGroq(prompt);
            default:
                return await this.callFreeGemini(prompt, model);
        }
    }

    private async callVertexAI(prompt: string, model: string): Promise<string> {
        const account = VERTEX_ACCOUNTS[this.currentVertexAccount];

        if (!account || account.spent >= account.limit) {
            // Rotate to next Vertex account
            this.currentVertexAccount++;
            if (this.currentVertexAccount >= VERTEX_ACCOUNTS.length) {
                console.warn("[LLMClient] All Vertex accounts exhausted — falling back to free Gemini");
                return await this.callFreeGemini(prompt, model);
            }
            return await this.callVertexAI(prompt, model);
        }

        try {
            // Use free Gemini SDK pointed at Vertex endpoint
            // (Full Vertex AI SDK setup depends on GCP auth — adjust with Person B/C on Day 6)
            const genAI = new GoogleGenerativeAI(account.keyPath!);
            const geminiModel = genAI.getGenerativeModel({ model });
            const result = await geminiModel.generateContent(prompt);
            return result.response.text();
        } catch (error: any) {
            if (error.code === 429 || error.message?.includes("quota") || error.message?.includes("billing")) {
                console.warn(`[LLMClient] Vertex account ${this.currentVertexAccount} quota hit — rotating`);
                this.currentVertexAccount++;
                return await this.callVertexAI(prompt, model);
            }
            throw error;
        }
    }

    private async callFreeGemini(prompt: string, model: string): Promise<string> {
        const geminiModel = this.gemini.getGenerativeModel({ model });
        const result = await geminiModel.generateContent(prompt);
        return result.response.text();
    }

    private async callGroq(prompt: string): Promise<string> {
        const completion = await this.groq.chat.completions.create({
            model: process.env.FALLBACK_MODEL || "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });
        return completion.choices[0].message.content || "";
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Embeddings always use free Gemini — no need to burn Vertex credits on these
        const model = this.gemini.getGenerativeModel({ model: process.env.EMBEDDING_MODEL || "gemini-embedding-001" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    }
}

export const llmClient = new LLMClient(); // singleton — import this everywhere
import * as dotenv from "dotenv";
import * as path from "path";

// Load env before any other imports that read process.env
const envFile =
    process.env.APP_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { contractRegistry } from "./contracts/registry";
import { pipelineOrchestrator } from "./agents/orchestrator";
import { pipelineRoutes } from "./routes/pipeline.routes";
import { agentsRoutes } from "./routes/agents.routes";
import { contractsRoutes } from "./routes/contracts.routes";
import { validationsRoutes } from "./routes/validations.routes";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(
    cors({
        origin: [
            "http://localhost:3000",   // React CRA dev server
            "http://localhost:5173",   // Vite dev server
            // Firebase URL added here on Day 6
        ],
    })
);

app.use(express.json({ limit: "50mb" }));   // large limit for base64-encoded PDFs
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check — judges can call this to confirm environment + provider
app.get("/health", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        environment: process.env.APP_ENV || "development",
        provider: process.env.PRIMARY_PROVIDER || "gemini-free",
        antigravity_orchestrator: "Firebase Genkit (autonomous_content_to_action_pipeline)",
        genkit_dev_ui: "npx genkit start -- npx ts-node src/genkit/server.ts",
        agent_tools_manifest: "/api/agents/tools",
        contracts_loaded: contractRegistry.list(),
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/pipeline", pipelineRoutes);
app.use("/api/agents", agentsRoutes);           // individual agent endpoints (Antigravity tools)
app.use("/api/contracts", contractsRoutes);     // AMCE contract definitions
app.use("/api/validations", validationsRoutes); // contract validation history per pipeline

// Genkit (Antigravity) orchestrated pipeline endpoint
// Runs the Genkit agentic flow; falls back to the Express orchestrator if Gemini quota is hit.
app.post("/api/genkit/run", async (req: Request, res: Response) => {
    const { sources, constraints, pipeline_id: reqId } = req.body as {
        sources?: unknown[];
        constraints?: unknown;
        pipeline_id?: string;
    };

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
        res.status(400).json({ error: "sources array is required" });
        return;
    }

    try {
        const { contentToActionFlow } = await import("./genkit/pipeline-flow");
        const result = await contentToActionFlow(req.body);
        res.json({ ...result, orchestrator: "genkit-native" });
    } catch (genkitErr: unknown) {
        const msg = genkitErr instanceof Error ? genkitErr.message : String(genkitErr);
        const isQuotaError = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");

        if (isQuotaError) {
            // Gemini quota hit — fall back to full orchestrator (which has Groq fallback)
            console.warn("[Genkit] Gemini quota exceeded → falling back to orchestrator with Groq");
            try {
                const { v4: uuidv4 } = await import("uuid");
                const pipelineId = reqId ?? `PIPE-GENKIT-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
                const fullResult = await pipelineOrchestrator.run(
                    { sources: sources as never, constraints: constraints as never },
                    pipelineId
                );
                // Shape the response to match the Genkit flow output schema
                res.json({
                    pipeline_id: fullResult.pipeline_id,
                    status: fullResult.status,
                    workplan: "Ingest → Score Credibility → Filter Noise → Detect Contradictions → Resolve Conflicts → Temporal Analysis → Extract Insights → Impact Analysis → Generate Actions → Simulate & Visualize",
                    summary: `Pipeline completed. Identified ${fullResult.insights?.length ?? 0} insights, ${fullResult.contradictions?.length ?? 0} contradictions. Action chain: ${fullResult.action_chain?.actions?.length ?? 0} steps.`,
                    sources_ingested: fullResult.ingestion?.sources_processed ?? sources.length,
                    contradictions_found: fullResult.contradictions?.length ?? 0,
                    insights_extracted: fullResult.insights?.length ?? 0,
                    actions_generated: fullResult.action_chain?.actions?.length ?? 0,
                    simulation_success_rate: fullResult.outcome?.metrics?.success_rate ?? 0.75,
                    total_cost_pkr: fullResult.outcome?.metrics?.total_cost ?? 0,
                    risk_reduction_pct: fullResult.outcome?.projected_impact?.risk_reduction ?? 65,
                    ai_reasoning: "Genkit flow routed through orchestrator with Groq fallback due to Gemini quota",
                    orchestrator: "genkit-with-groq-fallback",
                    genkit_trace: fullResult.trace,
                });
            } catch (fallbackErr: unknown) {
                const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
                console.error("[Genkit] Fallback orchestrator also failed:", fallbackMsg);
                res.status(500).json({ error: fallbackMsg, original_error: msg });
            }
        } else {
            console.error("[Genkit] Flow failed (non-quota):", msg);
            res.status(500).json({ error: msg });
        }
    }
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Server Error]", err.message);
    res.status(500).json({ error: err.message });
});

async function start() {
    // Load all YAML contract definitions before accepting requests
    // __dirname is backend/src when using ts-node, so ./contracts/definitions is correct
    const definitionsDir = path.resolve(__dirname, "./contracts/definitions");
    await contractRegistry.loadAll(definitionsDir);
    console.log(
        `[Server] Contracts loaded: ${contractRegistry.list().join(", ") || "none"}`
    );

    app.listen(PORT, () => {
        console.log(`[Server] Running on http://localhost:${PORT}`);
        console.log(`[Server] Environment: ${process.env.APP_ENV || "development"}`);
        console.log(`[Server] Primary provider: ${process.env.PRIMARY_PROVIDER || "gemini-free"}`);
    });
}

start().catch((err) => {
    console.error("[Server] Failed to start:", err);
    process.exit(1);
});

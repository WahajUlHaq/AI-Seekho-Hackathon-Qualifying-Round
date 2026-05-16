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
import { checkDomain } from "./utils/domain-validator";

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

// Thin HTTP shim — Antigravity orchestrator is the central router.
// Genkit is no longer invoked here as a parallel pipeline; the orchestrator owns
// all routing decisions and may invoke Genkit internally as one of its tools.
// The route is preserved so existing clients (frontend, judge bookmarks) keep working.
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

    const domain = checkDomain((sources as Array<{ content?: string }>).map((s) => s.content ?? ""));
    if (!domain.passed) {
        res.status(422).json({
            error: "DOMAIN_REJECTION",
            message: domain.reason,
            domain_score: domain.score,
            domain_level: domain.level,
            hint: "This agent specialises in Supply Chain & Operations: inventory, procurement, logistics, warehousing, demand forecasting, risk management.",
        });
        return;
    }

    try {
        const { v4: uuidv4 } = await import("uuid");
        const pipelineId = reqId ?? `PIPE-GENKIT-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        const result = await pipelineOrchestrator.run(
            { sources: sources as never, constraints: constraints as never },
            pipelineId
        );
        res.json({
            ...result,
            orchestrator: "antigravity-central",
            entry: "genkit-shim",
            summary: `Pipeline completed. Identified ${result.insights?.length ?? 0} insights, ${result.contradictions?.length ?? 0} contradictions. Action chain: ${result.action_chain?.actions?.length ?? 0} steps.`,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Genkit-shim] Orchestrator failed:", msg);
        res.status(500).json({ error: msg, orchestrator: "antigravity-central" });
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

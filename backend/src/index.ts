import * as dotenv from "dotenv";
import * as path from "path";

// Load env before any other imports that read process.env
const envFile =
    process.env.APP_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { contractRegistry } from "./contracts/registry";
import { pipelineRoutes } from "./routes/pipeline.routes";
import { contractsRoutes } from "./routes/contracts.routes";
import { validationsRoutes } from "./routes/validations.routes";
import { executionRoutes } from "./routes/execution.routes";
import { docsRouter } from "./docs/swagger";

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

// Phase 5: OpenAPI 3.0 docs — mounted before route handlers so /api-docs and
// /api-docs.json stay reachable even if a downstream router throws during load.
app.use(docsRouter);

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
        contracts_loaded: contractRegistry.list(),
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/pipeline", pipelineRoutes);
app.use("/api/contracts", contractsRoutes);
app.use("/api/validations", validationsRoutes);
app.use("/api/execution", executionRoutes);

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

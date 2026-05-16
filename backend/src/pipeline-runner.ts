/**
 * Phase 2 end-to-end pipeline runner.
 * Chains all 7 agents over the mock test-data set, prints the full trace, and
 * writes a summary block to stdout.
 *
 * Run: cross-env APP_ENV=development npx ts-node src/pipeline-runner.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";

// Load env before any other import that reads process.env
const envFile =
    process.env.APP_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { v4 as uuidv4 } from "uuid";
import { contractRegistry } from "./contracts/registry";
import { traceCollector } from "./tracing/collector";
import { InMemoryVectorStore } from "./stores/in-memory-vector.store";
import { MockRealtimeFeedAdapter } from "./adapters/mock-realtime-feed.adapter";
import { MultiSourceIngestionAgent } from "./agents/multi-source-ingestion.agent";
import { CredibilityScorerAgent } from "./agents/credibility-scorer.agent";
import { NoiseFilterAgent } from "./agents/noise-filter.agent";
import { ContradictionDetectorAgent } from "./agents/contradiction-detector.agent";
import { ConflictResolutionAgent } from "./agents/conflict-resolution.agent";
import { TemporalAnalysisAgent } from "./agents/temporal-analysis.agent";
import { InsightExtractionAgent } from "./agents/insight-extraction.agent";
import { ImpactScorerAgent } from "./agents/impact-scorer.agent";
import { PredictiveForecasterAgent } from "./agents/predictive-forecaster.agent";
import { StrategicRecommenderAgent } from "./agents/strategic-recommender.agent";

function makePipelineId(): string {
    return `PIPE-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, 8)}`;
}

async function runStage<T>(
    pipelineId: string,
    stageName: string,
    fn: () => Promise<T>
): Promise<T> {
    const start = Date.now();
    try {
        const result = await fn();
        console.log(`[Stage] ${stageName} ✓ (${Date.now() - start}ms)`);
        return result;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Stage] ${stageName} ✗ — ${msg}`);
        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "failure",
            agent: "pipeline-runner",
            message: `Stage "${stageName}" failed: ${msg}`,
        });
        throw err;
    }
}

async function main(): Promise<void> {
    // Load all AMCE contracts
    const definitionsDir = path.resolve(__dirname, "./contracts/definitions");
    await contractRegistry.loadAll(definitionsDir);
    console.log(`[Pipeline] Contracts loaded: ${contractRegistry.list().join(", ")}`);

    const pipeline_id = makePipelineId();
    console.log(`[Pipeline] ID: ${pipeline_id}\n`);

    traceCollector.initPipeline(pipeline_id, "phase-3-full-pipeline", [
        "ingestion",
        "credibility",
        "noise-filter",
        "contradiction",
        "resolution+temporal (parallel)",
        "insight-extraction",
        "impact-scoring",
        "predictive-forecasting",
        "strategic-recommendation",
    ]);

    // Shared infrastructure — exercises DI fix (constructor injection of feed adapter)
    const vectorStore = new InMemoryVectorStore();
    const feedAdapter = new MockRealtimeFeedAdapter(
        path.resolve(__dirname, "../test-data/realtime-feed.json")
    );

    // Instantiate all 7 agents
    const ingestionAgent      = new MultiSourceIngestionAgent(undefined, feedAdapter);
    const credibilityAgent    = new CredibilityScorerAgent();
    const noiseFilterAgent    = new NoiseFilterAgent(vectorStore);
    const contradictionAgent  = new ContradictionDetectorAgent();
    const conflictAgent       = new ConflictResolutionAgent();
    const temporalAgent       = new TemporalAnalysisAgent();
    const insightAgent        = new InsightExtractionAgent(vectorStore);
    const impactAgent         = new ImpactScorerAgent();
    const forecasterAgent     = new PredictiveForecasterAgent();
    const recommenderAgent    = new StrategicRecommenderAgent();

    // Stage 1: Multi-source ingestion
    const ingestion = await runStage(pipeline_id, "ingestion", () =>
        ingestionAgent.run({ pipeline_id })
    );

    // Stage 2: Credibility scoring
    const credibility = await runStage(pipeline_id, "credibility", () =>
        credibilityAgent.run({ pipeline_id, sources: ingestion.sources })
    );

    // Stage 3: Noise filter
    const filtered = await runStage(pipeline_id, "noise-filter", () =>
        noiseFilterAgent.run({ pipeline_id, sources: credibility.sources })
    );

    // Stage 4: Contradiction detection
    const contradictionResult = await runStage(pipeline_id, "contradiction", () =>
        contradictionAgent.run({ pipeline_id, sources: filtered.sources })
    );

    // Stage 5 (a + b): Conflict resolution and temporal analysis in parallel
    const [resolution, temporal] = await Promise.all([
        runStage(pipeline_id, "conflict-resolution", () =>
            conflictAgent.run({
                pipeline_id,
                contradictions: contradictionResult.contradictions,
                sources: filtered.sources,
            })
        ),
        runStage(pipeline_id, "temporal-analysis", () =>
            temporalAgent.run({ pipeline_id, sources: filtered.sources })
        ),
    ]);

    // Stage 6: Insight extraction (RAG)
    const insights = await runStage(pipeline_id, "insight-extraction", () =>
        insightAgent.run({
            pipeline_id,
            sources: filtered.sources,
            resolutions: resolution.resolutions,
            investigation_paths: resolution.investigation_paths,
            temporal_patterns: temporal.metrics,
        })
    );

    // Stage 7: Impact scoring (M8)
    const impact = await runStage(pipeline_id, "impact-scoring", () =>
        impactAgent.run({ pipeline_id, insights })
    );

    // Stage 8: Predictive forecasting (M9)
    const forecast = await runStage(pipeline_id, "predictive-forecasting", () =>
        forecasterAgent.run({ pipeline_id, insights, temporal })
    );

    // Stage 9: Strategic recommendation (M10) — produces final StrategyProposal
    const strategy = await runStage(pipeline_id, "strategic-recommendation", () =>
        recommenderAgent.run({
            pipeline_id,
            insights,
            impactAnalysis: impact,
            forecast,
        })
    );

    // Finalise trace
    traceCollector.finalizePipeline(pipeline_id);
    const trace = traceCollector.getTrace(pipeline_id);

    // Full trace dump
    console.log("\n=== FULL PIPELINE TRACE ===");
    console.log(JSON.stringify(trace, null, 2));

    // Summary block
    console.log("\n=== PIPELINE SUMMARY ===");
    console.log(`Pipeline ID:           ${pipeline_id}`);
    console.log(`Sources ingested:      ${ingestion.sources_processed}`);
    console.log(`Sources after filter:  ${filtered.output_count} (removed: ${filtered.removed_count})`);
    console.log(`Contradictions found:  ${contradictionResult.contradictions_found}`);
    console.log(`Resolutions:           ${resolution.resolutions.length}`);
    console.log(`Investigations queued: ${resolution.investigation_paths.length}`);
    console.log(`Temporal metrics:      ${temporal.metrics.length}`);
    console.log(`Insights — trends:     ${insights.trends.length}`);
    console.log(`Insights — risks:      ${insights.risks.length}`);
    console.log(`Insights — opps:       ${insights.opportunities.length}`);
    console.log(`Persistent conflicts:  ${insights.persistentConflicts.length}`);
    console.log(`Impact magnitude:      ${impact.impactMagnitudeScore}/100  (F=${impact.componentScores.financial} O=${impact.componentScores.operational} R=${impact.componentScores.reputational})`);
    console.log(`Forecast scenarios:    ${forecast.forecastingScenarios.length} (horizons: ${forecast.forecastingScenarios.map(s => s.horizon).join(", ")})`);
    console.log(`Unreliable forecasts:  ${forecast.forecastingScenarios.filter(s => s.reliability_flag === "extrapolation_unreliable").length}`);
    console.log(`Proposed actions:      ${strategy.strategyProposal.proposedActions.length} (overall: ${strategy.strategyProposal.overall_priority})`);

    console.log("\n=== FINAL STRATEGY PROPOSAL ===");
    console.log(JSON.stringify(strategy.strategyProposal, null, 2));

    const events = trace?.events ?? [];
    const eventCount = (type: string) => events.filter(e => e.event_type === type).length;
    console.log(`\nTrace events:`);
    console.log(`  agent_start:     ${eventCount("agent_start")}`);
    console.log(`  agent_complete:  ${eventCount("agent_complete")}`);
    console.log(`  contract_gate:   ${eventCount("contract_gate")}`);
    console.log(`  llm_call:        ${eventCount("llm_call")}`);
    console.log(`  decision:        ${eventCount("decision")}`);
    console.log(`  ingestion_error: ${eventCount("ingestion_error")}`);
    console.log(`  failure:         ${eventCount("failure")}`);

    const unreliableEvents = events.filter(e =>
        e.event_type === "decision" && (e as { decision?: string }).decision === "extrapolation_unreliable"
    ).length;
    console.log(`  extrapolation_unreliable: ${unreliableEvents}`);
}

main().catch(err => {
    console.error("\n[Pipeline] Crashed:", err instanceof Error ? err.message : err);
    process.exit(1);
});

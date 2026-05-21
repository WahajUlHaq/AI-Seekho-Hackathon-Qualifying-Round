import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { SourceDocument } from "../interfaces/source-document.interface";

interface TemporalAnalysisConfig {
    slopeThreshold: number;
    driftStdDevThreshold: number;
    spikeZScore: number;
    anomalyZScore: number;
    minDataPoints: number;
}

export type PatternClass = "Spike" | "Decline" | "Drift" | "Anomaly" | "Stable";

export interface AnomalyPoint {
    timestamp: string;
    value: number;
    zScore: number;
}

export interface MetricAnalysis {
    metric: string;
    classification: PatternClass;
    slope: number;
    stdDev: number;
    meanValue: number;
    dataPoints: number;
    anomalies: AnomalyPoint[];
}

export interface TemporalAnalysisInput extends AgentInput {
    sources: SourceDocument[];
}

export interface TemporalAnalysisOutput extends AgentOutput {
    analysis_id: string;
    analyzed_at: string;
    metrics: MetricAnalysis[];
}

interface TimePoint {
    timestamp: string;
    value: number;
    metric: string;
}

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

// Pure math utilities — no LLM
export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
    return Math.sqrt(variance);
}

export function linearRegressionSlope(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n < 2) return 0;
    const xMean = mean(xs);
    const yMean = mean(ys);
    const numerator   = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
    const denominator = xs.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);
    return denominator === 0 ? 0 : numerator / denominator;
}

export class TemporalAnalysisAgent extends BaseAgent<
    TemporalAnalysisInput,
    TemporalAnalysisOutput
> {
    private readonly cfg: TemporalAnalysisConfig;

    constructor() {
        super("TemporalAnalysisAgent", "");   // no AMCE contract — output flows directly to InsightAgent

        const thresholdsPath = path.resolve(__dirname, "../../config/agentThresholds.config.json");
        const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf-8"));
        this.cfg = thresholds.temporalAnalysis as TemporalAnalysisConfig;
    }

    protected async execute(input: TemporalAnalysisInput): Promise<TemporalAnalysisOutput> {
        const { pipeline_id, sources } = input;

        const points = this.extractTimePoints(sources);
        const byMetric = this.groupByMetric(points);
        const metrics: MetricAnalysis[] = [];

        for (const [metric, pts] of byMetric.entries()) {
            if (pts.length < this.cfg.minDataPoints) continue;

            const analysis = this.analyzeMetric(metric, pts);
            metrics.push(analysis);
        }

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            analysis_id: makeId("ANA"),
            analyzed_at: new Date().toISOString(),
            metrics,
        };
    }

    private extractTimePoints(sources: SourceDocument[]): TimePoint[] {
        const points: TimePoint[] = [];

        for (const doc of sources) {
            try {
                const parsed: unknown = JSON.parse(doc.content);
                const items = Array.isArray(parsed) ? parsed : [parsed];

                for (const item of items) {
                    if (typeof item !== "object" || item === null) continue;
                    const rec = item as Record<string, unknown>;

                    // Look for any numeric value with an associated timestamp
                    const timestamp = rec["timestamp"] as string
                        || rec["last_updated"] as string
                        || doc.ingested_at;

                    if (!timestamp) continue;

                    for (const [key, val] of Object.entries(rec)) {
                        if (key === "timestamp" || key === "last_updated") continue;
                        if (typeof val === "number" && isFinite(val)) {
                            points.push({ timestamp, value: val, metric: key });
                        }
                    }
                }
            } catch {
                // non-JSON content — skip
            }
        }

        return points;
    }

    private groupByMetric(points: TimePoint[]): Map<string, TimePoint[]> {
        const map = new Map<string, TimePoint[]>();
        for (const pt of points) {
            if (!map.has(pt.metric)) map.set(pt.metric, []);
            map.get(pt.metric)!.push(pt);
        }
        return map;
    }

    private analyzeMetric(metric: string, pts: TimePoint[]): MetricAnalysis {
        const sorted = [...pts].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const t0   = new Date(sorted[0].timestamp).getTime();
        const xs   = sorted.map(p => (new Date(p.timestamp).getTime() - t0) / 3_600_000); // hours
        const ys   = sorted.map(p => p.value);

        const avg    = mean(ys);
        const stdDev = standardDeviation(ys);
        const slope  = linearRegressionSlope(xs, ys);

        const anomalies: AnomalyPoint[] = [];
        let hasSpikeAnomaly = false;
        let hasAnomalyLevel = false;

        for (let i = 0; i < sorted.length; i++) {
            const zScore = stdDev > 0 ? (ys[i] - avg) / stdDev : 0;
            if (Math.abs(zScore) >= this.cfg.anomalyZScore) {
                hasAnomalyLevel = true;
                anomalies.push({ timestamp: sorted[i].timestamp, value: ys[i], zScore });
            } else if (Math.abs(zScore) >= this.cfg.spikeZScore) {
                hasSpikeAnomaly = true;
                anomalies.push({ timestamp: sorted[i].timestamp, value: ys[i], zScore });
            }
        }

        let classification: PatternClass;

        if (hasAnomalyLevel) {
            classification = "Anomaly";
        } else if (hasSpikeAnomaly || slope > this.cfg.slopeThreshold) {
            classification = "Spike";
        } else if (slope < -this.cfg.slopeThreshold) {
            classification = "Decline";
        } else if (stdDev > this.cfg.driftStdDevThreshold) {
            classification = "Drift";
        } else {
            classification = "Stable";
        }

        return {
            metric,
            classification,
            slope,
            stdDev,
            meanValue: avg,
            dataPoints: sorted.length,
            anomalies,
        };
    }
}

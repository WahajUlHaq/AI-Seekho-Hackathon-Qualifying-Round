import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";

export interface DataPoint {
    timestamp: string;
    value: number;
}

export interface TemporalPattern {
    pattern_type: "decline" | "spike" | "drift" | "anomaly" | "stable";
    metric_name: string;
    time_window: string;
    change_magnitude: number;
    change_direction: "increasing" | "decreasing" | "volatile";
    confidence: number;
    data_points: DataPoint[];
}

export interface TemporalAnalysisInput extends AgentInput {
    time_series_data: Array<{
        metric_name: string;
        data_points: DataPoint[];
    }>;
}

export interface TemporalAnalysisOutput extends AgentOutput {
    patterns: TemporalPattern[];
}

export class TemporalAnalysisAgent extends BaseAgent<
    TemporalAnalysisInput,
    TemporalAnalysisOutput
> {
    constructor() {
        super("TemporalAnalysisAgent", "");
    }

    protected async execute(
        input: TemporalAnalysisInput
    ): Promise<TemporalAnalysisOutput> {
        const { pipeline_id, time_series_data } = input;

        const patterns = await Promise.all(
            time_series_data.map((series) =>
                this.analyzeTimeSeries(series.metric_name, series.data_points, pipeline_id)
            )
        );

        this.logDecision(
            pipeline_id,
            `Temporal analysis complete: ${patterns.map(p => `${p.metric_name}=${p.pattern_type}`).join(", ")}`,
            "temporal_analysis_complete",
            patterns.reduce((sum, p) => sum + p.confidence, 0) / (patterns.length || 1)
        );

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            patterns,
        };
    }

    private async analyzeTimeSeries(
        metricName: string,
        dataPoints: DataPoint[],
        pipelineId: string
    ): Promise<TemporalPattern> {
        if (dataPoints.length === 0) {
            return {
                pattern_type: "stable",
                metric_name: metricName,
                time_window: "unknown",
                change_magnitude: 0,
                change_direction: "volatile",
                confidence: 0,
                data_points: [],
            };
        }

        const sorted = [...dataPoints].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const regression = this.linearRegression(sorted);
        const hasSpike = this.detectSpike(sorted);
        const values = sorted.map((p) => p.value);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const normalizedSlope = Math.abs(regression.slope) / (Math.abs(mean) + 0.0001);

        let pattern_type: TemporalPattern["pattern_type"];
        if (hasSpike && Math.abs(regression.percent_change) > 30) {
            pattern_type = "spike";
        } else if (normalizedSlope < 0.02 && regression.r_squared > 0.5) {
            pattern_type = "stable";
        } else if (normalizedSlope > 0.1 && regression.r_squared > 0.7) {
            pattern_type = regression.slope < 0 ? "decline" : "drift";
        } else if (hasSpike) {
            pattern_type = "anomaly";
        } else {
            pattern_type = "drift";
        }

        const change_direction: TemporalPattern["change_direction"] =
            hasSpike && Math.abs(regression.percent_change) < 5
                ? "volatile"
                : regression.slope > 0
                ? "increasing"
                : "decreasing";

        const time_window = await this.describeTimeWindow(
            metricName,
            sorted,
            pipelineId
        );

        this.logDecision(
            pipelineId,
            `${metricName}: pattern=${pattern_type}, change=${regression.percent_change.toFixed(1)}%, direction=${change_direction}`,
            pattern_type,
            regression.r_squared
        );

        return {
            pattern_type,
            metric_name: metricName,
            time_window,
            change_magnitude: Math.abs(regression.percent_change),
            change_direction,
            confidence: regression.r_squared,
            data_points: sorted,
        };
    }

    private linearRegression(points: DataPoint[]): {
        slope: number;
        r_squared: number;
        percent_change: number;
    } {
        const n = points.length;
        if (n < 2) return { slope: 0, r_squared: 0, percent_change: 0 };

        const xs = points.map((_, i) => i);
        const ys = points.map((p) => p.value);

        const sumX = xs.reduce((a, b) => a + b, 0);
        const sumY = ys.reduce((a, b) => a + b, 0);
        const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
        const sumXX = xs.reduce((s, x) => s + x * x, 0);

        const denom = n * sumXX - sumX * sumX;
        const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;

        const yMean = sumY / n;
        const ssTot = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
        const ssRes = ys.reduce(
            (s, y, i) => s + Math.pow(y - (slope * xs[i] + intercept), 2),
            0
        );
        const r_squared = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

        const first = ys[0];
        const last = ys[ys.length - 1];
        const percent_change = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;

        return { slope, r_squared, percent_change };
    }

    private detectSpike(points: DataPoint[]): boolean {
        if (points.length < 3) return false;
        const values = points.map((p) => p.value);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance =
            values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        return stdDev > 0 && values.some((v) => Math.abs(v - mean) > 2 * stdDev);
    }

    private async describeTimeWindow(
        metricName: string,
        sorted: DataPoint[],
        pipelineId: string
    ): Promise<string> {
        const first = sorted[0].timestamp;
        const last = sorted[sorted.length - 1].timestamp;
        const ms = new Date(last).getTime() - new Date(first).getTime();
        const hours = ms / 3_600_000;

        // Use LLM for a natural language description
        const prompt = `Given the time series metric "${metricName}" with ${sorted.length} data points from ${first} to ${last}, describe the time window in a short phrase (e.g., "last 7 days", "past 4 hours", "past week"). Respond with ONLY the phrase, no explanation or punctuation.`;

        try {
            const result = await this.llmComplete(pipelineId, prompt, false, "time_window_description");
            const clean = result.trim().replace(/^["']|["']$/g, "");
            if (clean.length > 0 && clean.length < 50) return clean;
        } catch {
            // fallback below
        }

        if (hours < 1) return `last ${Math.round(hours * 60)} minutes`;
        if (hours < 24) return `last ${Math.round(hours)} hours`;
        const days = Math.round(hours / 24);
        return `last ${days} day${days === 1 ? "" : "s"}`;
    }
}

export const temporalAnalysisAgent = new TemporalAnalysisAgent();

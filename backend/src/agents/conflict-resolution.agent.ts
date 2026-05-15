import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { SourceDocument } from "../interfaces/source-document.interface";
import { Contradiction } from "./contradiction-detector.agent";

interface ConflictResolutionConfig {
    credibilityDiffThreshold: number;
    temporalDiffHours: number;
    weightedAverageMaxDiff: number;
}

export type ResolutionStrategy =
    | "credibility_weighted"
    | "recency_weighted"
    | "weighted_average"
    | "investigation_required";

export interface Resolution {
    contradiction_id: string;
    resolutionMethod: ResolutionStrategy;
    resolved_value: string;
    confidence: number;
    reasoning: string;
}

export interface InvestigationPath {
    contradiction_id: string;
    topic: string;
    recommended_steps: string[];
    estimated_resolution_time: string;
}

export interface ConflictResolutionInput extends AgentInput {
    contradictions: Contradiction[];
    sources: SourceDocument[];
}

export interface ConflictResolutionOutput extends AgentOutput {
    resolution_id: string;
    resolved_at: string;
    resolutions: Resolution[];
    investigation_paths: InvestigationPath[];
}

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

function hoursDiff(isoA: string, isoB: string): number {
    return Math.abs(new Date(isoA).getTime() - new Date(isoB).getTime()) / 3_600_000;
}

function weightedAverage(valA: number, credA: number, valB: number, credB: number): number {
    const totalCred = credA + credB;
    if (totalCred === 0) return (valA + valB) / 2;
    return (valA * credA + valB * credB) / totalCred;
}

export class ConflictResolutionAgent extends BaseAgent<
    ConflictResolutionInput,
    ConflictResolutionOutput
> {
    private readonly cfg: ConflictResolutionConfig;

    constructor() {
        super("ConflictResolutionAgent", "conflict_resolution_v1");

        const thresholdsPath = path.resolve(__dirname, "../../config/agentThresholds.config.json");
        const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf-8"));
        this.cfg = thresholds.conflictResolution as ConflictResolutionConfig;
    }

    protected async execute(input: ConflictResolutionInput): Promise<ConflictResolutionOutput> {
        const { pipeline_id, contradictions, sources } = input;

        const sourceMap = new Map(sources.map(s => [s.source_id, s]));
        const resolutions: Resolution[] = [];
        const investigationPaths: InvestigationPath[] = [];

        for (const contradiction of contradictions) {
            const srcA = sourceMap.get(contradiction.sources_involved[0]);
            const srcB = sourceMap.get(contradiction.sources_involved[1]);

            const resolution = await this.resolveOne(
                pipeline_id,
                contradiction,
                srcA,
                srcB,
                investigationPaths
            );
            resolutions.push(resolution);
        }

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            resolution_id: makeId("RES"),
            resolved_at: new Date().toISOString(),
            resolutions,
            investigation_paths: investigationPaths,
        };
    }

    private async resolveOne(
        pipelineId: string,
        contradiction: Contradiction,
        srcA: SourceDocument | undefined,
        srcB: SourceDocument | undefined,
        investigationPaths: InvestigationPath[]
    ): Promise<Resolution> {
        const credA = srcA?.credibility_score?.total ?? 0;
        const credB = srcB?.credibility_score?.total ?? 0;
        const credDiff = Math.abs(credA - credB);

        // Rule 1: large credibility gap → trust highest credibility
        if (credDiff >= this.cfg.credibilityDiffThreshold) {
            const winner = credA >= credB ? srcA : srcB;
            const winValue = credA >= credB ? contradiction.claim_a : contradiction.claim_b;

            this.logDecision(
                pipelineId,
                `Resolved "${contradiction.topic}" by credibility (diff=${credDiff.toFixed(1)})`,
                "credibility_weighted",
                0.88
            );

            return {
                contradiction_id: contradiction.contradiction_id,
                resolutionMethod: "credibility_weighted",
                resolved_value: winValue,
                confidence: 0.88,
                reasoning: `Source ${winner?.source_id} had credibility ${Math.max(credA, credB).toFixed(1)} vs ${Math.min(credA, credB).toFixed(1)}`,
            };
        }

        // Rule 2: temporal gap → trust most recent
        if (srcA && srcB) {
            const timeDiff = hoursDiff(srcA.ingested_at, srcB.ingested_at);
            if (timeDiff >= this.cfg.temporalDiffHours && contradiction.type !== "boolean") {
                const newerSrc   = new Date(srcA.ingested_at) >= new Date(srcB.ingested_at) ? srcA : srcB;
                const newerValue = newerSrc.source_id === srcA?.source_id
                    ? contradiction.claim_a
                    : contradiction.claim_b;

                this.logDecision(
                    pipelineId,
                    `Resolved "${contradiction.topic}" by recency (diff=${timeDiff.toFixed(1)}h)`,
                    "recency_weighted",
                    0.80
                );

                return {
                    contradiction_id: contradiction.contradiction_id,
                    resolutionMethod: "recency_weighted",
                    resolved_value: newerValue,
                    confidence: 0.80,
                    reasoning: `Source ${newerSrc.source_id} is ${timeDiff.toFixed(1)}h newer`,
                };
            }
        }

        // Rule 3: minor numeric → weighted average (only if values within configured proximity)
        if (contradiction.type === "numeric" && contradiction.severity !== "CRITICAL") {
            const valA = parseFloat(contradiction.claim_a);
            const valB = parseFloat(contradiction.claim_b);

            if (!isNaN(valA) && !isNaN(valB) && Math.abs(valA - valB) <= this.cfg.weightedAverageMaxDiff) {
                const avg = weightedAverage(valA, credA, valB, credB);

                this.logDecision(
                    pipelineId,
                    `Resolved "${contradiction.topic}" by weighted average`,
                    "weighted_average",
                    0.72
                );

                return {
                    contradiction_id: contradiction.contradiction_id,
                    resolutionMethod: "weighted_average",
                    resolved_value: avg.toFixed(2),
                    confidence: 0.72,
                    reasoning: `Credibility-weighted average of ${valA} (cred=${credA}) and ${valB} (cred=${credB})`,
                };
            }
        }

        // Rule 4: unresolved — LLM investigation path
        const investigationPath = await this.generateInvestigationPath(
            pipelineId,
            contradiction
        );
        investigationPaths.push(investigationPath);

        this.logDecision(
            pipelineId,
            `Contradiction "${contradiction.topic}" requires investigation`,
            "investigation_required",
            0.5
        );

        return {
            contradiction_id: contradiction.contradiction_id,
            resolutionMethod: "investigation_required",
            resolved_value: "see investigation_paths",
            confidence: 0.5,
            reasoning: `Unresolved ${contradiction.severity} contradiction between ${contradiction.claim_a} and ${contradiction.claim_b}`,
        };
    }

    private async generateInvestigationPath(
        pipelineId: string,
        contradiction: Contradiction
    ): Promise<InvestigationPath> {
        const prompt = `A data contradiction requires investigation. Generate a structured investigation plan.

Topic: ${contradiction.topic}
Severity: ${contradiction.severity}
Type: ${contradiction.type}
Claim A: ${contradiction.claim_a}
Claim B: ${contradiction.claim_b}
Sources involved: ${contradiction.sources_involved.join(", ")}

Reply with ONLY a JSON object:
{
  "recommended_steps": ["step 1", "step 2", "step 3"],
  "estimated_resolution_time": "e.g. 2-4 hours"
}`;

        try {
            const response = await this.llmComplete(pipelineId, prompt, false, "investigation_path_generation");
            const jsonMatch = response.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as {
                    recommended_steps: string[];
                    estimated_resolution_time: string;
                };
                return {
                    contradiction_id: contradiction.contradiction_id,
                    topic: contradiction.topic,
                    recommended_steps: parsed.recommended_steps ?? ["Manual review required"],
                    estimated_resolution_time: parsed.estimated_resolution_time ?? "Unknown",
                };
            }
        } catch {
            // fallback below
        }

        return {
            contradiction_id: contradiction.contradiction_id,
            topic: contradiction.topic,
            recommended_steps: [
                `Audit primary source for topic: ${contradiction.topic}`,
                `Cross-reference ${contradiction.sources_involved.join(" and ")}`,
                "Escalate to domain expert for manual verification",
            ],
            estimated_resolution_time: "4-8 hours",
        };
    }
}

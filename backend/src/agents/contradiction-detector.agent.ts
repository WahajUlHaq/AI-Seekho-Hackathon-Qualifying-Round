import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { SourceDocument } from "../interfaces/source-document.interface";

interface ContradictionDetectorConfig {
    numericDiscrepancyPercent: number;
    numericCriticalPercent: number;
    temporalDiffHours: number;
    confidenceThreshold: number;
}

interface Claim {
    topic: string;
    claimType: "numeric" | "boolean" | "categorical" | "temporal";
    value: string | number;
    unit: string | null;
}

interface SourceClaim {
    sourceId: string;
    claim: Claim;
}

export interface Contradiction {
    contradiction_id: string;
    topic: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    type: "numeric" | "boolean" | "categorical" | "temporal";
    sources_involved: string[];
    claim_a: string;
    claim_b: string;
    confidence: number;
}

export interface ContradictionDetectorInput extends AgentInput {
    sources: SourceDocument[];
}

export interface ContradictionDetectorOutput extends AgentOutput {
    detection_id: string;
    contradictions_found: number;
    contradictions: Contradiction[];
}

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

function parseBoolean(val: string): boolean | null {
    const lower = String(val).toLowerCase().trim();
    if (["true", "yes", "1", "verified", "active"].includes(lower)) return true;
    if (["false", "no", "0", "unverified", "inactive", "pending"].includes(lower)) return false;
    return null;
}

export class ContradictionDetectorAgent extends BaseAgent<
    ContradictionDetectorInput,
    ContradictionDetectorOutput
> {
    private readonly cfg: ContradictionDetectorConfig;

    constructor() {
        super("ContradictionDetectorAgent", "contradiction_detection_v1");

        const thresholdsPath = path.resolve(__dirname, "../../config/agentThresholds.config.json");
        const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf-8"));
        this.cfg = thresholds.contradictionDetector as ContradictionDetectorConfig;
    }

    protected async execute(input: ContradictionDetectorInput): Promise<ContradictionDetectorOutput> {
        const { pipeline_id, sources } = input;

        // Step A: extract claims per source
        const allClaims: SourceClaim[] = [];

        for (const doc of sources) {
            const claims = await this.extractClaims(pipeline_id, doc);
            for (const claim of claims) {
                allClaims.push({ sourceId: doc.source_id, claim });
            }
        }

        // Step B: group by topic (lowercase normalized)
        const byTopic = new Map<string, SourceClaim[]>();
        for (const sc of allClaims) {
            const key = sc.claim.topic.toLowerCase().trim();
            if (!byTopic.has(key)) byTopic.set(key, []);
            byTopic.get(key)!.push(sc);
        }

        // Step C: detect discrepancies
        const contradictions: Contradiction[] = [];

        for (const [topic, claims] of byTopic.entries()) {
            if (claims.length < 2) continue;

            for (let i = 0; i < claims.length; i++) {
                for (let j = i + 1; j < claims.length; j++) {
                    const ca = claims[i];
                    const cb = claims[j];
                    if (ca.sourceId === cb.sourceId) continue;

                    const contradiction = this.compareClams(topic, ca, cb);
                    if (contradiction) contradictions.push(contradiction);
                }
            }
        }

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            detection_id: makeId("DET"),
            contradictions_found: contradictions.length,
            contradictions,
        };
    }

    private async extractClaims(pipelineId: string, doc: SourceDocument): Promise<Claim[]> {
        const prompt = `Extract factual claims from the following content. Return a JSON array of claims.
Each claim must have:
- "topic": a short subject label (e.g., "ITM-A1 quantity", "SUPP-X1 certification", "route suspension duration")
- "claimType": one of "numeric", "boolean", "categorical", or "temporal"
- "value": the claim value (number for numeric, true/false for boolean, string for others)
- "unit": the unit of measurement for numeric claims, null otherwise

Content:
${doc.content.slice(0, 2000)}

Reply with ONLY a valid JSON array:
[{"topic": "...", "claimType": "...", "value": ..., "unit": ...}]`;

        try {
            const response = await this.llmComplete(pipelineId, prompt, false, "claim_extraction");
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return [];

            const parsed = JSON.parse(jsonMatch[0]) as Claim[];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    private compareClams(topic: string, ca: SourceClaim, cb: SourceClaim): Contradiction | null {
        const { claim: claimA, sourceId: srcA } = ca;
        const { claim: claimB, sourceId: srcB } = cb;

        if (claimA.claimType !== claimB.claimType) return null;

        switch (claimA.claimType) {
            case "numeric": {
                const valA = parseFloat(String(claimA.value));
                const valB = parseFloat(String(claimB.value));
                if (isNaN(valA) || isNaN(valB)) return null;

                // Use min(a,b) as base — measures how much the smaller value changed (standard percent-change)
                const base = Math.min(Math.abs(valA), Math.abs(valB));
                if (base === 0) return null;
                const diffPct = (Math.abs(valA - valB) / base) * 100;

                if (diffPct < this.cfg.numericDiscrepancyPercent) return null;

                const severity = diffPct >= this.cfg.numericCriticalPercent ? "CRITICAL" : "MEDIUM";
                const confidence = severity === "CRITICAL" ? 0.92 : 0.80;

                return {
                    contradiction_id: makeId("CONT"),
                    topic,
                    severity,
                    type: "numeric",
                    sources_involved: [srcA, srcB],
                    claim_a: `${valA}${claimA.unit ? " " + claimA.unit : ""}`,
                    claim_b: `${valB}${claimB.unit ? " " + claimB.unit : ""}`,
                    confidence,
                };
            }

            case "boolean": {
                const boolA = parseBoolean(String(claimA.value));
                const boolB = parseBoolean(String(claimB.value));
                if (boolA === null || boolB === null) return null;
                if (boolA === boolB) return null;

                return {
                    contradiction_id: makeId("CONT"),
                    topic,
                    severity: "CRITICAL",
                    type: "boolean",
                    sources_involved: [srcA, srcB],
                    claim_a: String(claimA.value),
                    claim_b: String(claimB.value),
                    confidence: 0.95,
                };
            }

            case "categorical": {
                const valA = String(claimA.value).toLowerCase().trim();
                const valB = String(claimB.value).toLowerCase().trim();
                if (valA === valB) return null;

                return {
                    contradiction_id: makeId("CONT"),
                    topic,
                    severity: "MEDIUM",
                    type: "categorical",
                    sources_involved: [srcA, srcB],
                    claim_a: String(claimA.value),
                    claim_b: String(claimB.value),
                    confidence: 0.75,
                };
            }

            case "temporal": {
                const dateA = new Date(String(claimA.value));
                const dateB = new Date(String(claimB.value));
                if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return null;

                const diffHours = Math.abs(dateA.getTime() - dateB.getTime()) / 3_600_000;
                if (diffHours <= this.cfg.temporalDiffHours) return null;

                return {
                    contradiction_id: makeId("CONT"),
                    topic,
                    severity: "MEDIUM",
                    type: "temporal",
                    sources_involved: [srcA, srcB],
                    claim_a: String(claimA.value),
                    claim_b: String(claimB.value),
                    confidence: 0.78,
                };
            }

            default:
                return null;
        }
    }
}

import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { CredibilityScore } from "./credibility-scorer.agent";

export interface Contradiction {
    contradiction_id: string;
    type: "numeric" | "boolean" | "categorical" | "temporal";
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    conflicting_sources: Array<{
        source_id: string;
        claim: string;
        credibility_score: number;
    }>;
    topic: string;
    confidence: number;
    resolution_needed: boolean;
    // Contract-required fields
    sources_involved: string[];
    claim_a: string;
    claim_b: string;
}

interface ExtractedClaim {
    claim: string;
    topic: string;
    type: "numeric" | "boolean" | "categorical" | "temporal";
    value: number | boolean | string;
    unit?: string;
    source_id: string;
    credibility_score: number;
}

export interface ContradictionDetectorInput extends AgentInput {
    filtered_sources: NormalizedSource[];
    credibility_scores: CredibilityScore[];
}

export interface ContradictionDetectorOutput extends AgentOutput {
    detection_id: string;
    contradictions_found: number;
    contradictions: Contradiction[];
}

export class ContradictionDetectorAgent extends BaseAgent<
    ContradictionDetectorInput,
    ContradictionDetectorOutput
> {
    constructor() {
        super("ContradictionDetectorAgent", "contradiction_detection");
    }

    protected async execute(
        input: ContradictionDetectorInput
    ): Promise<ContradictionDetectorOutput> {
        const { pipeline_id, filtered_sources, credibility_scores } = input;

        // Extract claims from all sources in parallel
        const claimArrays = await Promise.all(
            filtered_sources.map((source) => {
                const score = credibility_scores.find(
                    (cs) => cs.source_id === source.source_id
                );
                return this.extractClaims(source, score?.total_score ?? 0, pipeline_id);
            })
        );

        const allClaims = claimArrays.flat();

        // Group by topic and detect conflicts
        const byTopic = this.groupByTopic(allClaims);
        const rawContradictions: Contradiction[] = [];

        for (const [_topic, claims] of Object.entries(byTopic)) {
            if (claims.length < 2) continue;
            for (let i = 0; i < claims.length; i++) {
                for (let j = i + 1; j < claims.length; j++) {
                    if (claims[i].source_id === claims[j].source_id) continue;
                    const c = this.checkConflict(claims[i], claims[j]);
                    if (c) rawContradictions.push(c);
                }
            }
        }

        // Deduplicate: merge contradictions on same topic+type into one with all sources
        const contradictions = this.deduplicateContradictions(rawContradictions);

        contradictions.forEach((c) => {
            this.logDecision(
                pipeline_id,
                `Detected ${c.type} contradiction on topic '${c.topic}': "${c.claim_a}" vs "${c.claim_b}"`,
                c.severity,
                c.confidence
            );
        });

        const detection_id = `DET-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, 8)}`;

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            detection_id,
            contradictions_found: contradictions.length,
            contradictions,
        };
    }

    private async extractClaims(
        source: NormalizedSource,
        credScore: number,
        pipelineId: string
    ): Promise<ExtractedClaim[]> {
        const prompt = `Extract all factual claims from the following text.
For each claim, identify:
- The claim statement
- The topic (e.g., "inventory_level", "system_status", "delivery_time", "demand_level")
- Whether it's numeric, boolean, categorical, or temporal
- The actual value if extractable

Text:
${source.raw_text.slice(0, 3000)}

Respond with ONLY valid JSON, no markdown fences, no preamble:
{
  "claims": [
    {
      "claim": "Stock level is 500 units",
      "topic": "inventory_level",
      "type": "numeric",
      "value": 500,
      "unit": "units"
    }
  ]
}

If no clear factual claims exist, return: {"claims": []}`;

        try {
            const raw = await this.llmComplete(pipelineId, prompt, false, "claim_extraction");
            const parsed = this.parseLLMJSON<{ claims: Array<Omit<ExtractedClaim, "source_id" | "credibility_score">> }>(raw);
            if (parsed?.claims) {
                return parsed.claims.map((c) => ({
                    ...c,
                    source_id: source.source_id,
                    credibility_score: credScore,
                    type: c.type as ExtractedClaim["type"],
                }));
            }
        } catch (err) {
            console.warn(`[ContradictionDetector] Claim extraction failed for ${source.source_id}:`, err);
        }

        // Heuristic fallback: extract numeric values from text
        return this.heuristicExtract(source, credScore);
    }

    private heuristicExtract(source: NormalizedSource, credScore: number): ExtractedClaim[] {
        const claims: ExtractedClaim[] = [];
        const text = source.raw_text;

        // Extract stock/inventory numbers
        const stockMatches = text.match(/(?:stock|inventory|units?|count)[:\s]+(\d+(?:,\d+)?)/gi);
        if (stockMatches) {
            for (const match of stockMatches) {
                const numMatch = match.match(/(\d+(?:,\d+)?)/);
                if (numMatch) {
                    claims.push({
                        claim: match.trim(),
                        topic: "inventory_level",
                        type: "numeric",
                        value: parseInt(numMatch[1].replace(/,/g, ""), 10),
                        unit: "units",
                        source_id: source.source_id,
                        credibility_score: credScore,
                    });
                }
            }
        }

        // Detect "out of stock" as 0 units
        if (/out of stock|0 units|zero units|no stock/i.test(text)) {
            claims.push({
                claim: "Stock is out of stock (0 units)",
                topic: "inventory_level",
                type: "numeric",
                value: 0,
                unit: "units",
                source_id: source.source_id,
                credibility_score: credScore,
            });
        }

        // Extract delay/delivery time info
        const delayMatch = text.match(/delayed?\s+(?:by\s+)?(\d+)\s+days?/i);
        if (delayMatch) {
            claims.push({
                claim: `Delivery delayed by ${delayMatch[1]} days`,
                topic: "delivery_time",
                type: "numeric",
                value: parseInt(delayMatch[1], 10),
                unit: "days",
                source_id: source.source_id,
                credibility_score: credScore,
            });
        }

        return claims;
    }

    private groupByTopic(claims: ExtractedClaim[]): Record<string, ExtractedClaim[]> {
        const grouped: Record<string, ExtractedClaim[]> = {};
        for (const claim of claims) {
            if (!claim.topic) continue;
            const key = claim.topic.toLowerCase().replace(/\s+/g, "_");
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(claim);
        }
        return grouped;
    }

    private checkConflict(c1: ExtractedClaim, c2: ExtractedClaim): Contradiction | null {
        if (c1.type !== c2.type) return null;

        switch (c1.type) {
            case "numeric": {
                const v1 = typeof c1.value === "number" ? c1.value : parseFloat(String(c1.value));
                const v2 = typeof c2.value === "number" ? c2.value : parseFloat(String(c2.value));
                if (isNaN(v1) || isNaN(v2)) return null;
                const maxVal = Math.max(Math.abs(v1), Math.abs(v2));
                if (maxVal === 0 && v1 === v2) return null;
                // Special case: 0 vs non-zero is always a conflict
                const pctDiff = maxVal === 0 ? 1 : Math.abs(v1 - v2) / maxVal;
                if (pctDiff <= 0.2) return null;
                const severity: Contradiction["severity"] =
                    pctDiff > 0.5 ? "CRITICAL" : pctDiff > 0.35 ? "HIGH" : "MEDIUM";
                const confidence = Math.min(0.95, 0.7 + pctDiff * 0.3);
                return this.buildContradiction("numeric", severity, c1, c2, confidence);
            }

            case "boolean": {
                const v1 = String(c1.value).toLowerCase();
                const v2 = String(c2.value).toLowerCase();
                const truthy = ["true", "yes", "1", "operational", "available", "in stock"];
                const falsy = ["false", "no", "0", "down", "unavailable", "out of stock"];
                const b1 = truthy.includes(v1) ? true : falsy.includes(v1) ? false : null;
                const b2 = truthy.includes(v2) ? true : falsy.includes(v2) ? false : null;
                if (b1 === null || b2 === null || b1 === b2) return null;
                return this.buildContradiction("boolean", "CRITICAL", c1, c2, 0.95);
            }

            case "categorical": {
                if (String(c1.value).toLowerCase() === String(c2.value).toLowerCase()) return null;
                return this.buildContradiction("categorical", "HIGH", c1, c2, 0.80);
            }

            case "temporal": {
                const t1 = new Date(String(c1.value)).getTime();
                const t2 = new Date(String(c2.value)).getTime();
                if (isNaN(t1) || isNaN(t2)) return null;
                const hoursDiff = Math.abs(t1 - t2) / 3_600_000;
                if (hoursDiff < 24) return null;
                const severity: Contradiction["severity"] = hoursDiff > 168 ? "HIGH" : "MEDIUM";
                return this.buildContradiction("temporal", severity, c1, c2, 0.85);
            }
        }

        return null;
    }

    private buildContradiction(
        type: Contradiction["type"],
        severity: Contradiction["severity"],
        c1: ExtractedClaim,
        c2: ExtractedClaim,
        confidence: number
    ): Contradiction {
        const contradiction_id = `CONTRA-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, 8)}`;

        // Discount confidence when either source has very low credibility (< 20)
        const minCred = Math.min(c1.credibility_score, c2.credibility_score);
        const credFactor = minCred < 20 ? (minCred / 20) * 0.5 : 1.0;
        const adjustedConfidence = parseFloat((confidence * credFactor).toFixed(2));

        return {
            contradiction_id,
            type,
            severity,
            conflicting_sources: [
                { source_id: c1.source_id, claim: c1.claim, credibility_score: c1.credibility_score },
                { source_id: c2.source_id, claim: c2.claim, credibility_score: c2.credibility_score },
            ],
            topic: c1.topic,
            confidence: adjustedConfidence,
            resolution_needed: true,
            sources_involved: [c1.source_id, c2.source_id],
            claim_a: c1.claim,
            claim_b: c2.claim,
        };
    }

    private deduplicateContradictions(contradictions: Contradiction[]): Contradiction[] {
        const seen = new Map<string, Contradiction>();

        for (const c of contradictions) {
            const key = `${c.topic}|${c.type}`;
            const existing = seen.get(key);

            if (!existing) {
                seen.set(key, c);
            } else {
                // Merge sources into existing contradiction
                for (const source of c.conflicting_sources) {
                    if (!existing.conflicting_sources.some((s) => s.source_id === source.source_id)) {
                        existing.conflicting_sources.push(source);
                        existing.sources_involved.push(source.source_id);
                    }
                }
                // Escalate severity if needed
                const severityOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
                if (
                    severityOrder.indexOf(c.severity) >
                    severityOrder.indexOf(existing.severity)
                ) {
                    existing.severity = c.severity;
                }
            }
        }

        return Array.from(seen.values());
    }

    private parseLLMJSON<T>(raw: string): T | null {
        const attempts: (string | null)[] = [
            raw,
            (() => { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return m ? m[1] : null; })(),
            (() => { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); return s !== -1 && e > s ? raw.slice(s, e + 1) : null; })(),
        ];
        for (const a of attempts) {
            if (!a) continue;
            try { return JSON.parse(a) as T; } catch { continue; }
        }
        return null;
    }
}

export const contradictionDetectorAgent = new ContradictionDetectorAgent();

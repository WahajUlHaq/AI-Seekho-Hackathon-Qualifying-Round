import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { CredibilityScore } from "./credibility-scorer.agent";
import { antigravityFileLogger } from "../tracing/file-logger";
import {
    ContradictionDetectorOutputSchema,
    evaluateWithZod,
} from "../contracts/zod-schemas";

export interface Contradiction {
    contradiction_id: string;
    type: "numeric" | "boolean" | "categorical" | "temporal" | "implicit";
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

/**
 * V2 canonical claim shape. Every claim — whether extracted from a CSV row,
 * a JSON field, or unstructured PDF paragraph — is normalised into this
 * structure before cross-source comparison. The {topic, entity, value, unit}
 * tuple is what bridges structured-vs-unstructured contradiction detection.
 */
interface ExtractedClaim {
    claim: string;
    topic: string;
    entity?: string;
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
        const startTime = Date.now();

        // V2: extract claims from BOTH unstructured text AND structured rows.
        // The structured-to-claim bridge is what makes CSV ↔ PDF contradiction
        // detection work (e.g. "audit PDF says 500 units" vs "CSV says 0 units").
        const claimArrays = await Promise.all(
            filtered_sources.map(async (source) => {
                const score = credibility_scores.find(
                    (cs) => cs.source_id === source.source_id
                );
                const credScore = score?.total_score ?? 0;
                const textClaims = await this.extractClaims(source, credScore, pipeline_id);
                const structuredClaims = this.extractStructuredClaims(source, credScore);
                return [...textClaims, ...structuredClaims];
            })
        );

        const allClaims = claimArrays.flat();

        // Group by topic and detect explicit conflicts
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

        // V2: implicit contradictions — same topic pair never collide in byTopic
        // (e.g. inventory_level=500 vs demand_signal=critical_shortage), but
        // their semantic combination contradicts. Surface those here.
        const implicit = this.detectImplicitContradictions(allClaims);
        rawContradictions.push(...implicit);

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

        const output: ContradictionDetectorOutput = {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            detection_id,
            contradictions_found: contradictions.length,
            contradictions,
        };

        const amce = evaluateWithZod(
            output,
            ContradictionDetectorOutputSchema,
            "contradiction_detection_v1",
            "QUARANTINE"
        );
        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: "AMCE_M4_StructuralValidation",
            tool_called: "ZodValidator",
            reasoning: amce.passed
                ? `M4 output passed Zod structural validation (QUARANTINE mode) — ${contradictions.length} contradictions`
                : `M4 output Zod errors: ${amce.errors.join("; ")}`,
            status: amce.passed ? "SUCCESS" : "FAILED",
            rollback_action: amce.passed ? "none" : "Quarantine malformed output; trigger programmatic retry",
            latency_ms: Date.now() - startTime,
            cost: 0,
            rubric_category: "constraint_evaluation",
        });

        return output;
    }

    /**
     * V2 structured-to-claim bridge. Converts a single CSV/JSON row into a
     * canonical {topic, entity, value, unit} claim so it can collide with
     * unstructured claims extracted by the LLM.
     */
    private structuredRowToClaim(
        row: Record<string, unknown>,
        sourceId: string,
        credScore: number
    ): ExtractedClaim[] {
        const claims: ExtractedClaim[] = [];

        const entity =
            (row.SKU ?? row.sku ?? row.Supplier_ID ?? row.supplier_id ?? row.product_id ?? row.id) as string | undefined;
        const entityStr = entity !== undefined ? String(entity) : undefined;

        // Inventory / stock signals
        const stockField =
            (row.on_hand_units ?? row.OnHandUnits ?? row.stock ?? row.Stock ?? row.units ?? row.Last_Shipment_Units) as
                | number
                | string
                | undefined;
        if (stockField !== undefined && stockField !== "") {
            const n = typeof stockField === "number" ? stockField : parseFloat(String(stockField).replace(/,/g, ""));
            if (!isNaN(n)) {
                claims.push({
                    claim: `${entityStr ?? "Item"} on-hand or last shipment is ${n} units`,
                    topic: "inventory_level",
                    entity: entityStr,
                    type: "numeric",
                    value: n,
                    unit: "units",
                    source_id: sourceId,
                    credibility_score: credScore,
                });
            }
        }

        // Supplier reliability
        const reliabilityField = (row.Reliability_Score ?? row.reliability ?? row.reliability_score) as
            | number
            | string
            | undefined;
        if (reliabilityField !== undefined && reliabilityField !== "") {
            const n = typeof reliabilityField === "number" ? reliabilityField : parseFloat(String(reliabilityField));
            if (!isNaN(n)) {
                claims.push({
                    claim: `${entityStr ?? "Supplier"} reliability is ${n}`,
                    topic: "supplier_reliability",
                    entity: entityStr,
                    type: "numeric",
                    value: n,
                    unit: "ratio",
                    source_id: sourceId,
                    credibility_score: credScore,
                });
            }
        }

        // Supplier status / categorical state
        const statusField = (row.Status ?? row.status ?? row.state) as string | undefined;
        if (statusField !== undefined && statusField !== "") {
            claims.push({
                claim: `${entityStr ?? "Supplier"} status is ${statusField}`,
                topic: "supplier_status",
                entity: entityStr,
                type: "categorical",
                value: String(statusField).toLowerCase(),
                source_id: sourceId,
                credibility_score: credScore,
            });
        }

        // Lead time
        const leadTimeField = (row.Avg_Lead_Time_Days ?? row.lead_time ?? row.lead_time_days) as
            | number
            | string
            | undefined;
        if (leadTimeField !== undefined && leadTimeField !== "") {
            const n = typeof leadTimeField === "number" ? leadTimeField : parseFloat(String(leadTimeField));
            if (!isNaN(n)) {
                claims.push({
                    claim: `${entityStr ?? "Supplier"} lead time is ${n} days`,
                    topic: "delivery_time",
                    entity: entityStr,
                    type: "numeric",
                    value: n,
                    unit: "days",
                    source_id: sourceId,
                    credibility_score: credScore,
                });
            }
        }

        return claims;
    }

    /**
     * Pull every row out of structured_data and feed it through the normaliser.
     * For real-time feeds, also derive an inventory_level=0 claim from any
     * "out of stock" mention so they collide with structured stock figures.
     */
    private extractStructuredClaims(
        source: NormalizedSource,
        credScore: number
    ): ExtractedClaim[] {
        if (!source.structured_data) return [];
        const claims: ExtractedClaim[] = [];

        // CSV rows
        if (Array.isArray(source.structured_data.rows)) {
            for (const row of source.structured_data.rows as Record<string, unknown>[]) {
                claims.push(...this.structuredRowToClaim(row, source.source_id, credScore));
            }
        }

        // JSON arrays (e.g. customer complaints)
        if (Array.isArray(source.structured_data.items)) {
            for (const item of source.structured_data.items as Record<string, unknown>[]) {
                // Treat each complaint as a row
                claims.push(...this.structuredRowToClaim(item, source.source_id, credScore));

                // Implicit signal: "out of stock" → inventory_level=0 claim
                const text = String(item.message ?? item.text ?? "").toLowerCase();
                if (/out of stock|stock\s*=\s*0|zero\s*units|0\s*units?|0\s*stock/.test(text)) {
                    const skuMention = (item.sku_referenced ?? item.SKU ?? item.sku) as string | undefined;
                    claims.push({
                        claim: `${skuMention ?? "Item"} reported out of stock (0 units) by customer`,
                        topic: "inventory_level",
                        entity: skuMention !== undefined ? String(skuMention) : undefined,
                        type: "numeric",
                        value: 0,
                        unit: "units",
                        source_id: source.source_id,
                        credibility_score: credScore,
                    });
                }
            }
        }

        return claims;
    }

    /**
     * Implicit contradiction detector — pairs of claims on DIFFERENT topics
     * that nevertheless cannot both be true (e.g. inventory_level=500 from
     * audit AND inventory_level=0 from customer complaints on the same SKU).
     *
     * This catches cases where M1 emitted separate {topic} buckets but the
     * underlying physical reality is in conflict.
     */
    private detectImplicitContradictions(claims: ExtractedClaim[]): Contradiction[] {
        const out: Contradiction[] = [];

        // Stock vs zero-stock customer signal on the same entity
        const inventoryClaims = claims.filter((c) => c.topic === "inventory_level");
        for (let i = 0; i < inventoryClaims.length; i++) {
            for (let j = i + 1; j < inventoryClaims.length; j++) {
                const a = inventoryClaims[i];
                const b = inventoryClaims[j];
                if (a.source_id === b.source_id) continue;
                if (a.entity && b.entity && a.entity !== b.entity) continue;

                const va = Number(a.value);
                const vb = Number(b.value);
                if (isNaN(va) || isNaN(vb)) continue;

                // 0-vs-non-zero on the same SKU is an implicit contradiction
                if ((va === 0 && vb > 0) || (vb === 0 && va > 0)) {
                    out.push(
                        this.buildContradiction("implicit" as Contradiction["type"], "CRITICAL", a, b, 0.92)
                    );
                }
            }
        }

        // Supplier "Active" vs "Delayed" on same supplier
        const statusClaims = claims.filter((c) => c.topic === "supplier_status");
        for (let i = 0; i < statusClaims.length; i++) {
            for (let j = i + 1; j < statusClaims.length; j++) {
                const a = statusClaims[i];
                const b = statusClaims[j];
                if (a.source_id === b.source_id) continue;
                if (a.entity && b.entity && a.entity !== b.entity) continue;
                const va = String(a.value).toLowerCase();
                const vb = String(b.value).toLowerCase();
                if ((va === "active" && vb === "delayed") || (vb === "active" && va === "delayed")) {
                    out.push(this.buildContradiction("implicit" as Contradiction["type"], "HIGH", a, b, 0.85));
                }
            }
        }

        return out;
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

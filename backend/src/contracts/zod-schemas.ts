/**
 * Zod structural schemas for the AMCE selective-efficiency mode.
 *
 * V2 spec: M1-M4 and M7 do NOT trigger expensive base-model AMCE validation.
 * Instead, the AMCE layer enforces fast, deterministic Zod schema checks.
 * A malformed output emits QUARANTINE or REJECT and Antigravity logs a
 * programmatic retry without burning an LLM call.
 */
import { z } from "zod";

// ===== M1: Multi-Source Ingestion =====
export const SourceRoleSchema = z.enum(["trigger", "context", "constraint"]);

export const NormalizedSourceSchema = z.object({
    source_id: z.string().min(1),
    source_type: z.string().min(1),
    raw_text: z.string(),
    serialized_text: z.string().optional(),
    structured_data: z.record(z.string(), z.unknown()).optional(),
    extraction_confidence: z.number().min(0).max(1),
    timestamp: z.string().min(1),
    word_count: z.number().int().min(0),
    role: SourceRoleSchema.optional(),
    metadata: z.record(z.string(), z.unknown()),
});

export const MultiSourceIngestionSchema = z.object({
    pipeline_id: z.string().min(1),
    ingestion_id: z.string().regex(/^ING-[A-Z0-9]{8}$/),
    timestamp: z.string().min(1),
    sources_processed: z.number().int().min(1),
    successful_count: z.number().int().min(0),
    failed_count: z.number().int().min(0),
    normalized_sources: z.array(NormalizedSourceSchema).min(1),
});

// ===== M2: Credibility Scorer =====
export const CredibilityScoreSchema = z.object({
    source_id: z.string().min(1),
    recency_score: z.number().int().min(0).max(40),
    authority_score: z.number().int().min(0).max(30),
    quality_score: z.number().int().min(0).max(30),
    total_score: z.number().int().min(0).max(100),
    credibility_tier: z.enum(["HIGH", "MEDIUM", "LOW", "UNVERIFIED"]),
    reasoning: z.string(),
});

export const CredibilityScorerOutputSchema = z.object({
    pipeline_id: z.string(),
    scores: z.array(CredibilityScoreSchema).min(1),
});

// ===== M3: Noise Filter =====
export const RemovedSourceSchema = z.object({
    source_id: z.string(),
    reason: z.enum(["duplicate", "spam", "stale", "irrelevant", "corroborating_redundant"]),
    details: z.string(),
});

export const NoiseFilterOutputSchema = z.object({
    pipeline_id: z.string(),
    filtered_sources: z.object({
        kept_sources: z.array(NormalizedSourceSchema),
        removed_sources: z.array(RemovedSourceSchema),
        corroborating_groups: z
            .array(
                z.object({
                    group_id: z.string(),
                    source_ids: z.array(z.string()).min(2),
                    similarity_band: z.literal("0.60-0.85"),
                })
            )
            .optional(),
    }),
});

// ===== M4: Contradiction Detector =====
export const ClaimSchema = z.object({
    topic: z.string().min(1),
    entity: z.string().optional(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    unit: z.string().optional(),
    source_id: z.string(),
    credibility_score: z.number().min(0),
});

export const ContradictionSchema = z.object({
    contradiction_id: z.string().regex(/^CONTRA-[A-Z0-9]{8}$/),
    type: z.enum(["numeric", "boolean", "categorical", "temporal", "implicit"]),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    conflicting_sources: z
        .array(
            z.object({
                source_id: z.string(),
                claim: z.string(),
                credibility_score: z.number(),
            })
        )
        .min(2),
    topic: z.string(),
    confidence: z.number().min(0).max(1),
    resolution_needed: z.boolean(),
    sources_involved: z.array(z.string()).min(2),
    claim_a: z.string(),
    claim_b: z.string(),
});

export const ContradictionDetectorOutputSchema = z.object({
    pipeline_id: z.string(),
    detection_id: z.string().regex(/^DET-[A-Z0-9]{8}$/),
    contradictions_found: z.number().int().min(0),
    contradictions: z.array(ContradictionSchema),
});

// ===== M7: Conflict Resolution =====
export const ConflictResolutionSchema = z.object({
    contradiction_id: z.string(),
    resolution_strategy: z.enum([
        "trust_credible",
        "trust_recent",
        "request_clarification",
        "aggregate",
        "human_review",
    ]),
    recommended_value: z.unknown(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    investigation_actions: z.array(
        z.object({
            action_type: z.string(),
            description: z.string(),
            priority: z.enum(["critical", "high", "medium"]),
        })
    ),
});

export const ConflictResolutionOutputSchema = z.object({
    pipeline_id: z.string(),
    resolutions: z.array(ConflictResolutionSchema),
    resolved_facts_topics: z.array(z.string()),
    cascading_conflicts: z.array(z.string()),
});

// ===== AMCE evaluator =====
export type AMCEMode = "ALERT_ONLY" | "QUARANTINE" | "BLOCK";

export interface AMCEResult {
    schema_name: string;
    passed: boolean;
    mode: AMCEMode;
    errors: string[];
    decision: "PASS" | "WARN" | "REJECT";
}

export function evaluateWithZod<T>(
    output: unknown,
    schema: z.ZodSchema<T>,
    schemaName: string,
    mode: AMCEMode
): AMCEResult {
    const result = schema.safeParse(output);
    if (result.success) {
        return { schema_name: schemaName, passed: true, mode, errors: [], decision: "PASS" };
    }

    const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`);

    let decision: AMCEResult["decision"];
    if (mode === "ALERT_ONLY") {
        decision = "WARN";
    } else if (mode === "QUARANTINE") {
        decision = "WARN";
    } else {
        decision = "REJECT";
    }

    return { schema_name: schemaName, passed: false, mode, errors, decision };
}

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

// ===== M5: Insight Extraction =====
export const InsightSchema = z.object({
    insight_id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    category: z.enum(["trend", "risk", "opportunity", "contradiction"]),
    severity: z.enum(["critical", "high", "medium", "low"]),
    confidence: z.number().min(0).max(1),
    supporting_sources: z.array(z.string()).min(1),
    requires_resolution: z.boolean(),
    contradiction_details: z.unknown().nullable(),
    temporal_pattern: z.string().nullable(),
    affected_entities: z.array(z.string()),
    data_points: z.array(z.string()),
});

export const InsightExtractionOutputSchema = z.object({
    pipeline_id: z.string(),
    insights: z.array(InsightSchema).min(1).max(7),
    rag_context_chunks_used: z.number().int().min(0),
});

// ===== M6: Temporal Analysis =====
export const DataPointSchema = z.object({
    timestamp: z.string().min(1),
    value: z.number(),
});

export const TemporalPatternSchema = z.object({
    metric_name: z.string().min(1),
    pattern_type: z.enum(["decline", "spike", "drift", "anomaly", "stable", "insufficient_data"]),
    time_window: z.string().min(1),
    change_magnitude: z.number(),
    change_direction: z.enum(["increasing", "decreasing", "volatile", "unknown"]),
    confidence: z.number().min(0).max(1),
    data_points: z.array(DataPointSchema),
});

export const TemporalAnalysisOutputSchema = z.object({
    pipeline_id: z.string(),
    patterns: z.array(TemporalPatternSchema),
});

// ===== M8: Impact Analysis =====
export const ImpactOptionSchema = z.object({
    option_id: z.string().min(1),
    label: z.string().min(1),
    tradeoff: z.enum(["lowest_cost", "fastest_resolution", "balanced", "lowest_risk"]),
    cost_pkr: z.number().min(0),
    time_hours: z.number().min(0),
    affected_customers: z.number().int().min(0),
    rationale: z.string().min(1),
});

export const ImpactAnalysisItemSchema = z.object({
    insight_id: z.string(),
    primary_impact: z.string().min(1),
    impact_category: z.enum(["revenue", "cost", "risk", "compliance", "reputation", "operational"]),
    impact_severity: z.enum(["critical", "high", "medium", "low"]),
    quantified_impact: z.object({
        estimated_cost: z.number().nullable(),
        estimated_time_hours: z.number().nullable(),
        affected_count: z.number().nullable(),
        cost_pkr: z.number().min(0).optional(),
        affected_customers: z.number().int().min(0).optional(),
    }),
    constraints_violated: z.array(z.string()),
    time_horizon: z.enum(["immediate", "short_term", "medium_term", "long_term"]),
    cascading_effects: z.array(z.string()),
    risk_if_ignored: z.string().min(1),
    options: z.array(ImpactOptionSchema).min(2).max(3),
});

export const ImpactAnalysisOutputSchema = z.object({
    pipeline_id: z.string(),
    impact_analyses: z.array(ImpactAnalysisItemSchema).min(1),
});

// ===== M9: Action Chain Generator =====
export const ActionNodeSchema = z.object({
    action_id: z.string().regex(/^ACT-\d{3}$/),
    action_type: z.enum([
        "diagnose",
        "notify",
        "update_system",
        "mitigate",
        "monitor",
        "verify",
        "escalate",
    ]),
    title: z.string().min(1),
    description: z.string().min(1),
    priority: z.enum(["critical", "high", "medium", "low"]),
    depends_on: z.array(z.string()),
    blocks: z.array(z.string()),
    constraints: z.object({
        max_cost: z.number().min(0),
        max_duration_hours: z.number().min(0),
        required_resources: z.array(z.string()),
        api_rate_limit: z.number().int().min(0),
    }),
    simulatable: z.boolean(),
    simulation_details: z.object({
        simulation_type: z.string().min(1),
        parameters: z.record(z.string(), z.unknown()),
        expected_success_rate: z.number().min(0).max(1),
    }),
    failure_recovery: z.object({
        retry_count: z.number().int().min(0),
        fallback_action_id: z.string().nullable(),
        rollback_required: z.boolean(),
    }),
});

export const ActionChainGeneratorOutputSchema = z.object({
    pipeline_id: z.string(),
    chain_id: z.string().min(1),
    action_count: z.number().int().min(3).max(5),
    insight_id: z.string(),
    actions: z.array(ActionNodeSchema).min(3).max(5),
    execution_order: z.array(z.string()).min(3).max(5),
    total_estimated_cost: z.number().min(0),
    total_estimated_duration_hours: z.number().min(0),
    constraint_violations: z.array(
        z.object({
            action_id: z.string(),
            constraint_type: z.string(),
            violation_details: z.string(),
        })
    ),
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

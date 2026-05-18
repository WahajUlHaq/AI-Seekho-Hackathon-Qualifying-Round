import { z } from "zod";

// Runtime AMCE judge schemas. Mirrors the OpenAPI definitions in
// backend/src/docs/openapi.ts so the regenerated frontend types and these
// validators are kept in lockstep.

export const ForecastPointSchema = z.object({
    timestamp: z.iso.datetime({ offset: true }),
    value: z.number().finite(),
    is_extrapolation: z.boolean(),
});

export const ContradictionRecordSchema = z.object({
    source_id: z.string().min(1),
    timestamp: z.iso.datetime({ offset: true }),
    raw_claim: z.string().min(1).max(240),
    baseline_context: z.string().min(1).max(240),
    conflict_rationale: z.string().min(1).max(240),
});

export const PipelineAnalyticsSchema = z.object({
    extrapolation_unreliable: z.boolean(),
    forecast_data: z
        .array(ForecastPointSchema)
        .min(30, "forecast_data needs at least 30 valid points")
        .refine((pts) => pts.some((p) => p.is_extrapolation), {
            message: "forecast_data must include at least one extrapolated (future) point",
        }),
    contradictions: z.array(ContradictionRecordSchema),
});

export type ForecastPoint = z.infer<typeof ForecastPointSchema>;
export type ContradictionRecord = z.infer<typeof ContradictionRecordSchema>;
export type PipelineAnalytics = z.infer<typeof PipelineAnalyticsSchema>;

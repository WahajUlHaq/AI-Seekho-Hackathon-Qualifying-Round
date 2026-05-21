// Shared types for the Phase 8 multi-agent analytics pool.
// Source of truth: backend/src/docs/contracts/analytics.contracts.ts (Zod).

export type {
    ForecastPoint,
    ContradictionRecord,
    PipelineAnalytics,
} from "../docs/contracts/analytics.contracts";

export interface RawSource {
    source_id?: string;
    source_type?: string;
    content?: string;
}

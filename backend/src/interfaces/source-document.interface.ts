export type SourceType = 'pdf' | 'url' | 'csv' | 'txt' | 'json' | 'realtime_feed';

export type CredibilityTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';

export interface CredibilityResult {
    recency: number;      // 0–40
    authority: number;    // 0–30
    quality: number;      // 0–30
    total: number;        // 0–100
    tier: CredibilityTier;
    reasoning: string;
}

export interface SourceDocument {
    source_id: string;
    source_type: SourceType;
    raw_url?: string;
    content: string;
    ingested_at: string;           // ISO 8601
    credibility_tier: CredibilityTier;
    credibility_score?: CredibilityResult;
    metadata: Record<string, unknown>;
}

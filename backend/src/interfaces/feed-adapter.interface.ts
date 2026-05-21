export interface FeedEvent {
    id: string;
    timestamp: string;
    source: string;
    event_type: string;
    payload: Record<string, unknown>;
}

export interface FeedAdapterConfig {
    delayMs: number;
    maxEvents?: number;
}

export interface FeedAdapter {
    stream(config: FeedAdapterConfig): AsyncGenerator<FeedEvent, void, unknown>;
    getSourceId(): string;
}

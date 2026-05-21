import * as fs from "fs";
import * as path from "path";
import { FeedAdapter, FeedAdapterConfig, FeedEvent } from "../interfaces/feed-adapter.interface";

export class MockRealtimeFeedAdapter implements FeedAdapter {
    private readonly events: FeedEvent[];
    private readonly sourceId: string;

    constructor(feedFilePath: string, sourceId = "FEED-REALTIME-01") {
        const raw = fs.readFileSync(feedFilePath, "utf-8");
        this.events = JSON.parse(raw) as FeedEvent[];
        this.sourceId = sourceId;
    }

    getSourceId(): string {
        return this.sourceId;
    }

    async *stream(config: FeedAdapterConfig): AsyncGenerator<FeedEvent, void, unknown> {
        const limit = config.maxEvents ?? this.events.length;
        let emitted = 0;

        for (const event of this.events) {
            if (emitted >= limit) break;
            yield event;
            emitted++;
            if (config.delayMs > 0) {
                await new Promise<void>(resolve => setTimeout(resolve, config.delayMs));
            }
        }
    }
}

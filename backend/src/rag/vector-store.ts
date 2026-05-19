/**
 * Ephemeral, per-pipeline-run in-memory vector store (V2 M5 prep).
 *
 * The store exists ONLY for the lifetime of a single Antigravity pipeline
 * invocation. It is instantiated inside the InsightExtractionAgent.execute,
 * filled with batched embeddings derived from PHASE-1 serialized tabular
 * chunks, queried via Multi-Query retrieval (M5), and then explicitly
 * destroyed via `destroy()` to prevent cross-run contamination.
 *
 * Antigravity is the only orchestrator — this module is a passive tool that
 * waits to be invoked, never starts background work, and exposes no
 * standalone execution pipeline.
 */

import { llmClient } from "../utils/llm-client";
import { cosineSimilarity } from "../utils/cosine-similarity";

export interface VectorChunk {
    id: string;
    embedding: number[];
    text: string;
    metadata: {
        source_id: string;
        chunk_index: number;
        source_type?: string;
        [key: string]: unknown;
    };
}

export interface RetrievalResult {
    id: string;
    text: string;
    similarity: number;
    metadata: VectorChunk["metadata"];
}

export interface VectorStoreStats {
    pipeline_id: string;
    chunk_count: number;
    embedded_at: string;
    batched_calls: number;
    destroyed: boolean;
}

export interface IngestChunkInput {
    source_id: string;
    text: string;
    source_type?: string;
    extra_metadata?: Record<string, unknown>;
}

export interface PipelineVectorStoreOptions {
    embeddingBatchSize?: number;   // how many embeddings to compute in parallel
    interBatchDelayMs?: number;    // pause between batches for rate-limit safety
}

/**
 * Ephemeral per-pipeline-run vector store. Construct → ingest → query →
 * destroy. Re-using a destroyed store throws to make leaks loud rather
 * than silently returning stale chunks.
 */
export class PipelineVectorStore {
    private readonly pipelineId: string;
    private readonly batchSize: number;
    private readonly interBatchDelayMs: number;
    private chunks: VectorChunk[] = [];
    private destroyed = false;
    private batchedCalls = 0;
    private embeddedAt: string | null = null;

    constructor(pipelineId: string, opts: PipelineVectorStoreOptions = {}) {
        this.pipelineId = pipelineId;
        this.batchSize = Math.max(1, opts.embeddingBatchSize ?? 4);
        this.interBatchDelayMs = Math.max(0, opts.interBatchDelayMs ?? 250);
    }

    /** Splits a long text into overlapping word-window chunks for embedding. */
    static chunkText(text: string, chunkSize = 220, overlap = 40): string[] {
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];
        if (words.length <= chunkSize) return [words.join(" ")];

        const out: string[] = [];
        let i = 0;
        while (i < words.length) {
            const end = Math.min(i + chunkSize, words.length);
            out.push(words.slice(i, end).join(" "));
            if (end === words.length) break;
            i += chunkSize - overlap;
        }
        return out;
    }

    /**
     * Batched embedding generation. Inputs are processed in groups of
     * `batchSize` with a short pause between batches so the free Gemini
     * embedding quota does not 429.
     */
    async ingest(inputs: IngestChunkInput[]): Promise<void> {
        this.assertAlive();
        if (inputs.length === 0) return;

        for (let i = 0; i < inputs.length; i += this.batchSize) {
            const batch = inputs.slice(i, i + this.batchSize);
            const settled = await Promise.allSettled(
                batch.map((input) => llmClient.generateEmbedding(input.text))
            );

            settled.forEach((result, j) => {
                const input = batch[j];
                if (result.status === "fulfilled") {
                    this.chunks.push({
                        id: `${input.source_id}::chunk-${this.chunks.length}`,
                        embedding: result.value,
                        text: input.text,
                        metadata: {
                            source_id: input.source_id,
                            chunk_index: this.chunks.length,
                            source_type: input.source_type,
                            ...(input.extra_metadata ?? {}),
                        },
                    });
                }
                // Silently drop failed batch members — partial-failure tolerance
                // is the right default here; Antigravity already logs llm_call
                // failures through traceCollector at a higher layer.
            });

            this.batchedCalls += 1;

            // Rate-limit safety pause between batches (skip after the last batch)
            if (i + this.batchSize < inputs.length && this.interBatchDelayMs > 0) {
                await new Promise((r) => setTimeout(r, this.interBatchDelayMs));
            }
        }

        this.embeddedAt = new Date().toISOString();
    }

    /** Top-K nearest neighbours by cosine similarity to the query embedding. */
    query(queryEmbedding: number[], k: number): RetrievalResult[] {
        this.assertAlive();
        if (this.chunks.length === 0 || queryEmbedding.length === 0) return [];

        return this.chunks
            .map((c) => ({
                id: c.id,
                text: c.text,
                similarity: cosineSimilarity(queryEmbedding, c.embedding),
                metadata: c.metadata,
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, Math.max(0, k));
    }

    /**
     * Multi-Query retrieval: run N independent embeddings, dedupe the union
     * of results by chunk id, return up to `perQuery * queryEmbeddings.length`
     * unique chunks ranked by best-similarity-across-queries.
     */
    multiQuery(queryEmbeddings: number[][], perQuery: number): RetrievalResult[] {
        this.assertAlive();
        const best = new Map<string, RetrievalResult>();

        for (const qe of queryEmbeddings) {
            const hits = this.query(qe, perQuery);
            for (const hit of hits) {
                const prev = best.get(hit.id);
                if (!prev || hit.similarity > prev.similarity) {
                    best.set(hit.id, hit);
                }
            }
        }

        return Array.from(best.values()).sort((a, b) => b.similarity - a.similarity);
    }

    size(): number {
        return this.chunks.length;
    }

    stats(): VectorStoreStats {
        return {
            pipeline_id: this.pipelineId,
            chunk_count: this.chunks.length,
            embedded_at: this.embeddedAt ?? "never",
            batched_calls: this.batchedCalls,
            destroyed: this.destroyed,
        };
    }

    /**
     * Explicit destruction. MUST be called after the pipeline completes to
     * prevent cross-run contamination. Future calls on a destroyed store
     * throw so leaks are loud.
     */
    destroy(): void {
        this.chunks = [];
        this.destroyed = true;
    }

    isDestroyed(): boolean {
        return this.destroyed;
    }

    private assertAlive(): void {
        if (this.destroyed) {
            throw new Error(
                `[PipelineVectorStore] store for pipeline ${this.pipelineId} has been destroyed — re-use is forbidden (cross-run contamination guard)`
            );
        }
    }
}

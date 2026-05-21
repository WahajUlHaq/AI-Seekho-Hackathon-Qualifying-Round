import { VectorChunk, VectorStore } from "../interfaces/vector-store.interface";

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
        dot  += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

export class InMemoryVectorStore implements VectorStore {
    private chunks: Map<string, VectorChunk> = new Map();

    async upsert(chunk: VectorChunk): Promise<void> {
        this.chunks.set(chunk.id, chunk);
    }

    async search(queryEmbedding: number[], topK: number): Promise<VectorChunk[]> {
        const scored: Array<{ chunk: VectorChunk; score: number }> = [];

        for (const chunk of this.chunks.values()) {
            const score = cosineSimilarity(queryEmbedding, chunk.embedding);
            scored.push({ chunk, score });
        }

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(s => s.chunk);
    }

    async delete(id: string): Promise<void> {
        this.chunks.delete(id);
    }

    async clear(): Promise<void> {
        this.chunks.clear();
    }

    count(): number {
        return this.chunks.size;
    }
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

export interface VectorEntry {
    id: string;
    embedding: number[];
    metadata: Record<string, any>;
}

export function topKSimilar(
    query: number[],
    candidates: VectorEntry[],
    k: number
): Array<{ id: string; similarity: number; metadata: Record<string, any> }> {
    return candidates
        .map(c => ({ id: c.id, similarity: cosineSimilarity(query, c.embedding), metadata: c.metadata }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, k);
}

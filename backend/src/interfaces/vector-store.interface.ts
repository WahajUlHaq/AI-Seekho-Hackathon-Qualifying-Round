export interface VectorChunk {
    id: string;
    source_id: string;
    text: string;
    embedding: number[];
    metadata: Record<string, unknown>;
}

export interface VectorStore {
    upsert(chunk: VectorChunk): Promise<void>;
    search(queryEmbedding: number[], topK: number): Promise<VectorChunk[]>;
    delete(id: string): Promise<void>;
    clear(): Promise<void>;
    count(): number;
}

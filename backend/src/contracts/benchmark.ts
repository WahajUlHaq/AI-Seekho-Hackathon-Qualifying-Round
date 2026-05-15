import { llmClient } from "../utils/llm-client";
import { cosineSimilarity } from "../utils/cosine-similarity";

export type BenchmarkLevel = "PASS" | "WARN" | "REJECT";

export interface BenchmarkResult {
    divergence_score: number;   // 0.0 (identical) → 1.0 (completely different)
    level: BenchmarkLevel;
    primary_output_preview: string;
    base_output_preview: string;
    assessed_at: string;
}

/**
 * Compares a module's primary-model output against the base model's output
 * for the same prompt. High divergence may indicate hallucination or drift.
 */
export class BenchmarkComparator {
    private readonly REJECT_THRESHOLD = 0.6;
    private readonly WARN_THRESHOLD = 0.3;

    async compare(
        moduleOutput: string,
        _originalInput: unknown,
        prompt: string
    ): Promise<BenchmarkResult> {
        const baseOutput = await llmClient.complete(prompt, true);

        // Embed both outputs and compute cosine similarity
        const [primaryEmb, baseEmb] = await Promise.all([
            llmClient.generateEmbedding(moduleOutput),
            llmClient.generateEmbedding(baseOutput),
        ]);

        const similarity = cosineSimilarity(primaryEmb, baseEmb);
        const divergence_score = Math.max(0, Math.min(1, 1 - similarity));

        const level: BenchmarkLevel =
            divergence_score > this.REJECT_THRESHOLD ? "REJECT" :
            divergence_score > this.WARN_THRESHOLD   ? "WARN"   : "PASS";

        return {
            divergence_score,
            level,
            primary_output_preview: moduleOutput.slice(0, 200),
            base_output_preview: baseOutput.slice(0, 200),
            assessed_at: new Date().toISOString(),
        };
    }
}

export const benchmarkComparator = new BenchmarkComparator();

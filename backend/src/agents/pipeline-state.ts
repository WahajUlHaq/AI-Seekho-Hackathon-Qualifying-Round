/**
 * Pipeline-scoped global state.
 *
 * The V2 architecture forces conflict resolution (M7) to deterministically
 * mutate `resolvedFacts` so that downstream insight extraction (M5+) reads
 * a single source of truth instead of re-deriving values from conflicting
 * raw sources.
 *
 * Antigravity invokes this state container by pipeline_id; modules never
 * read or write each other directly — they all funnel through the state.
 */

export interface ResolvedFact {
    topic: string;
    value: unknown;
    unit?: string;
    sources_involved: string[];
    resolution_strategy: string;
    confidence: number;
    resolved_at: string;
}

export interface PipelineStateSnapshot {
    pipeline_id: string;
    resolvedFacts: Record<string, ResolvedFact>;
    cascading_conflicts: string[];
    state_mutations: Array<{
        timestamp: string;
        topic: string;
        previous_value: unknown;
        new_value: unknown;
        mutated_by: string;
    }>;
}

class PipelineStateManager {
    private states: Map<string, PipelineStateSnapshot> = new Map();

    init(pipelineId: string): PipelineStateSnapshot {
        const snapshot: PipelineStateSnapshot = {
            pipeline_id: pipelineId,
            resolvedFacts: {},
            cascading_conflicts: [],
            state_mutations: [],
        };
        this.states.set(pipelineId, snapshot);
        return snapshot;
    }

    get(pipelineId: string): PipelineStateSnapshot {
        if (!this.states.has(pipelineId)) return this.init(pipelineId);
        return this.states.get(pipelineId)!;
    }

    setResolvedFact(
        pipelineId: string,
        fact: ResolvedFact,
        mutatedBy: string
    ): void {
        const state = this.get(pipelineId);
        const previous = state.resolvedFacts[fact.topic];

        state.state_mutations.push({
            timestamp: new Date().toISOString(),
            topic: fact.topic,
            previous_value: previous?.value ?? null,
            new_value: fact.value,
            mutated_by: mutatedBy,
        });

        // Detect cascading conflicts: writing a new value to an already-resolved topic
        if (previous && previous.value !== fact.value) {
            state.cascading_conflicts.push(
                `Cascading conflict on '${fact.topic}': ${String(previous.value)} → ${String(fact.value)}`
            );
        }

        state.resolvedFacts[fact.topic] = fact;
    }

    clear(pipelineId: string): void {
        this.states.delete(pipelineId);
    }
}

export const pipelineState = new PipelineStateManager();

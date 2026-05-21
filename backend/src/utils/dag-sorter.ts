import { ProposedAction, Priority } from "../agents/strategic-recommender.agent";
import { traceCollector } from "../tracing/collector";

const PRIORITY_WEIGHT: Record<Priority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
};

/**
 * Kahn's algorithm — topologically sort actions by depends_on.
 * On cycle detection, emits a graph_cycle_detected trace event (if pipelineId provided)
 * and returns the original list sorted by priority descending. Never throws.
 */
export function sortActionsTopologically(
    actions: ProposedAction[],
    pipelineId?: string
): ProposedAction[] {
    const byId = new Map<string, ProposedAction>(actions.map(a => [a.action_id, a]));
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const a of actions) {
        inDegree.set(a.action_id, 0);
        dependents.set(a.action_id, []);
    }

    for (const a of actions) {
        for (const dep of a.depends_on) {
            if (!byId.has(dep)) continue;
            inDegree.set(a.action_id, (inDegree.get(a.action_id) ?? 0) + 1);
            dependents.get(dep)!.push(a.action_id);
        }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    const result: ProposedAction[] = [];
    while (queue.length > 0) {
        const id = queue.shift()!;
        const action = byId.get(id);
        if (action) result.push(action);

        for (const dependent of dependents.get(id) ?? []) {
            const newDeg = (inDegree.get(dependent) ?? 0) - 1;
            inDegree.set(dependent, newDeg);
            if (newDeg === 0) queue.push(dependent);
        }
    }

    if (result.length !== actions.length) {
        if (pipelineId) {
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "graph_cycle_detected",
                agent: "dag-sorter",
                message: `Cycle detected in StrategyProposal DAG (${actions.length - result.length} unresolved node(s)); falling back to priority-desc flat sort`,
            });
        }
        return [...actions].sort(
            (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
        );
    }

    return result;
}

import type { components } from "@/types/openapi";

type ProposedAction = components["schemas"]["ProposedAction"];

export interface LayoutedNode {
  action: ProposedAction;
  layer: number;
}

export interface DagLayout {
  nodes: LayoutedNode[];
  layers: LayoutedNode[][];
  cycleDetected: boolean;
  edges: Array<{ from: string; to: string }>;
}

const PRIORITY_WEIGHT: Record<ProposedAction["priority"], number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// Mirrors backend/src/utils/dag-sorter.ts: Kahn's algorithm, with a priority-
// desc fallback when a cycle is detected. Layer number is the longest-path
// distance from a root (in-degree 0) node.
export function layoutDag(actions: ProposedAction[]): DagLayout {
  if (actions.length === 0) {
    return { nodes: [], layers: [], cycleDetected: false, edges: [] };
  }

  const byId = new Map<string, ProposedAction>();
  for (const action of actions) {
    byId.set(action.action_id, action);
  }

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const edges: Array<{ from: string; to: string }> = [];

  for (const action of actions) {
    inDegree.set(action.action_id, 0);
    dependents.set(action.action_id, []);
  }

  for (const action of actions) {
    for (const dep of action.depends_on) {
      if (!byId.has(dep)) continue; // dangling references mirror backend sanitizer
      inDegree.set(action.action_id, (inDegree.get(action.action_id) ?? 0) + 1);
      dependents.get(dep)!.push(action.action_id);
      edges.push({ from: dep, to: action.action_id });
    }
  }

  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
      layer.set(id, 0);
    }
  }

  const ordered: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(id);
    const currentLayer = layer.get(id) ?? 0;
    for (const dep of dependents.get(id) ?? []) {
      const remaining = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, remaining);
      // Longest-path layering: dependents move to max(current, parent+1).
      layer.set(dep, Math.max(layer.get(dep) ?? 0, currentLayer + 1));
      if (remaining === 0) queue.push(dep);
    }
  }

  const cycleDetected = ordered.length !== actions.length;

  if (cycleDetected) {
    // Backend fallback: priority-desc, then original order.
    const sorted = [...actions].sort(
      (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    );
    const nodes = sorted.map((action) => ({ action, layer: 0 }));
    return { nodes, layers: [nodes], cycleDetected: true, edges };
  }

  const nodes: LayoutedNode[] = ordered.map((id) => ({
    action: byId.get(id)!,
    layer: layer.get(id) ?? 0,
  }));

  const layerCount = nodes.reduce((m, n) => Math.max(m, n.layer), 0) + 1;
  const layers: LayoutedNode[][] = Array.from({ length: layerCount }, () => []);
  for (const node of nodes) {
    layers[node.layer].push(node);
  }

  return { nodes, layers, cycleDetected: false, edges };
}

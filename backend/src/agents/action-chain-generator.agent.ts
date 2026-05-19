/**
 * Module 9 — Action Chain Generator (V2).
 *
 * V2 guarantees:
 *   • LLM generates the chain → MATHEMATICAL TOPOLOGICAL SORT validates it.
 *   • Kahn's algorithm detects circular dependencies AND orphan references
 *     (a depends_on that names an action_id that does not exist).
 *   • If the graph fails topology, Antigravity re-prompts the LLM with the
 *     concrete error appended. Only after re-prompt failure do we fall back
 *     to a deterministic hard-coded chain.
 *   • Final output is judged by Gemini 1.5 Pro (BLOCK + BASE MODEL).
 *
 * All AI calls go through the `llmClient` singleton — never direct SDKs.
 */

import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { Insight } from "./insight-extraction.agent";
import { ImpactAnalysis } from "./impact-analysis.agent";
import {
    ActionNode,
    ActionChain,
    Constraints,
} from "../types/simulation.types";
import { antigravityFileLogger } from "../tracing/file-logger";
import { validateWithBaseModel, AMCEBlockError } from "../contracts/base-model-benchmark";

export type { ActionNode, ActionChain } from "../types/simulation.types";

export interface ActionChainGeneratorInput extends AgentInput {
    insights: Insight[];
    impact_analyses: ImpactAnalysis[];
    constraints: Constraints;
}

export interface ActionChainGeneratorOutput extends AgentOutput {
    chain_id: string;
    action_count: number;
    insight_id: string;
    actions: ActionNode[];
    execution_order: string[];
    total_estimated_cost: number;
    total_estimated_duration_hours: number;
    constraint_violations: Array<{
        action_id: string;
        constraint_type: string;
        violation_details: string;
    }>;
    topology_validation: {
        passed: boolean;
        attempts: number;
        cycles_detected: string[];
        orphan_refs: string[];
        used_fallback: boolean;
    };
    base_model_block_count: number;
    base_model_score: number;
}

const MAX_LLM_ATTEMPTS = 2;

interface TopologyValidation {
    passed: boolean;
    order: string[];
    cycles: string[];
    orphans: string[];
}

/**
 * Mathematical topological sort using Kahn's algorithm.
 * - Detects orphan references (any depends_on id not present in actions).
 * - Detects circular dependencies (any node left after the BFS exhausts).
 * - On success, returns a valid execution_order.
 */
function topologicalSort(actions: ActionNode[]): TopologyValidation {
    const ids = new Set(actions.map((a) => a.action_id));
    const orphans: string[] = [];

    for (const a of actions) {
        for (const dep of a.depends_on) {
            if (!ids.has(dep)) orphans.push(`${a.action_id} → ${dep}`);
        }
    }

    // If there are orphans, we still try to compute a partial order ignoring them
    // so we can also report cycles in the same pass.
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const a of actions) {
        inDegree.set(a.action_id, 0);
        adj.set(a.action_id, []);
    }
    for (const a of actions) {
        for (const dep of a.depends_on) {
            if (!ids.has(dep)) continue; // orphan — counted separately
            adj.get(dep)!.push(a.action_id);
            inDegree.set(a.action_id, (inDegree.get(a.action_id) ?? 0) + 1);
        }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
        if (deg === 0) queue.push(id);
    }
    queue.sort(); // stable order for reproducibility

    const order: string[] = [];
    while (queue.length) {
        const id = queue.shift()!;
        order.push(id);
        for (const next of adj.get(id) ?? []) {
            inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
            if (inDegree.get(next) === 0) queue.push(next);
        }
        queue.sort();
    }

    const cycles: string[] = [];
    if (order.length !== actions.length) {
        for (const a of actions) {
            if (!order.includes(a.action_id)) cycles.push(a.action_id);
        }
    }

    return {
        passed: orphans.length === 0 && cycles.length === 0,
        order,
        cycles,
        orphans,
    };
}

function buildFallbackChain(insightId: string, budgetLimit: number): ActionNode[] {
    const orderCost = Math.min(450000, budgetLimit);
    return [
        {
            action_id: "ACT-001",
            action_type: "verify",
            title: "Verify current stock levels",
            description: "Query warehouse database to get real-time inventory count for SKU-1234",
            priority: "critical",
            depends_on: [],
            blocks: ["ACT-002", "ACT-003"],
            constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: ["database_access"], api_rate_limit: 10 },
            simulatable: true,
            simulation_details: {
                simulation_type: "database_query",
                parameters: { query: "SELECT stock FROM inventory WHERE sku='SKU-1234'", affected_entities: ["SKU-1234", "Warehouse A"] },
                expected_success_rate: 0.95,
            },
            failure_recovery: { retry_count: 3, fallback_action_id: null, rollback_required: false },
        },
        {
            action_id: "ACT-002",
            action_type: "notify",
            title: "Notify procurement team",
            description: "Send urgent stock alert to procurement team via email and Slack",
            priority: "critical",
            depends_on: ["ACT-001"],
            blocks: ["ACT-003"],
            constraints: { max_cost: 0, max_duration_hours: 0.25, required_resources: ["email_service"], api_rate_limit: 5 },
            simulatable: true,
            simulation_details: {
                simulation_type: "send_notification",
                parameters: { recipient: "procurement@company.com", channel: "email+slack" },
                expected_success_rate: 0.9,
            },
            failure_recovery: { retry_count: 2, fallback_action_id: null, rollback_required: false },
        },
        {
            action_id: "ACT-003",
            action_type: "mitigate",
            title: "Place emergency restock order",
            description: "Submit emergency order for 500 units of SKU-1234 via supplier API",
            priority: "critical",
            depends_on: ["ACT-001", "ACT-002"],
            blocks: ["ACT-004"],
            constraints: { max_cost: orderCost, max_duration_hours: 2, required_resources: ["supplier_api", "budget_approval"], api_rate_limit: 20 },
            simulatable: true,
            simulation_details: {
                simulation_type: "place_order",
                parameters: { quantity: 500, order_cost: orderCost, supplier: "XYZ Logistics" },
                expected_success_rate: 0.85,
            },
            failure_recovery: { retry_count: 3, fallback_action_id: null, rollback_required: false },
        },
        {
            action_id: "ACT-004",
            action_type: "monitor",
            title: "Schedule 24-hour monitoring",
            description: "Configure automated alerts for stock levels and delivery status",
            priority: "high",
            depends_on: ["ACT-003"],
            blocks: [],
            constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: ["monitoring_service"], api_rate_limit: 5 },
            simulatable: true,
            simulation_details: {
                simulation_type: "schedule_monitoring",
                parameters: { interval_hours: 1, threshold_units: 100 },
                expected_success_rate: 0.98,
            },
            failure_recovery: { retry_count: 1, fallback_action_id: null, rollback_required: false },
        },
    ];
}

export class ActionChainGeneratorAgent extends BaseAgent<
    ActionChainGeneratorInput,
    ActionChainGeneratorOutput
> {
    constructor() {
        super("ActionChainGeneratorAgent", "action_chain");
    }

    protected async execute(
        input: ActionChainGeneratorInput
    ): Promise<ActionChainGeneratorOutput> {
        const { pipeline_id, insights, impact_analyses, constraints } = input;
        const startTime = Date.now();

        const priorityOrder = ["critical", "high", "medium", "low"];
        const targetInsight =
            insights.slice().sort(
                (a, b) => priorityOrder.indexOf(a.severity) - priorityOrder.indexOf(b.severity)
            )[0] ?? insights[0];

        const targetImpact =
            impact_analyses.find((ia) => ia.insight_id === targetInsight?.insight_id) ??
            impact_analyses[0];

        // ── LLM generation loop with topology re-prompt. ──
        let actions: ActionNode[] = [];
        let topology: TopologyValidation = { passed: false, order: [], cycles: [], orphans: [] };
        let lastError = "";
        let usedFallback = false;

        for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt++) {
            const prompt = this.buildPrompt(
                targetInsight,
                targetImpact,
                constraints,
                attempt > 1 ? lastError : null
            );
            try {
                const raw = await this.llmComplete(
                    pipeline_id,
                    prompt,
                    /* useBaseModel on retry */ attempt > 1,
                    attempt === 1 ? "action_chain_generation" : "action_chain_regeneration"
                );
                const parsed = this.parseLLMJSON<{ actions: ActionNode[] }>(raw);
                if (parsed?.actions && parsed.actions.length >= 3 && parsed.actions.length <= 5) {
                    const candidate = this.sanitizeActions(parsed.actions);
                    const validation = topologicalSort(candidate);

                    if (validation.passed) {
                        actions = candidate;
                        topology = validation;
                        this.logDecision(
                            pipeline_id,
                            `Attempt ${attempt}: LLM produced ${candidate.length}-action chain that passed topological sort`,
                            "chain_topology_pass",
                            0.95
                        );
                        break;
                    }

                    // Topology FAILED — record concrete error for the re-prompt.
                    lastError =
                        (validation.cycles.length
                            ? `Circular dependencies detected involving: ${validation.cycles.join(", ")}. `
                            : "") +
                        (validation.orphans.length
                            ? `Orphan depends_on references (target action_id missing): ${validation.orphans.join("; ")}. `
                            : "") +
                        "Regenerate the chain so depends_on only references action_ids present in the same chain and the dependency graph has NO cycles.";

                    antigravityFileLogger.append({
                        timestamp: new Date().toISOString(),
                        step: `M9_TopologyFail_Attempt_${attempt}`,
                        tool_called: this.agentName,
                        reasoning: `Attempt ${attempt} topological sort failed → ${lastError}`,
                        status: "ROLLED_BACK",
                        rollback_action: attempt < MAX_LLM_ATTEMPTS
                            ? "Antigravity re-prompts LLM with concrete topology errors"
                            : "Fall back to deterministic safe chain",
                        latency_ms: Date.now() - startTime,
                        cost: 0,
                        rubric_category: "failure_recovery",
                    });
                }
            } catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
                console.warn(`[ActionChainGenerator] attempt ${attempt} failed:`, lastError);
            }
        }

        // ── Deterministic fallback if every LLM attempt failed topology. ──
        if (!topology.passed) {
            actions = buildFallbackChain(
                targetInsight?.insight_id ?? "INS-001",
                constraints.budget_limit.amount
            );
            topology = topologicalSort(actions);
            usedFallback = true;
            this.logDecision(
                pipeline_id,
                `M9 used deterministic fallback chain after ${MAX_LLM_ATTEMPTS} failed LLM attempts (topology: cycles=${topology.cycles.length}, orphans=${topology.orphans.length})`,
                "fallback_chain",
                0.6
            );
        }

        // Clamp to 3-5 (contract requirement).
        if (actions.length > 5) actions = actions.slice(0, 5);
        if (actions.length < 3) {
            const extra = buildFallbackChain(targetInsight?.insight_id ?? "INS-001", constraints.budget_limit.amount);
            for (const e of extra) {
                if (actions.length >= 3) break;
                if (!actions.some((a) => a.action_id === e.action_id)) actions.push(e);
            }
            topology = topologicalSort(actions);
        }

        const execution_order = topology.order.length === actions.length
            ? topology.order
            : this.greedyOrder(actions);

        const chain_id = `CHAIN-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, 8)}`;
        const total_estimated_cost = actions.reduce((sum, a) => sum + a.constraints.max_cost, 0);
        const total_estimated_duration_hours = actions.reduce(
            (sum, a) => sum + a.constraints.max_duration_hours,
            0
        );

        const preliminary: ActionChainGeneratorOutput = {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            chain_id,
            action_count: actions.length,
            insight_id: targetInsight?.insight_id ?? "INS-001",
            actions,
            execution_order,
            total_estimated_cost,
            total_estimated_duration_hours,
            constraint_violations: [],
            topology_validation: {
                passed: topology.passed,
                attempts: usedFallback ? MAX_LLM_ATTEMPTS : 1,
                cycles_detected: topology.cycles,
                orphan_refs: topology.orphans,
                used_fallback: usedFallback,
            },
            base_model_block_count: 0,
            base_model_score: 1.0,
        };

        // ── AMCE BLOCK + BASE MODEL gate (Gemini 1.5 Pro). ──
        // SOLE AMCE gate for M9. No ZodValidator path — the Phase 2 audit
        // flagged that as an orchestration bypass.
        let amceBlockCount = 0;
        let amceScore = 1.0;

        const judgementCriteria = [
            "Dependency graph has no cycles (already verified by topological sort)",
            "Action types form a coherent operational sequence (verify → notify → mitigate → monitor is canonical)",
            "Total estimated cost is within or near the budget limit",
            "Critical-severity insight has at least one mitigate-type action",
            "No two actions are functionally redundant (same type, same effect)",
            `Action count is between 3 and 5 (actual=${actions.length})`,
            "All depends_on references resolve to action_ids inside this chain (no orphans)",
        ];

        const judgeContext = {
            chain_id,
            actions: actions.map((a) => ({
                action_id: a.action_id,
                action_type: a.action_type,
                title: a.title,
                depends_on: a.depends_on,
                priority: a.priority,
                max_cost: a.constraints.max_cost,
                max_duration_hours: a.constraints.max_duration_hours,
            })),
            execution_order,
            total_estimated_cost,
            topology_passed: topology.passed,
            used_topology_fallback: usedFallback,
        };

        const judge = await validateWithBaseModel({
            pipelineId: pipeline_id,
            moduleName: "M9_ActionChainGenerator",
            schemaName: "action_chain_v1",
            contextSummary: `Phase D action chain for insight ${targetInsight?.insight_id} (${targetInsight?.title ?? "n/a"}), severity=${targetInsight?.severity}. Chain length=${actions.length}, topology_pass=${topology.passed}.`,
            moduleOutput: judgeContext,
            judgementCriteria,
        });
        amceScore = judge.score;

        if (judge.decision === "BLOCK") {
            amceBlockCount++;
            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: "AMCE_BLOCK_M9_BaseModelFinal",
                tool_called: "BaseModelValidator",
                reasoning: `Base-model judge BLOCKed action chain (score=${judge.score.toFixed(2)}): ${judge.reasoning}. Antigravity halts Phase D — strict BLOCK enforcement per V2 AMCE contract. Issues: ${judge.issues.join("; ")}`,
                status: "FAILED",
                rollback_action: "Pipeline halts — no silent substitution. Antigravity must not propagate an un-validated chain to the saga ledger / simulator.",
                latency_ms: Date.now() - startTime,
                cost: 0,
                rubric_category: "failure_recovery",
            });
            throw new AMCEBlockError(
                "M9_ActionChainGenerator",
                "action_chain_v1",
                judge.score,
                judge.reasoning,
                judge.issues
            );
        }

        return {
            ...preliminary,
            base_model_block_count: amceBlockCount,
            base_model_score: amceScore,
        };
    }

    private buildPrompt(
        insight: Insight | undefined,
        impact: ImpactAnalysis | undefined,
        constraints: Constraints,
        priorError: string | null
    ): string {
        const errorBlock = priorError
            ? `\nPRIOR ATTEMPT WAS REJECTED BY THE TOPOLOGICAL SORT:\n${priorError}\nFix these errors precisely in your new output.\n`
            : "";

        return `You are an operations strategist. Generate a chain of 3-5 interconnected actions to address this insight.

INSIGHT:
- Title: ${insight?.title ?? "n/a"}
- Description: ${insight?.description ?? "n/a"}
- Severity: ${insight?.severity ?? "high"}
- Category: ${insight?.category ?? "risk"}
- Data points: ${(insight?.data_points ?? []).join(", ")}

IMPACT ANALYSIS:
${impact ? JSON.stringify({ primary_impact: impact.primary_impact, impact_severity: impact.impact_severity, cascading_effects: impact.cascading_effects, risk_if_ignored: impact.risk_if_ignored, options: impact.options }, null, 2) : "Not available"}

CONSTRAINTS:
- Budget limit: ${constraints.budget_limit.amount} ${constraints.budget_limit.currency}
- Time limit: ${constraints.time_limit.max_duration_hours} hours
- Urgency: ${constraints.urgency_level}
${errorBlock}
RULES:
1. EXACTLY 3-5 actions.
2. action_id MUST match the pattern ACT-001, ACT-002, ... in declaration order.
3. action_type ∈ {diagnose, notify, update_system, mitigate, monitor, verify, escalate}.
4. depends_on MUST only reference action_ids that appear in THIS chain (no orphan references).
5. The dependency graph MUST have NO cycles (it will be checked by topological sort).
6. blocks should mirror depends_on (if A depends on B then B blocks A).
7. At least 3 actions must have simulatable: true.
8. expected_success_rate ∈ [0.7, 0.99].

Respond with ONLY valid JSON, no markdown:
{
  "actions": [
    {
      "action_id": "ACT-001",
      "action_type": "verify",
      "title": "Verify current stock levels",
      "description": "Query warehouse database",
      "priority": "critical",
      "depends_on": [],
      "blocks": ["ACT-002", "ACT-003"],
      "constraints": {
        "max_cost": 0,
        "max_duration_hours": 0.5,
        "required_resources": ["database_access"],
        "api_rate_limit": 10
      },
      "simulatable": true,
      "simulation_details": {
        "simulation_type": "database_query",
        "parameters": {"query": "SELECT * FROM inventory"},
        "expected_success_rate": 0.95
      },
      "failure_recovery": {
        "retry_count": 3,
        "fallback_action_id": null,
        "rollback_required": false
      }
    }
  ]
}`;
    }

    private sanitizeActions(actions: ActionNode[]): ActionNode[] {
        const validTypes = new Set([
            "diagnose", "notify", "update_system", "mitigate", "monitor", "verify", "escalate",
        ]);

        return actions.map((a, i) => ({
            action_id: /^ACT-\d{3}$/.test(a.action_id) ? a.action_id : `ACT-${String(i + 1).padStart(3, "0")}`,
            action_type: validTypes.has(a.action_type) ? a.action_type : "verify",
            title: a.title || `Action ${i + 1}`,
            description: a.description || `Execute action ${i + 1}`,
            priority: a.priority || "medium",
            depends_on: Array.isArray(a.depends_on) ? a.depends_on : [],
            blocks: Array.isArray(a.blocks) ? a.blocks : [],
            constraints: {
                max_cost: Number(a.constraints?.max_cost ?? 0),
                max_duration_hours: Number(a.constraints?.max_duration_hours ?? 1),
                required_resources: Array.isArray(a.constraints?.required_resources) ? a.constraints.required_resources : [],
                api_rate_limit: Number(a.constraints?.api_rate_limit ?? 10),
            },
            simulatable: a.simulatable !== false,
            simulation_details: {
                simulation_type: a.simulation_details?.simulation_type || "database_query",
                parameters: a.simulation_details?.parameters || {},
                expected_success_rate: Number(a.simulation_details?.expected_success_rate ?? 0.9),
            },
            failure_recovery: {
                retry_count: Number(a.failure_recovery?.retry_count ?? 2),
                fallback_action_id: a.failure_recovery?.fallback_action_id ?? null,
                rollback_required: Boolean(a.failure_recovery?.rollback_required ?? false),
            },
        }));
    }

    private greedyOrder(actions: ActionNode[]): string[] {
        // Best-effort linearization when topology fails — preserves declared order
        // so a downstream simulator can still attempt execution.
        return actions.map((a) => a.action_id);
    }

    private parseLLMJSON<T>(raw: string): T | null {
        const attempts: (string | null)[] = [
            raw,
            (() => { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return m ? m[1] : null; })(),
            (() => { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); return s !== -1 && e > s ? raw.slice(s, e + 1) : null; })(),
        ];
        for (const a of attempts) {
            if (!a) continue;
            try { return JSON.parse(a) as T; } catch { continue; }
        }
        return null;
    }
}

export const actionChainGeneratorAgent = new ActionChainGeneratorAgent();

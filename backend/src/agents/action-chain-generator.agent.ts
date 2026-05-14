import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { Insight } from "./insight-extraction.agent";
import { ImpactAnalysis } from "./impact-analysis.agent";
import {
    ActionNode,
    ActionChain,
    Constraints,
} from "../types/simulation.types";

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
}

// Hardcoded 4-action fallback for the inventory shortage demo scenario
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

        // Pick the highest-severity insight to generate the chain for
        const priorityOrder = ["critical", "high", "medium", "low"];
        const targetInsight =
            insights.sort(
                (a, b) => priorityOrder.indexOf(a.severity) - priorityOrder.indexOf(b.severity)
            )[0] ?? insights[0];

        const targetImpact =
            impact_analyses.find((ia) => ia.insight_id === targetInsight?.insight_id) ??
            impact_analyses[0];

        let actions: ActionNode[] = [];
        let llmSucceeded = false;

        if (targetInsight) {
            const prompt = this.buildPrompt(targetInsight, targetImpact, constraints);
            try {
                const raw = await this.llmComplete(pipeline_id, prompt, false, "action_chain_generation");
                const parsed = this.parseLLMJSON<{ actions: ActionNode[]; execution_order?: string[] }>(raw);
                if (parsed?.actions && parsed.actions.length >= 3 && parsed.actions.length <= 5) {
                    actions = this.sanitizeActions(parsed.actions);
                    llmSucceeded = true;
                    this.logDecision(
                        pipeline_id,
                        `LLM generated ${actions.length}-action chain for insight: ${targetInsight.title}`,
                        "chain_generated",
                        0.9
                    );
                }
            } catch (err) {
                console.warn("[ActionChainGenerator] LLM generation failed:", err);
            }
        }

        if (!llmSucceeded) {
            actions = buildFallbackChain(
                targetInsight?.insight_id ?? "INS-001",
                constraints.budget_limit.amount
            );
            this.logDecision(
                pipeline_id,
                `Using hardcoded fallback chain (LLM parse failed or no insights)`,
                "fallback_chain",
                0.7
            );
        }

        // Clamp to 3–5 actions (contract requirement)
        if (actions.length > 5) actions = actions.slice(0, 5);
        if (actions.length < 3) {
            const extra = buildFallbackChain(targetInsight?.insight_id ?? "INS-001", constraints.budget_limit.amount);
            while (actions.length < 3) {
                const next = extra.find(e => !actions.some(a => a.action_id === e.action_id));
                if (!next) break;
                actions.push(next);
            }
        }

        const execution_order = this.buildExecutionOrder(actions);
        const chain_id = `CHAIN-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, 8)}`;
        const total_estimated_cost = actions.reduce((sum, a) => sum + a.constraints.max_cost, 0);
        const total_estimated_duration_hours = actions.reduce((sum, a) => sum + a.constraints.max_duration_hours, 0);

        return {
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
        };
    }

    private buildPrompt(
        insight: Insight,
        impact: ImpactAnalysis | undefined,
        constraints: Constraints
    ): string {
        return `You are an operations strategist. Generate a chain of 3-5 interconnected actions to address this insight.

INSIGHT:
- Title: ${insight.title}
- Description: ${insight.description}
- Severity: ${insight.severity}
- Category: ${insight.category}
- Data points: ${insight.data_points.join(", ")}

IMPACT ANALYSIS:
${impact ? JSON.stringify({ primary_impact: impact.primary_impact, impact_severity: impact.impact_severity, cascading_effects: impact.cascading_effects, risk_if_ignored: impact.risk_if_ignored }, null, 2) : "Not available"}

CONSTRAINTS:
- Budget limit: ${constraints.budget_limit.amount} ${constraints.budget_limit.currency}
- Time limit: ${constraints.time_limit.max_duration_hours} hours
- Urgency: ${constraints.urgency_level}

RULES:
1. Generate EXACTLY 3-5 actions (no more, no less)
2. Action types allowed: diagnose, notify, update_system, mitigate, monitor, verify, escalate
3. Actions form a logical dependency chain (verify first, then notify, then mitigate, then monitor)
4. Each action must respect the constraints
5. At least 3 actions must be simulatable: true
6. Set expected_success_rate between 0.7 and 0.99

Respond with ONLY valid JSON, no markdown:
{
  "actions": [
    {
      "action_id": "ACT-001",
      "action_type": "verify",
      "title": "Verify current stock levels",
      "description": "Query warehouse database to get real-time inventory count",
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
        "parameters": {"query": "SELECT * FROM inventory WHERE sku='SKU-1234'"},
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
            action_id: a.action_id || `ACT-${String(i + 1).padStart(3, "0")}`,
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

    private buildExecutionOrder(actions: ActionNode[]): string[] {
        // Topological sort based on depends_on
        const visited = new Set<string>();
        const order: string[] = [];

        const visit = (actionId: string, ancestors: Set<string> = new Set()) => {
            if (visited.has(actionId)) return;
            if (ancestors.has(actionId)) return; // skip circular deps

            const action = actions.find((a) => a.action_id === actionId);
            if (!action) return;

            const newAncestors = new Set([...ancestors, actionId]);
            for (const dep of action.depends_on) {
                visit(dep, newAncestors);
            }

            visited.add(actionId);
            order.push(actionId);
        };

        for (const action of actions) {
            visit(action.action_id);
        }

        return order;
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

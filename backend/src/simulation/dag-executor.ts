/**
 * Module 11 — Level-Parallel DAG Executor (V2).
 *
 * Antigravity invokes this executor as a passive tool. It does NOT
 * orchestrate by itself — it consumes an `ActionChain` (already topology-
 * validated by M9) plus a `forcedFailures` config and produces a list of
 * `ActionExecutionResult`s for downstream M12/M13.
 *
 * Strict V2 invariants enforced here:
 *   • Actions are grouped into LEVELS by dependency depth. Level N runs
 *     ONLY AFTER level N-1 has fully settled. Within a level every action
 *     is launched concurrently via `Promise.allSettled`.
 *   • State mutations (StateMachine.apply) happen STRICTLY BETWEEN levels,
 *     never during execution of a level — this mathematically eliminates
 *     intra-level races on shared state.
 *   • `forcedFailures` deterministically injects failures for named
 *     action_ids so M12 selective rollback can be exercised reproducibly.
 *
 * NEVER imports an AI SDK — execution is pure deterministic simulation.
 */

import { v4 as uuidv4 } from "uuid";
import {
    ActionChain,
    ActionNode,
    ActionExecutionResult,
    SimulationState,
} from "../types/simulation.types";
import { StateMachine, StateDelta, StateInvariantError } from "./state-machine";
import { SagaConstraintLedger } from "./saga-ledger";
import { traceCollector } from "../tracing/collector";
import { antigravityFileLogger } from "../tracing/file-logger";

export interface ForcedFailureSpec {
    action_id: string;
    reason: string;
}

export interface ForcedFailuresConfig {
    /** Deterministic single-shot failures, keyed by action_id. */
    fail: ForcedFailureSpec[];
}

export interface DAGExecutorInput {
    pipeline_id: string;
    chain: ActionChain;
    initialState: SimulationState;
    ledger: SagaConstraintLedger;
    forcedFailures?: ForcedFailuresConfig;
    /** If false, NO stochastic failure injection — only forced failures fire. */
    simulateRandomFailures?: boolean;
}

export interface DAGLevel {
    level: number;
    action_ids: string[];
}

export interface DAGExecutorOutput {
    pipeline_id: string;
    results: ActionExecutionResult[];
    levels: DAGLevel[];
    state_history: SimulationState[];
    final_state: SimulationState;
}

const RANDOM_FAILURE_REASONS: Record<string, string[]> = {
    verify: ["Database connection timeout", "Query returned empty result", "Access denied"],
    notify: ["SMTP server error", "Recipient unreachable", "Rate limit exceeded"],
    update_system: ["API endpoint unreachable", "Invalid data format", "Write permission denied"],
    mitigate: ["Resource allocation failed", "Budget limit exceeded", "Dependency service down"],
    diagnose: ["Service unavailable", "Timeout waiting for response"],
    monitor: ["Monitoring service offline", "Alert threshold config error"],
    escalate: ["Escalation channel unavailable", "On-call not responding"],
};

export class DAGExecutor {
    /**
     * Group actions into topological execution levels. An action's level
     * is `max(level of its deps) + 1`; nodes with no deps are level 0.
     * Returns ordered levels.
     */
    static computeLevels(chain: ActionChain): DAGLevel[] {
        const byId = new Map<string, ActionNode>(chain.actions.map((a) => [a.action_id, a]));
        const levelOf = new Map<string, number>();

        // Iteratively compute levels (the chain is small; pure-fn O(n²) is fine).
        let progress = true;
        while (progress) {
            progress = false;
            for (const action of chain.actions) {
                if (levelOf.has(action.action_id)) continue;
                const depLevels: number[] = [];
                let ready = true;
                for (const dep of action.depends_on) {
                    if (!byId.has(dep)) continue;          // orphan — ignore (M9 should have caught it)
                    if (!levelOf.has(dep)) { ready = false; break; }
                    depLevels.push(levelOf.get(dep)!);
                }
                if (ready) {
                    const level = depLevels.length ? Math.max(...depLevels) + 1 : 0;
                    levelOf.set(action.action_id, level);
                    progress = true;
                }
            }
        }

        // Fallback: any unresolved (cycles) get assigned to the next available level.
        let maxLevel = -1;
        for (const lv of levelOf.values()) maxLevel = Math.max(maxLevel, lv);
        for (const a of chain.actions) {
            if (!levelOf.has(a.action_id)) levelOf.set(a.action_id, maxLevel + 1);
        }

        const grouped = new Map<number, string[]>();
        for (const [id, lv] of levelOf.entries()) {
            if (!grouped.has(lv)) grouped.set(lv, []);
            grouped.get(lv)!.push(id);
        }
        return Array.from(grouped.keys())
            .sort((a, b) => a - b)
            .map((lv) => ({ level: lv, action_ids: grouped.get(lv)!.slice().sort() }));
    }

    async execute(input: DAGExecutorInput): Promise<DAGExecutorOutput> {
        const { pipeline_id, chain, initialState, ledger } = input;
        const forced = new Map<string, string>(
            (input.forcedFailures?.fail ?? []).map((f) => [f.action_id, f.reason])
        );
        const simulateRandom = input.simulateRandomFailures ?? false;

        const levels = DAGExecutor.computeLevels(chain);
        const sm = new StateMachine(initialState);
        const stateHistory: SimulationState[] = [sm.snapshot()];
        const results: ActionExecutionResult[] = [];
        const idToResult = new Map<string, ActionExecutionResult>();

        for (const lvl of levels) {
            // ── Phase 1 of level: run every action in this level concurrently. ──
            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: `M11_Level_${lvl.level}_Start`,
                tool_called: "DAGExecutor",
                reasoning: `Antigravity launching level ${lvl.level} (${lvl.action_ids.length} actions in parallel via Promise.allSettled): ${lvl.action_ids.join(", ")}`,
                status: "SUCCESS",
                rollback_action: "none",
                latency_ms: 0,
                cost: 0,
                rubric_category: "task_execution",
                data_lineage: {
                    from: "M11_DAGExecutor",
                    to: `Level_${lvl.level}`,
                    data_type: "LevelLaunch",
                    key_change: `actions=${lvl.action_ids.length}, concurrency=Promise.allSettled`,
                },
            });

            const stateAtLevelStart = sm.snapshot();
            const levelStart = Date.now();

            const settled = await Promise.allSettled(
                lvl.action_ids.map(async (id) => {
                    const action = chain.actions.find((a) => a.action_id === id);
                    if (!action) {
                        return this.skippedResult(id, stateAtLevelStart, "Action not present in chain");
                    }
                    // Block this action if any of its dependencies failed.
                    const failedDep = action.depends_on.find((dep) => {
                        const r = idToResult.get(dep);
                        return r && r.status !== "success";
                    });
                    if (failedDep) {
                        return this.skippedResult(
                            id,
                            stateAtLevelStart,
                            `Dependency ${failedDep} did not succeed`
                        );
                    }
                    return this.executeSingle(
                        action,
                        stateAtLevelStart,
                        forced.get(action.action_id) ?? null,
                        simulateRandom
                    );
                })
            );

            // Materialize per-action results from the settled batch (rejections
            // become synthetic failures so the simulator never throws on a level).
            const levelResults: ActionExecutionResult[] = settled.map((s, i) => {
                const id = lvl.action_ids[i];
                if (s.status === "fulfilled") return s.value;
                const reason = s.reason instanceof Error ? s.reason.message : String(s.reason);
                return this.syntheticFailure(id, stateAtLevelStart, reason);
            });
            for (const r of levelResults) {
                results.push(r);
                idToResult.set(r.action_id, r);
            }

            // Trace each action's outcome BEFORE mutating shared state.
            for (const r of levelResults) {
                traceCollector.log(pipeline_id, {
                    pipeline_id,
                    event_type: "action_execute",
                    agent: "DAGExecutor",
                    message: `Action ${r.action_id} (level ${lvl.level}): ${r.status}`,
                    decision: r.status,
                    latency_ms: r.duration_ms,
                    data: {
                        cost: r.cost,
                        failure_reason: r.failure_reason,
                        level: lvl.level,
                        forced_failure: forced.has(r.action_id),
                    },
                });
            }

            // ── Phase 2 of level: stage state mutations strictly BETWEEN levels. ──
            // We collect deltas from every successful action in this level and
            // apply them to the state machine sequentially. Any invariant breach
            // demotes that single action to "failed" (state isn't mutated).
            for (const r of levelResults) {
                if (r.status !== "success") continue;
                const action = chain.actions.find((a) => a.action_id === r.action_id);
                if (!action) continue;
                const delta = this.deriveDelta(action, r);
                const dry = sm.dryRun(delta);
                if (!dry.ok) {
                    // Invariant breach → roll the action's success back into a failure.
                    r.status = "failed";
                    r.failure_reason = dry.error?.message ?? "state_invariant_breach";
                    r.execution_log.push(`StateInvariantError: ${r.failure_reason}`);
                    traceCollector.log(pipeline_id, {
                        pipeline_id,
                        event_type: "failure",
                        agent: "DAGExecutor",
                        message: `Action ${r.action_id} rolled back — state invariant breach: ${r.failure_reason}`,
                        decision: "INVARIANT_BREACH",
                        data: { variable: dry.error?.variable, attempted: dry.error?.attempted_value, level: lvl.level },
                    });
                    continue;
                }
                const transition = sm.apply(delta);
                stateHistory.push(sm.snapshot());

                // Commit the ledger reservation now that the action succeeded.
                const reservedRow = ledger.findReservedRow(action.action_id);
                if (reservedRow) {
                    ledger.commit(reservedRow);
                    antigravityFileLogger.append({
                        timestamp: new Date().toISOString(),
                        step: `M11_LedgerCommit_${action.action_id}`,
                        tool_called: "SagaConstraintLedger",
                        reasoning: `Action ${action.action_id} succeeded — committing reserved PKR ${reservedRow.amount_pkr}`,
                        status: "SUCCESS",
                        rollback_action: "none",
                        latency_ms: 0,
                        cost: reservedRow.amount_pkr,
                        rubric_category: "task_execution",
                        data_lineage: {
                            from: "M11_DAGExecutor",
                            to: "SagaConstraintLedger",
                            data_type: "LedgerCommit",
                            key_change: `committed +PKR ${reservedRow.amount_pkr} (row ${reservedRow.row_id})`,
                        },
                    });
                }

                // Push a StateTransition lineage entry for the auditor.
                antigravityFileLogger.append({
                    timestamp: new Date().toISOString(),
                    step: `M11_StateTransition_${transition.action_id}`,
                    tool_called: "StateMachine",
                    reasoning: `State mutated between levels after ${transition.action_id}: ${transition.delta_summary}`,
                    status: "SUCCESS",
                    rollback_action: "none",
                    latency_ms: 0,
                    cost: 0,
                    rubric_category: "task_execution",
                    data_lineage: {
                        from: `M11_Action_${transition.action_id}`,
                        to: "PipelineState.simulationState",
                        data_type: "StateTransition",
                        key_change: transition.delta_summary,
                    },
                });
            }

            // Patch each action's after_state to the LATEST committed state so
            // downstream M12/M13 see the canonical post-level snapshot.
            const after = sm.snapshot();
            for (const r of levelResults) {
                if (r.status === "success") r.after_state = after;
            }

            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: `M11_Level_${lvl.level}_Complete`,
                tool_called: "DAGExecutor",
                reasoning: `Level ${lvl.level} settled — ${levelResults.filter((r) => r.status === "success").length}/${levelResults.length} actions succeeded; state mutations applied between levels`,
                status: "SUCCESS",
                rollback_action: "none",
                latency_ms: Date.now() - levelStart,
                cost: 0,
                rubric_category: "task_execution",
                data_lineage: {
                    from: `Level_${lvl.level}`,
                    to: lvl.level + 1 < levels.length ? `Level_${lvl.level + 1}` : "M12_FailureRecoveryEngine",
                    data_type: "LevelSettlement",
                    key_change: `${levelResults.filter((r) => r.status === "success").length}/${levelResults.length} success`,
                },
            });
        }

        return {
            pipeline_id,
            results,
            levels,
            state_history: stateHistory,
            final_state: sm.snapshot(),
        };
    }

    private async executeSingle(
        action: ActionNode,
        beforeState: SimulationState,
        forcedReason: string | null,
        simulateRandom: boolean
    ): Promise<ActionExecutionResult> {
        const start = Date.now();
        const log: string[] = [];
        log.push(`Starting: ${action.title}`);

        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 30) + 5));

        // ── Deterministic forced failure (V2) ──
        if (forcedReason) {
            log.push(`FORCED_FAILURE: ${forcedReason}`);
            return {
                action_id: action.action_id,
                status: "failed",
                before_state: beforeState,
                after_state: beforeState,
                execution_log: log,
                cost: 0,
                duration_ms: Date.now() - start,
                failure_reason: `forced:${forcedReason}`,
            };
        }

        // ── Optional stochastic failure injection ──
        const stochastic =
            simulateRandom &&
            action.simulatable &&
            Math.random() > action.simulation_details.expected_success_rate;
        if (stochastic) {
            const reasons = RANDOM_FAILURE_REASONS[action.action_type] ?? ["Unknown error"];
            const reason = reasons[Math.floor(Math.random() * reasons.length)];
            log.push(`FAILURE: ${reason}`);
            return {
                action_id: action.action_id,
                status: "failed",
                before_state: beforeState,
                after_state: beforeState,
                execution_log: log,
                cost: 0,
                duration_ms: Date.now() - start,
                failure_reason: reason,
            };
        }

        log.push(`Executing ${action.simulation_details.simulation_type}…`);
        log.push(`Completed successfully (cost=PKR ${action.constraints.max_cost})`);

        return {
            action_id: action.action_id,
            status: "success",
            before_state: beforeState,
            after_state: {
                state_id: `STATE-${uuidv4().slice(0, 8).toUpperCase()}`,
                timestamp: new Date().toISOString(),
                variables: { ...beforeState.variables },
            },
            execution_log: log,
            cost: action.constraints.max_cost,
            duration_ms: Date.now() - start,
            failure_reason: null,
        };
    }

    private deriveDelta(action: ActionNode, _result: ActionExecutionResult): StateDelta {
        const params = action.simulation_details.parameters as Record<string, unknown>;
        const set: Record<string, unknown> = {};
        const decrement: Record<string, number> = {};
        const increment: Record<string, number> = {};

        switch (action.simulation_details.simulation_type) {
            case "database_query":
                set["stock_verified"] = true;
                if (params["expected_stock"] !== undefined) {
                    set["stock_level"] = Number(params["expected_stock"]);
                } else if (typeof params["query"] === "string") {
                    // Demo scenario: the canonical query returns 47 units.
                    set["stock_level"] = 47;
                }
                break;
            case "send_notification":
                set["notification_sent"] = true;
                set["notification_recipient"] = String(params["recipient"] ?? "procurement@company.com");
                set["notification_timestamp"] = new Date().toISOString();
                break;
            case "place_order": {
                const qty = Number(params["quantity"] ?? 500);
                const cost = Number(params["order_cost"] ?? action.constraints.max_cost);
                set["order_placed"] = true;
                set["order_id"] = `ORDER-${action.action_id}-${Math.floor(Math.random() * 9000) + 1000}`;
                set["order_quantity"] = qty;
                increment["stock_level"] = qty;
                decrement["budget_remaining"] = cost;
                break;
            }
            case "schedule_monitoring":
                set["monitoring_active"] = true;
                set["monitoring_interval_hours"] = Number(params["interval_hours"] ?? 1);
                break;
            case "update_dashboard":
                set["dashboard_updated"] = true;
                set["customers_notified"] = Number(params["customer_count"] ?? 200);
                break;
            default:
                set[`${action.action_id}_completed`] = true;
        }

        return { action_id: action.action_id, set, increment, decrement };
    }

    private skippedResult(
        actionId: string,
        state: SimulationState,
        reason: string
    ): ActionExecutionResult {
        return {
            action_id: actionId,
            status: "skipped",
            before_state: state,
            after_state: state,
            execution_log: [`Skipped: ${reason}`],
            cost: 0,
            duration_ms: 0,
            failure_reason: reason,
        };
    }

    private syntheticFailure(
        actionId: string,
        state: SimulationState,
        reason: string
    ): ActionExecutionResult {
        return {
            action_id: actionId,
            status: "failed",
            before_state: state,
            after_state: state,
            execution_log: [`Promise.allSettled rejection: ${reason}`],
            cost: 0,
            duration_ms: 0,
            failure_reason: reason,
        };
    }
}

export const dagExecutor = new DAGExecutor();

// Export StateInvariantError for callers that want to discriminate
// invariant-breach failures from regular failures.
export { StateInvariantError };

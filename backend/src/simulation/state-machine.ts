/**
 * V2 State Machine (M11 prep).
 *
 * Holds the canonical `SimulationState` for a pipeline run. Mutations
 * happen via `apply(delta)`, which:
 *   1. Computes the next-variables map
 *   2. Asserts the V2 invariants (no negative stock, no negative budget)
 *   3. Mints a fresh state_id and timestamps the transition
 *   4. Records the transition in `history` for downstream tracing.
 *
 * The DAG executor (M11) MUST call `apply()` strictly BETWEEN dependency
 * levels — never during a level — to mathematically eliminate races.
 */

import { v4 as uuidv4 } from "uuid";
import { SimulationState } from "../types/simulation.types";

export interface StateDelta {
    action_id: string;
    set: Record<string, unknown>;            // direct assignments
    increment?: Record<string, number>;      // numeric +=
    decrement?: Record<string, number>;      // numeric -=
}

export interface StateTransition {
    transition_id: string;
    action_id: string;
    timestamp: string;
    before_state_id: string;
    after_state_id: string;
    changed_keys: string[];
    delta_summary: string;
}

export class StateInvariantError extends Error {
    readonly variable: string;
    readonly attempted_value: unknown;
    readonly action_id: string;
    constructor(actionId: string, variable: string, attemptedValue: unknown, message: string) {
        super(`StateInvariantError on ${actionId}: ${message} (${variable}=${String(attemptedValue)})`);
        this.name = "StateInvariantError";
        this.variable = variable;
        this.attempted_value = attemptedValue;
        this.action_id = actionId;
    }
}

/**
 * Variables that must never go negative. The DAG executor never bypasses
 * these — every `apply()` runs them.
 */
const NON_NEGATIVE_INVARIANTS = new Set<string>([
    "stock_level",
    "stock_remaining",
    "budget_remaining",
    "units_available",
    "inventory_count",
]);

export class StateMachine {
    private state: SimulationState;
    private history: StateTransition[] = [];

    constructor(initialState: SimulationState) {
        this.state = {
            ...initialState,
            variables: { ...initialState.variables },
        };
    }

    snapshot(): SimulationState {
        return {
            state_id: this.state.state_id,
            timestamp: this.state.timestamp,
            variables: { ...this.state.variables },
        };
    }

    transitions(): StateTransition[] {
        return this.history.slice();
    }

    /**
     * Apply a delta to the state. Throws StateInvariantError on
     * invariant breach without mutating the state.
     */
    apply(delta: StateDelta): StateTransition {
        const before = this.snapshot();
        const next: Record<string, unknown> = { ...before.variables };

        // Direct assignments
        for (const [k, v] of Object.entries(delta.set ?? {})) {
            next[k] = v;
        }
        // Increment numerics
        for (const [k, amt] of Object.entries(delta.increment ?? {})) {
            const cur = Number(next[k] ?? 0);
            next[k] = cur + Number(amt);
        }
        // Decrement numerics
        for (const [k, amt] of Object.entries(delta.decrement ?? {})) {
            const cur = Number(next[k] ?? 0);
            next[k] = cur - Number(amt);
        }

        // Run invariant checks BEFORE committing.
        this.assertInvariants(delta.action_id, next);

        const afterStateId = `STATE-${uuidv4().slice(0, 8).toUpperCase()}`;
        const timestamp = new Date().toISOString();
        const changedKeys: string[] = [];
        for (const k of new Set([...Object.keys(before.variables), ...Object.keys(next)])) {
            if (JSON.stringify(before.variables[k]) !== JSON.stringify(next[k])) {
                changedKeys.push(k);
            }
        }

        this.state = { state_id: afterStateId, timestamp, variables: next };
        const transition: StateTransition = {
            transition_id: `TRANS-${uuidv4().slice(0, 8).toUpperCase()}`,
            action_id: delta.action_id,
            timestamp,
            before_state_id: before.state_id,
            after_state_id: afterStateId,
            changed_keys: changedKeys,
            delta_summary: changedKeys
                .map((k) => `${k}=${this.previewValue(before.variables[k])}→${this.previewValue(next[k])}`)
                .join("; ") || "no-op",
        };
        this.history.push(transition);
        return transition;
    }

    /**
     * Apply a delta non-destructively (used by the DAG executor to test
     * whether a level's results would violate invariants before staging
     * the real mutation).
     */
    dryRun(delta: StateDelta): { ok: boolean; error?: StateInvariantError; preview: Record<string, unknown> } {
        const next: Record<string, unknown> = { ...this.state.variables };
        for (const [k, v] of Object.entries(delta.set ?? {})) next[k] = v;
        for (const [k, amt] of Object.entries(delta.increment ?? {})) {
            next[k] = Number(next[k] ?? 0) + Number(amt);
        }
        for (const [k, amt] of Object.entries(delta.decrement ?? {})) {
            next[k] = Number(next[k] ?? 0) - Number(amt);
        }
        try {
            this.assertInvariants(delta.action_id, next);
            return { ok: true, preview: next };
        } catch (err) {
            if (err instanceof StateInvariantError) return { ok: false, error: err, preview: next };
            throw err;
        }
    }

    private assertInvariants(actionId: string, next: Record<string, unknown>): void {
        for (const key of Object.keys(next)) {
            if (!NON_NEGATIVE_INVARIANTS.has(key)) continue;
            const raw = next[key];
            if (raw === null || raw === undefined) continue;
            const num = Number(raw);
            if (!isFinite(num)) {
                throw new StateInvariantError(
                    actionId,
                    key,
                    raw,
                    `'${key}' must be a finite number`
                );
            }
            if (num < 0) {
                throw new StateInvariantError(
                    actionId,
                    key,
                    raw,
                    `'${key}' invariant breached — value cannot be negative`
                );
            }
        }
    }

    private previewValue(v: unknown): string {
        if (v === null || v === undefined) return "∅";
        const s = String(v);
        return s.length > 40 ? s.slice(0, 37) + "…" : s;
    }
}

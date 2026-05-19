/**
 * Saga Constraint Ledger (V2 — shared between M10 and M12).
 *
 * Implements the classic Saga pattern reserve → commit / refund lifecycle
 * for financial constraints. The ledger is synchronous and in-memory; it
 * lives for the duration of one pipeline run and is keyed by `pipeline_id`.
 *
 * Strict V2 invariants enforced here (NOT downstream):
 *   • A row can only be `commit`ed from the `reserved` state.
 *   • A row can only be `refund`ed from the `reserved` state — never from
 *     `committed`. Once committed, money is spent.
 *   • Available budget can never go negative. A `reserve()` that would
 *     overdraft throws `SagaBudgetExceeded`.
 *   • All mutations push an immutable audit row to `history` for tracing.
 *
 * Antigravity is the only orchestrator — this module is a passive tool
 * that waits to be invoked.
 */

export type SagaRowStatus = "reserved" | "committed" | "refunded";

export interface SagaLedgerRow {
    row_id: string;
    pipeline_id: string;
    action_id: string;
    amount_pkr: number;
    status: SagaRowStatus;
    reserved_at: string;
    committed_at: string | null;
    refunded_at: string | null;
    purpose: string;
}

export interface SagaLedgerHistoryEntry {
    timestamp: string;
    action_id: string;
    row_id: string;
    from_status: SagaRowStatus | "none";
    to_status: SagaRowStatus;
    delta_pkr: number;            // signed: positive = reserved/committed, negative = refunded
    available_after: number;
    note: string;
}

export interface SagaLedgerSnapshot {
    pipeline_id: string;
    budget_limit_pkr: number;
    available_pkr: number;
    reserved_pkr: number;
    committed_pkr: number;
    refunded_pkr: number;
    rows: SagaLedgerRow[];
    history: SagaLedgerHistoryEntry[];
}

export class SagaBudgetExceeded extends Error {
    readonly required: number;
    readonly available: number;
    constructor(actionId: string, required: number, available: number) {
        super(
            `SagaBudgetExceeded: action ${actionId} requires PKR ${required}, only PKR ${available} available`
        );
        this.name = "SagaBudgetExceeded";
        this.required = required;
        this.available = available;
    }
}

export class SagaLedgerStateError extends Error {
    readonly action_id: string;
    readonly current_status: SagaRowStatus | "missing";
    readonly attempted_op: "commit" | "refund";
    constructor(actionId: string, currentStatus: SagaRowStatus | "missing", op: "commit" | "refund") {
        super(
            `SagaLedgerStateError: cannot ${op} action ${actionId} from status '${currentStatus}' — only 'reserved' rows are eligible`
        );
        this.name = "SagaLedgerStateError";
        this.action_id = actionId;
        this.current_status = currentStatus;
        this.attempted_op = op;
    }
}

export class SagaConstraintLedger {
    readonly pipeline_id: string;
    readonly budget_limit_pkr: number;
    private rows: Map<string, SagaLedgerRow> = new Map();
    private history: SagaLedgerHistoryEntry[] = [];
    private nextRowId = 0;

    constructor(pipelineId: string, budgetLimitPkr: number) {
        if (!isFinite(budgetLimitPkr) || budgetLimitPkr < 0) {
            throw new Error(
                `SagaConstraintLedger requires a non-negative finite budget_limit_pkr; got ${budgetLimitPkr}`
            );
        }
        this.pipeline_id = pipelineId;
        this.budget_limit_pkr = budgetLimitPkr;
    }

    /**
     * Reserve `amount` PKR against the budget for `actionId`. Throws
     * `SagaBudgetExceeded` if the reservation would overdraft.
     */
    reserve(actionId: string, amount: number, purpose = "action_reserve"): SagaLedgerRow {
        const amt = Math.max(0, Number(amount) || 0);
        const available = this.available();
        if (amt > available) {
            throw new SagaBudgetExceeded(actionId, amt, available);
        }
        const row: SagaLedgerRow = {
            row_id: this.nextId(),
            pipeline_id: this.pipeline_id,
            action_id: actionId,
            amount_pkr: amt,
            status: "reserved",
            reserved_at: new Date().toISOString(),
            committed_at: null,
            refunded_at: null,
            purpose,
        };
        this.rows.set(row.row_id, row);
        this.history.push({
            timestamp: row.reserved_at,
            action_id: actionId,
            row_id: row.row_id,
            from_status: "none",
            to_status: "reserved",
            delta_pkr: amt,
            available_after: this.available(),
            note: purpose,
        });
        return row;
    }

    /**
     * Commit a previously-reserved row. Only valid from `reserved`.
     * Throws `SagaLedgerStateError` otherwise.
     */
    commit(rowOrActionId: string | SagaLedgerRow): SagaLedgerRow {
        const row = this.lookup(rowOrActionId);
        if (!row) {
            throw new SagaLedgerStateError(this.idOf(rowOrActionId), "missing", "commit");
        }
        if (row.status !== "reserved") {
            throw new SagaLedgerStateError(row.action_id, row.status, "commit");
        }
        row.status = "committed";
        row.committed_at = new Date().toISOString();
        this.history.push({
            timestamp: row.committed_at,
            action_id: row.action_id,
            row_id: row.row_id,
            from_status: "reserved",
            to_status: "committed",
            delta_pkr: 0,
            available_after: this.available(),
            note: "commit",
        });
        return row;
    }

    /**
     * Refund a previously-reserved row. STRICTLY only valid from
     * `reserved` — never from `committed` (committed funds are spent and
     * cannot be unspent). Throws `SagaLedgerStateError` otherwise.
     *
     * M12 (Failure Recovery Engine) MUST call refund() FIRST upon any
     * action failure to release escrowed funds before attempting retry
     * or fallback strategies.
     */
    refund(rowOrActionId: string | SagaLedgerRow, note = "failure_refund"): SagaLedgerRow {
        const row = this.lookup(rowOrActionId);
        if (!row) {
            throw new SagaLedgerStateError(this.idOf(rowOrActionId), "missing", "refund");
        }
        if (row.status !== "reserved") {
            throw new SagaLedgerStateError(row.action_id, row.status, "refund");
        }
        row.status = "refunded";
        row.refunded_at = new Date().toISOString();
        this.history.push({
            timestamp: row.refunded_at,
            action_id: row.action_id,
            row_id: row.row_id,
            from_status: "reserved",
            to_status: "refunded",
            delta_pkr: -row.amount_pkr,
            available_after: this.available(),
            note,
        });
        return row;
    }

    available(): number {
        let outstanding = 0;
        for (const row of this.rows.values()) {
            if (row.status === "reserved" || row.status === "committed") {
                outstanding += row.amount_pkr;
            }
        }
        return Math.max(0, this.budget_limit_pkr - outstanding);
    }

    reservedTotal(): number {
        let total = 0;
        for (const row of this.rows.values()) {
            if (row.status === "reserved") total += row.amount_pkr;
        }
        return total;
    }

    committedTotal(): number {
        let total = 0;
        for (const row of this.rows.values()) {
            if (row.status === "committed") total += row.amount_pkr;
        }
        return total;
    }

    refundedTotal(): number {
        let total = 0;
        for (const row of this.rows.values()) {
            if (row.status === "refunded") total += row.amount_pkr;
        }
        return total;
    }

    findReservedRow(actionId: string): SagaLedgerRow | null {
        for (const row of this.rows.values()) {
            if (row.action_id === actionId && row.status === "reserved") return row;
        }
        return null;
    }

    snapshot(): SagaLedgerSnapshot {
        return {
            pipeline_id: this.pipeline_id,
            budget_limit_pkr: this.budget_limit_pkr,
            available_pkr: this.available(),
            reserved_pkr: this.reservedTotal(),
            committed_pkr: this.committedTotal(),
            refunded_pkr: this.refundedTotal(),
            rows: Array.from(this.rows.values()).map((r) => ({ ...r })),
            history: this.history.slice(),
        };
    }

    private lookup(input: string | SagaLedgerRow): SagaLedgerRow | undefined {
        if (typeof input !== "string") return this.rows.get(input.row_id);
        // Try row_id first, then resolve by action_id (newest reserved row wins).
        const direct = this.rows.get(input);
        if (direct) return direct;
        let candidate: SagaLedgerRow | undefined;
        for (const row of this.rows.values()) {
            if (row.action_id === input) {
                if (!candidate || row.reserved_at > candidate.reserved_at) candidate = row;
            }
        }
        return candidate;
    }

    private idOf(input: string | SagaLedgerRow): string {
        return typeof input === "string" ? input : input.action_id;
    }

    private nextId(): string {
        this.nextRowId += 1;
        return `LEDGER-${this.pipeline_id.slice(0, 6)}-${String(this.nextRowId).padStart(4, "0")}`;
    }
}

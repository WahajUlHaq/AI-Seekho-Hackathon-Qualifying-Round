/**
 * Immutable, on-device audit ledger. When a pipeline reaches terminal SUCCESS,
 * the hook fetches /api/execution/:id/audit and commits the receipt here.
 * Survives backend in-memory drops — proof-of-execution stays with the device.
 *
 * Storage shape: a single JSON-encoded array under one secure-store key. The
 * "immutable" property is enforced at the API surface: commitReceipt always
 * appends, never overwrites, and there is no public update or remove method.
 */

import * as SecureStore from "expo-secure-store";
import type { LedgerReceipt, WorkflowAuditOutput } from "@/types/execution";

const LEDGER_KEY = "pipeline.audit_ledger.v1";

const STORE_OPTS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function readAll(): Promise<LedgerReceipt[]> {
    const raw = await SecureStore.getItemAsync(LEDGER_KEY, STORE_OPTS);
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as LedgerReceipt[]) : [];
    } catch {
        return [];
    }
}

async function writeAll(receipts: LedgerReceipt[]): Promise<void> {
    await SecureStore.setItemAsync(LEDGER_KEY, JSON.stringify(receipts), STORE_OPTS);
}

export async function listReceipts(): Promise<LedgerReceipt[]> {
    return readAll();
}

export async function hasReceipt(pipelineId: string): Promise<boolean> {
    const all = await readAll();
    return all.some((r) => r.pipeline_id === pipelineId);
}

export async function getReceipt(pipelineId: string): Promise<LedgerReceipt | null> {
    const all = await readAll();
    return all.find((r) => r.pipeline_id === pipelineId) ?? null;
}

export async function commitReceipt(audit: WorkflowAuditOutput): Promise<LedgerReceipt> {
    const all = await readAll();
    const existing = all.find((r) => r.pipeline_id === audit.pipelineId);
    if (existing) return existing;

    const receipt: LedgerReceipt = {
        pipeline_id: audit.pipelineId,
        audit_id: audit.audit_id,
        verification_hash: audit.verification_hash.toLowerCase(),
        finalized_status: audit.finalized_status,
        approver: audit.signature_block.approver,
        backend_signed_at: audit.signature_block.signed_at,
        captured_at: new Date().toISOString(),
    };
    await writeAll([...all, receipt]);
    return receipt;
}

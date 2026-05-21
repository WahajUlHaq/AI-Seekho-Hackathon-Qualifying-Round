/**
 * Resolves the operator handle. Twelve-Factor precedence:
 *   1. EXPO_PUBLIC_OPERATOR_HANDLE (immutable for the build)
 *   2. expo-secure-store entry written by the provisioning screen
 *   3. null (caller must route to provisioning)
 */

import * as SecureStore from "expo-secure-store";
import { ENV_OPERATOR_HANDLE } from "@/config/api";

const STORE_KEY = "pipeline.operator_handle";
const STORE_OPTS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const HANDLE_RE = /^[a-zA-Z0-9._\-]{2,64}$/;

export function isValidHandle(handle: string): boolean {
    return HANDLE_RE.test(handle.trim());
}

export async function resolveOperatorHandle(): Promise<string | null> {
    if (ENV_OPERATOR_HANDLE) return ENV_OPERATOR_HANDLE;
    try {
        const stored = await SecureStore.getItemAsync(STORE_KEY, STORE_OPTS);
        return stored && stored.trim() ? stored.trim() : null;
    } catch {
        return null;
    }
}

export async function setOperatorHandle(handle: string): Promise<void> {
    const clean = handle.trim();
    if (!isValidHandle(clean)) {
        throw new Error("Operator handle must be 2-64 chars: letters, digits, '.', '_', '-'.");
    }
    await SecureStore.setItemAsync(STORE_KEY, clean, STORE_OPTS);
}

export async function clearOperatorHandle(): Promise<void> {
    await SecureStore.deleteItemAsync(STORE_KEY, STORE_OPTS);
}

/** True when the env value is the binding source — UI may disable the override. */
export const isOperatorHandleFromEnv = (): boolean => ENV_OPERATOR_HANDLE.length > 0;

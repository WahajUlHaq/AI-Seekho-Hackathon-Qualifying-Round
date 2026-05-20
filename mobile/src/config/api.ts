/**
 * Runtime configuration — all values resolved from EXPO_PUBLIC_* env vars at
 * bundle time. Twelve-Factor: zero hardcoded operator identity, zero hardcoded
 * server URL. Any missing value either falls back to a documented default or
 * triggers the OperatorProvisioningScreen path at boot.
 */

const trim = (s: string | undefined): string => (s ?? "").trim();

export const API_BASE_URL: string =
    trim(process.env.EXPO_PUBLIC_API_BASE_URL) || "http://10.0.2.2:8000";

/**
 * Empty string means "no env-provided operator". IdentityService will then
 * read from secure-store, and if that is also empty, App.tsx routes to the
 * provisioning screen so the user can register a handle.
 */
export const ENV_OPERATOR_HANDLE: string = trim(process.env.EXPO_PUBLIC_OPERATOR_HANDLE);

export const REQUEST_TIMEOUT_MS = 15_000;

export const SSE_BACKOFF_MS: readonly number[] = [1_000, 2_000, 4_000, 8_000, 16_000];
export const SSE_MAX_ATTEMPTS = SSE_BACKOFF_MS.length;

export const POLL_TRACE_MS = 3_000;
export const POLL_PHASE_MS = 2_000;
export const POLL_PENDING_MS = 2_000;

export const endpoint = {
    pipelineRun: (): string => `${API_BASE_URL}/api/pipeline/run`,
    pipelineTrace: (id: string): string => `${API_BASE_URL}/api/pipeline/${id}`,
    pipelineStream: (id: string): string => `${API_BASE_URL}/api/pipeline/${id}/stream`,
    pending: (id: string): string => `${API_BASE_URL}/api/execution/${id}/pending`,
    approve: (id: string): string => `${API_BASE_URL}/api/execution/${id}/approve`,
    reject: (id: string): string => `${API_BASE_URL}/api/execution/${id}/reject`,
    chain: (id: string): string => `${API_BASE_URL}/api/execution/${id}/chain`,
    recovery: (id: string): string => `${API_BASE_URL}/api/execution/${id}/recovery`,
    outcome: (id: string): string => `${API_BASE_URL}/api/execution/${id}/outcome`,
    audit: (id: string): string => `${API_BASE_URL}/api/execution/${id}/audit`,
} as const;

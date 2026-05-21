/**
 * Normalized error surface for every fetch in the app. Ports the discrimination
 * pattern from frontend/src/lib/axios.ts so the UI can switch cleanly on the
 * conflict / not-found / network / generic API axes.
 */

export type NormalizedError =
    | { kind: "network"; message: string }
    | { kind: "timeout"; message: string }
    | { kind: "not_found"; message: string; status: 404 }
    | { kind: "conflict"; message: string; status: 409; body: unknown }
    | { kind: "api"; message: string; status: number; body: unknown };

export const isConflict = (e: NormalizedError): e is Extract<NormalizedError, { kind: "conflict" }> =>
    e.kind === "conflict";
export const isNotFound = (e: NormalizedError): e is Extract<NormalizedError, { kind: "not_found" }> =>
    e.kind === "not_found";
export const isNetwork = (e: NormalizedError): e is Extract<NormalizedError, { kind: "network" | "timeout" }> =>
    e.kind === "network" || e.kind === "timeout";

export function normalizeHttpError(status: number, body: unknown): NormalizedError {
    const message = extractMessage(body) ?? `HTTP ${status}`;
    if (status === 404) return { kind: "not_found", message, status: 404 };
    if (status === 409) return { kind: "conflict", message, status: 409, body };
    return { kind: "api", message, status, body };
}

export function normalizeThrown(err: unknown): NormalizedError {
    if (err && typeof err === "object" && (err as { name?: string }).name === "AbortError") {
        return { kind: "timeout", message: "Request timed out." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "network", message };
}

function extractMessage(body: unknown): string | undefined {
    if (body && typeof body === "object" && "error" in body) {
        const e = (body as { error?: unknown }).error;
        if (typeof e === "string") return e;
    }
    return undefined;
}

export class NormalizedHttpError extends Error {
    readonly normalized: NormalizedError;
    constructor(normalized: NormalizedError) {
        super(normalized.message);
        this.name = "NormalizedHttpError";
        this.normalized = normalized;
    }
}

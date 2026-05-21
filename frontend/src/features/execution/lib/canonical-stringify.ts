// Client-side port of backend/src/agents/workflow-audit.agent.ts
// canonicalStringify(). Recursively sorts object keys so the
// resulting JSON is byte-identical to what the backend hashed.

export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k])
  );
  return "{" + parts.join(",") + "}";
}

/**
 * Reconstruct the canonical payload the backend hashes (see
 * workflow-audit.agent.ts L108-117) and compute the SHA-256 over it via
 * Web Crypto. Returns the lowercase 64-char hex digest.
 */
export async function computeAuditHash(audit: {
  pipelineId: string;
  audit_id: string;
  generated_at: string;
  finalized_status: string;
  signature_block: unknown;
  event_summary: unknown;
}): Promise<string> {
  const payload = {
    pipelineId: audit.pipelineId,
    audit_id: audit.audit_id,
    generated_at: audit.generated_at,
    finalized_status: audit.finalized_status,
    signature_block: audit.signature_block,
    event_summary: audit.event_summary,
  };
  const canonical = canonicalStringify(payload);
  const buf = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

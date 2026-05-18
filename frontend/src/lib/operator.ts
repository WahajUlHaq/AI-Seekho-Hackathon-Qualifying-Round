// Minimal operator-handle helper backed by localStorage. There is no real auth
// in this prototype; the HITL approve/reject routes require a non-empty
// approver/rejector signature, so we persist whatever the user typed last and
// fall back to a generic default.

const STORAGE_KEY = "operator_handle";
const DEFAULT_HANDLE = "operator";

export function getOperatorHandle(): string {
  if (typeof window === "undefined") return DEFAULT_HANDLE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const trimmed = raw?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_HANDLE;
  } catch {
    return DEFAULT_HANDLE;
  }
}

export function setOperatorHandle(handle: string): void {
  if (typeof window === "undefined") return;
  const trimmed = handle.trim();
  try {
    if (trimmed.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    }
  } catch {
    // localStorage may be disabled; tolerate silently.
  }
}

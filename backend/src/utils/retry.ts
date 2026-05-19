export interface BackoffOptions {
    maxAttempts?: number;
    baseMs?: number;
    multiplier?: number;
    jitter?: number; // fraction of the delay (0.2 = +/-20%)
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export class RetryableError extends Error {
    public readonly cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "RetryableError";
        this.cause = cause;
    }
}

/**
 * Run `fn` with exponential backoff. `fn` receives the 1-based attempt number.
 * Any thrown error (including RetryableError) triggers a retry until maxAttempts
 * is reached, then the last error is re-thrown.
 */
export async function retryWithBackoff<T>(
    fn: (attempt: number) => Promise<T>,
    options: BackoffOptions = {}
): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseMs = options.baseMs ?? 500;
    const multiplier = options.multiplier ?? 2;
    const jitter = options.jitter ?? 0.2;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;
            if (attempt === maxAttempts) break;
            const raw = baseMs * Math.pow(multiplier, attempt - 1);
            const jitterAmount = raw * jitter * (Math.random() * 2 - 1);
            const delayMs = Math.max(0, Math.round(raw + jitterAmount));
            options.onRetry?.(attempt, err, delayMs);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    if (lastError instanceof Error) throw lastError;
    if (typeof lastError === "string") throw new Error(lastError);
    throw new Error("retryWithBackoff exhausted without a specific error");
}

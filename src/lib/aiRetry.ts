/**
 * Resilientný AI Retry Engine pre ForenzDetectiv & Sherlock.
 * Poskytuje exponenciálny backoff pri rate-limitoch (HTTP 429) a vyťažení servera (HTTP 503).
 */

export class AiRetryError extends Error {
  attempts: number;
  originalError: any;

  constructor(message: string, attempts: number, originalError: any) {
    super(message);
    this.name = 'AiRetryError';
    this.attempts = attempts;
    this.originalError = originalError;
  }
}

export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const status = error.status || error.statusCode || error?.response?.status;
  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return true;
  }

  const msg = String(error.message || error).toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('network error')
  );
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  onRetry?: (info: { attempt: number; maxRetries: number; delayMs: number; error: any }) => void;
}

export async function withAiRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 6000,
    backoffFactor = 2,
    onRetry
  } = options;

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      if (attempt > maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const baseDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      const jitter = Math.random() * 200;
      const delay = Math.min(baseDelay + jitter, maxDelayMs);

      if (typeof onRetry === 'function') {
        onRetry({
          attempt,
          maxRetries,
          delayMs: Math.round(delay),
          error
        });
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new AiRetryError(
    `AI operácia zlyhala po ${maxRetries} pokusoch: ${lastError?.message || 'Neznáma chyba'}`,
    maxRetries,
    lastError
  );
}

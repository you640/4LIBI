/**
 * Resilientný AI Retry Engine pre ForenzDetectiv & Sherlock.
 * Poskytuje exponenciálny backoff pri rate-limitoch (HTTP 429) a vyťažení servera (HTTP 503).
 */

export class AiRetryError extends Error {
  attempts: number;
  originalError: unknown;

  constructor(message: string, attempts: number, originalError: unknown) {
    super(message);
    this.name = 'AiRetryError';
    this.attempts = attempts;
    this.originalError = originalError;
  }
}

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  let status: number | undefined;
  if (typeof error === 'object') {
    if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
      status = (error as { status: number }).status;
    } else if ('statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number') {
      status = (error as { statusCode: number }).statusCode;
    } else if (
      'response' in error &&
      typeof (error as { response?: { status?: unknown } }).response === 'object' &&
      typeof (error as { response?: { status?: unknown } }).response?.status === 'number'
    ) {
      status = (error as { response?: { status?: number } }).response?.status;
    }
  }

  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return true;
  }

  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
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
  onRetry?: (info: { attempt: number; maxRetries: number; delayMs: number; error: unknown }) => void;
}

export async function withAiRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 6000,
    backoffFactor = 2,
    onRetry
  } = options;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
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

  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError || 'Neznáma chyba');
  throw new AiRetryError(
    `AI operácia zlyhala po ${maxRetries} pokusoch: ${errorMsg}`,
    maxRetries,
    lastError
  );
}

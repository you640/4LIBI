import { describe, it, expect, vi } from "vitest";
import { isRetryableError, withAiRetry } from "../../src/lib/aiRetry";

describe("aiRetry", () => {
  it("detects retryable errors", () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ statusCode: 503 })).toBe(true);
    expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
  });

  it("retries then succeeds", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce("ok");

    const result = await withAiRetry(op, {
      maxRetries: 2,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });
    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("throws non-retryable immediately", async () => {
    await expect(
      withAiRetry(async () => {
        throw new Error("fatal");
      }, { maxRetries: 3, initialDelayMs: 1 })
    ).rejects.toThrow("fatal");
  });
});

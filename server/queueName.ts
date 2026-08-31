import { createHash } from "node:crypto";
import { hostname } from "node:os";

const QUEUE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

export function resolveAnalysisQueueName(
  configuredName = process.env.ANALYSIS_QUEUE_NAME,
  runtimeIdentity = `${hostname()}\0${process.cwd()}`
): string {
  const explicitName = configuredName?.trim();
  if (explicitName) {
    if (!QUEUE_NAME_PATTERN.test(explicitName)) {
      throw new Error(
        "ANALYSIS_QUEUE_NAME môže obsahovať iba písmená, čísla, pomlčky a podčiarkovníky."
      );
    }
    return explicitName;
  }

  const namespace = createHash("sha256")
    .update(runtimeIdentity)
    .digest("hex")
    .slice(0, 12);
  return `analysis-${namespace}`;
}

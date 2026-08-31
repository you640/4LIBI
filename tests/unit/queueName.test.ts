import { describe, expect, it } from "vitest";
import { resolveAnalysisQueueName } from "../../server/queueName";

describe("resolveAnalysisQueueName", () => {
  it("isolates queues belonging to different filesystems", () => {
    const local = resolveAnalysisQueueName(undefined, "windows-host\0C:\\app");
    const cloud = resolveAnalysisQueueName(undefined, "railway-host\0/app");

    expect(local).toMatch(/^analysis-[a-f0-9]{12}$/);
    expect(cloud).toMatch(/^analysis-[a-f0-9]{12}$/);
    expect(local).not.toBe(cloud);
  });

  it("uses a valid explicit queue name", () => {
    expect(resolveAnalysisQueueName("analysis_production", "ignored")).toBe(
      "analysis_production"
    );
  });

  it("rejects invalid BullMQ queue names", () => {
    expect(() => resolveAnalysisQueueName("analysis:production", "ignored")).toThrow(
      /ANALYSIS_QUEUE_NAME/
    );
  });
});

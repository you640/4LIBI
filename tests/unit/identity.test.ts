import { describe, expect, it, vi } from "vitest";
import { ensureUserIdentity } from "../../server/identity";

describe("ensureUserIdentity", () => {
  it("upserts the authenticated owner before owner-scoped writes", async () => {
    const upsert = vi.fn(async () => ({}));

    await ensureUserIdentity(
      { user: { upsert } },
      "dev_local_user",
      "dev@example.test"
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { id: "dev_local_user" },
      update: {},
      create: { id: "dev_local_user", email: "dev@example.test" },
    });
  });
});

import { describe, it, expect } from "vitest";
import { createOAuthState, verifyOAuthState } from "../../server/routes/connections";

describe("OAuth State CSRF Protection", () => {
  it("vytvorí a úspešne overí platný podpísaný state", () => {
    const ownerId = "user_test_123";
    const state = createOAuthState(ownerId, "linear");

    expect(state).toContain(".");
    const verified = verifyOAuthState(state, "linear");
    expect(verified).not.toBeNull();
    expect(verified?.ownerId).toBe(ownerId);
  });

  it("odmietne state určený pre iného poskytovateľa", () => {
    const ownerId = "user_test_123";
    const state = createOAuthState(ownerId, "linear");

    const verified = verifyOAuthState(state, "github");
    expect(verified).toBeNull();
  });

  it("odmietne podvrhnutý alebo modifikovaný state", () => {
    const ownerId = "user_test_123";
    const state = createOAuthState(ownerId, "linear");
    const [, sig] = state.split(".");

    // Pozmenený payload s pôvodným podpisom
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ownerId: "hacker_user", provider: "linear", ts: Date.now() })
    ).toString("base64url");

    expect(verifyOAuthState(`${tamperedPayload}.${sig}`, "linear")).toBeNull();
  });

  it("odmietne prázdny alebo neplatný reťazec", () => {
    expect(verifyOAuthState("", "linear")).toBeNull();
    expect(verifyOAuthState("invalid_state_without_dot", "linear")).toBeNull();
  });
});

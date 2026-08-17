import { describe, it, expect, beforeEach, vi } from "vitest";
import { getHitlStatus, setHitlStatus, getAllHitlForAnalysis } from "../src/lib/hitlStorage";
import { logAction, getAuditLog, clearAuditLog } from "../src/lib/auditLog";

describe("HITL Decision Storage & Audit Trail", () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    localStorageMock.clear();
  });

  it("vráti predvolený stav 'open' pre novú udalosť", () => {
    const status = getHitlStatus("case_123", "event_999");
    expect(status).toBe("open");
  });

  it("správne uloží a prečíta potvrdený stav 'confirmed'", () => {
    setHitlStatus("case_123", "event_999", "confirmed");
    const status = getHitlStatus("case_123", "event_999");
    expect(status).toBe("confirmed");
  });

  it("správne uloží a prečíta zamietnutý stav 'dismissed'", () => {
    setHitlStatus("case_123", "event_999", "dismissed");
    const status = getHitlStatus("case_123", "event_999");
    expect(status).toBe("dismissed");
  });

  it("vráti mapu stavov pre zoznam id udalostí", () => {
    setHitlStatus("case_123", "e1", "confirmed");
    setHitlStatus("case_123", "e2", "dismissed");

    const map = getAllHitlForAnalysis("case_123", ["e1", "e2", "e3"]);
    expect(map).toEqual({
      e1: "confirmed",
      e2: "dismissed",
      e3: "open",
    });
  });

  it("správne zaznamená akciu do audit logu", () => {
    clearAuditLog();
    logAction("test_action", { note: "test detail" });

    const logs = getAuditLog();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe("test_action");
    expect(logs[0].details?.note).toBe("test detail");
  });

  it("automaticky sanitizuje a redaktuje citlivé kľúče (password, token, apikey) v audit logu", () => {
    clearAuditLog();
    logAction("security_event", {
      password: "secretPassword123",
      apiKey: "sk-mistral-xyz",
      normalField: "public-info",
    });

    const logs = getAuditLog();
    expect(logs[0].details?.password).toBe("[REDACTED]");
    expect(logs[0].details?.apiKey).toBe("[REDACTED]");
    expect(logs[0].details?.normalField).toBe("public-info");
  });

  it("usporiada audit logy zostupne podľa času", () => {
    clearAuditLog();
    logAction("action_1");
    logAction("action_2");

    const logs = getAuditLog();
    expect(logs.length).toBe(2);
    expect(logs[0].action).toBe("action_2");
    expect(logs[1].action).toBe("action_1");
  });
});

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type { ReactNode } from "react";
import {
  CaseContext,
  useCaseContext,
  useOptionalCaseContext,
} from "../../src/lib/caseContext";
import { minimalAnalysisFixture } from "../fixtures/analysis";

describe("caseContext", () => {
  it("throws outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCaseContext())).toThrow(
      /must be used within CaseLayout/
    );
    spy.mockRestore();
  });

  it("returns value inside provider", () => {
    const value = {
      analysisId: "a1",
      analysis: minimalAnalysisFixture,
      search: "",
      setSearch: () => {},
      searchOpen: false,
      setSearchOpen: () => {},
      openContradictionCount: 1,
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CaseContext.Provider value={value}>{children}</CaseContext.Provider>
    );
    const required = renderHook(() => useCaseContext(), { wrapper });
    expect(required.result.current.analysisId).toBe("a1");
    const optional = renderHook(() => useOptionalCaseContext(), { wrapper });
    expect(optional.result.current?.analysisId).toBe("a1");
  });

  it("optional context is null outside provider", () => {
    const { result } = renderHook(() => useOptionalCaseContext());
    expect(result.current).toBeNull();
  });
});

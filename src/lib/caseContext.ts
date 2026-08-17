import { createContext, useContext } from "react";
import type { Analysis } from "../types";

export type CaseContextValue = {
  analysisId: string;
  analysis: Analysis;
  search: string;
  setSearch: (q: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  openContradictionCount: number;
};

export const CaseContext = createContext<CaseContextValue | null>(null);

export function useCaseContext(): CaseContextValue {
  const ctx = useContext(CaseContext);
  if (!ctx) {
    throw new Error("useCaseContext must be used within CaseLayout");
  }
  return ctx;
}

export function useOptionalCaseContext(): CaseContextValue | null {
  return useContext(CaseContext);
}

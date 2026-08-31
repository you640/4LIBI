import type { TravelFeasibilityResult } from "../types";
import { auditAlibiCheck } from "./auditLog";
import { apiFetch } from "./apiFetch";
import {
  evaluateGeospatialLocal,
  type GeospatialCheckInput,
} from "./alibiGeospatial";

export async function checkGeospatialFeasibility(
  input: GeospatialCheckInput,
  caseId?: string
): Promise<TravelFeasibilityResult | null> {
  if (typeof fetch === "function") {
    try {
      const res = await apiFetch("/api/geospatial/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locA: input.locA,
          timeA: input.timeA,
          locB: input.locB,
          timeB: input.timeB,
          personName: input.personName,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          success?: boolean;
          result?: TravelFeasibilityResult;
        };
        if (data.result) {
          auditAlibiCheck({
            caseId,
            result: data.result.isFeasible ? "feasible" : "impossible",
            locA: input.locA,
            locB: input.locB,
          });
          return data.result;
        }
      }
    } catch {
      /* offline — fall through to local engine */
    }
  }

  const local = evaluateGeospatialLocal(input);
  if (local) {
    auditAlibiCheck({
      caseId,
      result: local.isFeasible ? "feasible" : "impossible",
      locA: input.locA,
      locB: input.locB,
    });
  }
  return local;
}

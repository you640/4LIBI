import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { getAnalysis } from "../lib/api";
import type { Analysis } from "../types";
import { DEMO_CASE_ID, getDemoAnalysis, isDemoCaseId } from "../lib/demoCase";
import { CaseHeader } from "../components/m3/CaseHeader";
import { AppBar } from "../components/m3/AppBar";
import { SearchBar } from "../components/m3/SearchBar";
import { CaseContext } from "../lib/caseContext";
import {
  contradictionEvents,
  rememberLastCaseId,
} from "../lib/caseUtils";
import { getAllHitlForAnalysis } from "../lib/hitlStorage";

const TITLES: Record<string, string> = {
  rozpory: "Rozpory",
  timeline: "Časová os",
  graf: "Graf",
  osoby: "Osoby",
  audit: "Audit",
};

export type CaseOutletContext = { bumpHitl: () => void };

export function CaseLayout() {
  const { id = "" } = useParams();

  if (isDemoCaseId(id)) {
    rememberLastCaseId(DEMO_CASE_ID);
    return <LoadedCase analysisId={DEMO_CASE_ID} analysis={getDemoAnalysis()} />;
  }

  return <RemoteCase id={id} />;
}

function RemoteCase({ id }: { id: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    rememberLastCaseId(id);
    let cancelled = false;
    setLoading(true);
    setError(null);

    getAnalysis(id)
      .then((record) => {
        if (cancelled) return;
        if (record.status === "error") {
          setError(record.errorMessage || "Analýza zlyhala.");
          setAnalysis(null);
          return;
        }
        if (record.status !== "ready" || !record.data) {
          setError("Táto analýza ešte nie je pripravená.");
          setAnalysis(null);
          return;
        }
        setError(null);
        setAnalysis(record.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Spis sa nepodarilo otvoriť.");
          setAnalysis(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-5">
        <div className="w-10 h-10 border-2 border-outline-variant border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm text-outline">Otváram spis…</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="px-4 pt-4">
        <div className="m3-card-outlined text-center py-10">
          <p className="text-sm font-medium text-surface-on mb-1">Spis sa nepodarilo otvoriť</p>
          <p className="text-xs text-outline">{error}</p>
        </div>
      </div>
    );
  }

  return <LoadedCase analysisId={id} analysis={analysis} />;
}

function LoadedCase({
  analysisId,
  analysis,
}: {
  analysisId: string;
  analysis: Analysis;
}) {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hitlTick, setHitlTick] = useState(0);

  useEffect(() => {
    rememberLastCaseId(analysisId);
  }, [analysisId]);

  const pathTab = location.pathname.split("/").pop() || "rozpory";
  const tabKey = ["rozpory", "timeline", "graf", "osoby", "audit"].includes(pathTab)
    ? pathTab
    : "rozpory";

  const openContradictionCount = useMemo(() => {
    void hitlTick;
    const events = contradictionEvents(analysis);
    const statuses = getAllHitlForAnalysis(
      analysisId,
      events.map((e) => e.id)
    );
    return events.filter((e) => (statuses[e.id] || "open") === "open").length;
  }, [analysis, analysisId, hitlTick]);

  return (
    <CaseContext.Provider
      value={{
        analysisId,
        analysis,
        search,
        setSearch,
        searchOpen,
        setSearchOpen,
        openContradictionCount,
      }}
    >
      <div className="flex flex-col min-h-0 flex-1">
        <CaseHeader analysis={analysis} analysisId={analysisId} />
        <AppBar
          title={TITLES[tabKey] || "Spis"}
          searchOpen={searchOpen}
          onToggleSearch={
            tabKey === "rozpory" || tabKey === "timeline"
              ? () => setSearchOpen((v) => !v)
              : undefined
          }
        />
        <SearchBar
          open={searchOpen && (tabKey === "rozpory" || tabKey === "timeline")}
          value={search}
          onChange={setSearch}
          placeholder="Hľadať v spise…"
        />
        <div className="app-content px-4 pt-2">
          <Outlet context={{ bumpHitl: () => setHitlTick((n) => n + 1) }} />
        </div>
      </div>
    </CaseContext.Provider>
  );
}

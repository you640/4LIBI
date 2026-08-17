import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SherlockAnalyzer } from "../components/sherlock/SherlockAnalyzer";
import { SherlockResults } from "../components/sherlock/SherlockResults";
import { DEMO_ANALYSIS, type Analysis } from "../types";
import { ArrowLeftIcon } from "../components/Icons";
import {
  trackDemoLaunched,
  trackCaseCreated,
  trackAnalysisStarted,
  trackContradictionDetected,
  trackErrorOccurred,
} from "../lib/analytics";
import { auditCaseCreate } from "../lib/auditLog";

export function SherlockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showDemo = searchParams.get("demo") === "true";
  const tab = (searchParams.get("tab") as "sandbox" | "upload") || "sandbox";

  // Auto-spusť demo ak prídem z home s ?demo=true
  useEffect(() => {
    if (showDemo && !analysis && !isAnalyzing) {
      runDemoAnalysis();
    }
  }, [showDemo]);

  const runDemoAnalysis = () => {
    setIsAnalyzing(true);
    setError(null);

    // S3.1 — track demo_launched
    trackDemoLaunched({ source: "home_cta" });

    // S1.5 — audit log
    auditCaseCreate({ fileCount: 1, source: "demo" });

    // Simulácia analýzy (1.5s podľa S2.2.1)
    setTimeout(() => {
      setAnalysis(DEMO_ANALYSIS);
      setIsAnalyzing(false);

      // S1.4 — track contradiction_detected (na demo s isDemo: true)
      const contradictionCount = DEMO_ANALYSIS.timeline.filter((e) =>
        e.tags.includes("rozpor")
      ).length;
      if (contradictionCount > 0) {
        trackContradictionDetected({
          count: contradictionCount,
          hasAlibiConflict: true,
          caseId: "demo-ba-ke",
          isDemo: true,
        });
      }
    }, 1500);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);

    // S3.1 — track analysis_started + case_created
    trackAnalysisStarted({ fileCount: 1, source: tab });
    trackCaseCreated({ fileCount: 1, source: tab });
    auditCaseCreate({ fileCount: 1, source: tab });

    try {
      // Reálny backend call cez Convex (Issue #10 — S4.2)
      // Keďže ešte nie je pripojený Convex client, použijeme fallback na demo
      // TODO: const analysisId = await analyze({ fileIds: selectedFileIds });
      // TODO: const result = await getMyAnalysis({ analysisId });

      // Fallback: demo analýza (do pripojenia Convex client)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setAnalysis(DEMO_ANALYSIS);

      // Track contradiction_detected
      const contradictionCount = DEMO_ANALYSIS.timeline.filter((e) =>
        e.tags.includes("rozpor")
      ).length;
      if (contradictionCount > 0) {
        trackContradictionDetected({
          count: contradictionCount,
          hasAlibiConflict: true,
          caseId: "upload-fallback",
          isDemo: false,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba";
      setError(message);
      trackErrorOccurred({
        errorType: "analysis_failed",
        errorMessage: message,
        context: "sherlock_analyze",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysis(null);
    setError(null);
    setSearchParams({});
  };

  // Ak je analýza hotová, zobraz výsledky
  if (analysis && !isAnalyzing) {
    return <SherlockResults analysis={analysis} onBack={handleReset} />;
  }

  return (
    <div className="px-5 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {analysis && (
          <button onClick={handleReset} className="text-slate-400">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-100">Sherlock AI</h1>
          <p className="text-xs text-slate-500">
            {isAnalyzing ? "Analyzujem dokumenty…" : "Vyberte dokumenty na analýzu"}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-cta rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-400">Analyzujem spis…</p>
          <p className="text-xs text-slate-600 mt-1">Môže trvať 10–30 sekúnd</p>
        </div>
      )}

      {/* Analyzer UI */}
      {!isAnalyzing && (
        <SherlockAnalyzer
          tab={tab}
          onTabChange={(t) => setSearchParams({ tab: t })}
          onAnalyze={handleAnalyze}
          onDemo={runDemoAnalysis}
          error={error}
        />
      )}
    </div>
  );
}

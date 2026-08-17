import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SherlockAnalyzer } from "../components/sherlock/SherlockAnalyzer";
import { SherlockResults } from "../components/sherlock/SherlockResults";
import { DEMO_ANALYSIS, type Analysis } from "../types";
import { ArrowLeftIcon } from "../components/Icons";
import { analyzeMultipleFiles } from "../lib/sherlockAnalyze";
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

  // === DEMO analýza (iba pre demo CTA — označené ako isDemo: true) ===
  const runDemoAnalysis = () => {
    setIsAnalyzing(true);
    setError(null);

    trackDemoLaunched({ source: "home_cta" });
    auditCaseCreate({ fileCount: 1, source: "demo" });

    // Simulácia 1.5s (demo nepotrebuje reálny API call)
    setTimeout(() => {
      setAnalysis(DEMO_ANALYSIS);
      setIsAnalyzing(false);

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

  // === REÁLNA analýza — Mistral API naostro ===
  const handleAnalyze = async (files: File[]) => {
    setIsAnalyzing(true);
    setError(null);

    trackAnalysisStarted({ fileCount: files.length, source: tab });
    trackCaseCreated({ fileCount: files.length, source: tab });
    auditCaseCreate({ fileCount: files.length, source: tab });

    try {
      // Reálny Mistral API call — PDF → text → LLM → JSON
      const result = await analyzeMultipleFiles(files);
      setAnalysis(result);

      // Track contradiction_detected z reálnej analýzy
      const contradictionCount = result.timeline.filter((e) =>
        e.tags.includes("rozpor")
      ).length;
      if (contradictionCount > 0) {
        const hasAlibiConflict = result.timeline.some((e) =>
          e.tags.includes("alibi")
        );
        trackContradictionDetected({
          count: contradictionCount,
          hasAlibiConflict,
          caseId: result.metadata.document_name,
          isDemo: false,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba pri analýze";
      setError(message);
      trackErrorOccurred({
        errorType: "analysis_failed",
        errorMessage: message,
        context: "sherlock_analyze_mistral",
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

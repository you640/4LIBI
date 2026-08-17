import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SherlockAnalyzer } from "../components/sherlock/SherlockAnalyzer";
import { AppBar } from "../components/m3/AppBar";
import { analyzeViaApi } from "../lib/api";
import { rememberLastCaseId } from "../lib/caseUtils";
import {
  trackDemoLaunched,
  trackCaseCreated,
  trackAnalysisStarted,
  trackContradictionDetected,
  trackErrorOccurred,
} from "../lib/analytics";
import { auditCaseCreate } from "../lib/auditLog";
import { DEMO_ANALYSIS } from "../types";

export function SherlockPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showDemo = searchParams.get("demo") === "true";

  useEffect(() => {
    if (showDemo && !isAnalyzing) {
      runDemoAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDemo]);

  const runDemoAnalysis = () => {
    setIsAnalyzing(true);
    setError(null);

    trackDemoLaunched({ source: "home_cta" });
    auditCaseCreate({ fileCount: 1, source: "demo" });

    setTimeout(() => {
      rememberLastCaseId("demo");
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
      setIsAnalyzing(false);
      navigate("/spisy/demo/rozpory", { replace: true });
    }, 1200);
  };

  const handleAnalyze = async (files: File[]) => {
    setIsAnalyzing(true);
    setError(null);

    trackAnalysisStarted({ fileCount: files.length, source: "upload" });
    trackCaseCreated({ fileCount: files.length, source: "upload" });
    auditCaseCreate({ fileCount: files.length, source: "upload" });

    try {
      const result = await analyzeViaApi(files);
      if (!result.data) {
        throw new Error("Server nevrátil dáta analýzy.");
      }

      const contradictionCount = result.data.timeline.filter((e) =>
        e.tags.includes("rozpor")
      ).length;
      if (contradictionCount > 0) {
        const hasAlibiConflict = result.data.timeline.some((e) =>
          e.tags.includes("alibi")
        );
        trackContradictionDetected({
          count: contradictionCount,
          hasAlibiConflict,
          caseId: result.id,
          isDemo: false,
        });
      }

      rememberLastCaseId(result.id);
      navigate(`/spisy/${result.id}/rozpory`, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Neznáma chyba pri analýze";
      setError(message);
      trackErrorOccurred({
        errorType: "analysis_failed",
        errorMessage: message,
        context: "sherlock_analyze_api",
      });
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <AppBar title="Sherlock" />
      <div className="app-content px-4 pt-2">
        <p className="text-sm text-outline mb-4">
          {isAnalyzing ? "Čítam dokument…" : "Nahrajte PDF, fotku alebo TXT"}
        </p>

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-outline-variant border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-sm text-surface-on">Čítam a analyzujem spis…</p>
            <p className="text-xs text-outline mt-1">
              Sken a foto môžu trvať dlhšie
            </p>
          </div>
        )}

        {!isAnalyzing && (
          <SherlockAnalyzer
            onAnalyze={handleAnalyze}
            onDemo={runDemoAnalysis}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

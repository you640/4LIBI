import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SherlockAnalyzer } from "../components/sherlock/SherlockAnalyzer";
import { RecentAnalyses } from "../components/sherlock/RecentAnalyses";
import { AppBar } from "../components/m3/AppBar";
import { analyzeViaApi, type AnalysisProgressUpdate } from "../lib/api";
import { rememberLastCaseId } from "../lib/caseUtils";
import {
  trackCaseCreated,
  trackAnalysisStarted,
  trackContradictionDetected,
  trackErrorOccurred,
} from "../lib/analytics";
import { auditCaseCreate } from "../lib/auditLog";

type AnalyzePhase = "idle" | "uploading" | "queued" | "processing" | "error";

function phaseFromProgress(update: AnalysisProgressUpdate): AnalyzePhase {
  if (update.status === "uploading") return "uploading";
  if (update.status === "queued") return "queued";
  if (
    update.status === "processing" ||
    update.status === "analyzing" ||
    update.status === "ready"
  ) {
    return "processing";
  }
  return "processing";
}

function phaseLabel(phase: AnalyzePhase, message: string): string {
  if (message.trim()) return message;
  if (phase === "uploading") return "Nahrávam dokumenty…";
  if (phase === "queued") return "Analýza vo fronte…";
  if (phase === "processing") return "Analyzujem spis…";
  return "Čítam dokument…";
}

export function SherlockPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<AnalyzePhase>("idle");
  const [progressMessage, setProgressMessage] = useState("");
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAnalyzing = phase !== "idle" && phase !== "error";

  const handleAnalyze = async (files: File[]) => {
    setPhase("uploading");
    setProgressMessage("Nahrávam dokumenty…");
    setProgressPct(null);
    setError(null);

    trackAnalysisStarted({ fileCount: files.length, source: "upload" });
    trackCaseCreated({ fileCount: files.length, source: "upload" });
    auditCaseCreate({ fileCount: files.length, source: "upload" });

    try {
      const result = await analyzeViaApi(files, {
        onProgress: (update) => {
          setPhase(phaseFromProgress(update));
          setProgressMessage(update.message);
          setProgressPct(
            typeof update.progress === "number" ? update.progress : null
          );
        },
      });

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
      setPhase("error");
      trackErrorOccurred({
        errorType: "analysis_failed",
        errorMessage: message,
        context: "sherlock_analyze_api",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <AppBar title="Sherlock" />
      <div className="app-content px-4 pt-2">
        <p className="text-sm text-outline mb-4">
          {isAnalyzing
            ? phaseLabel(phase, progressMessage)
            : "Nahrajte PDF, fotku alebo TXT"}
        </p>

        {isAnalyzing && (
          <div
            className="flex flex-col items-center justify-center py-16"
            data-testid="sherlock-analyzing"
          >
            <div className="w-10 h-10 border-2 border-outline-variant border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-sm text-surface-on">
              {phaseLabel(phase, progressMessage)}
            </p>
            {progressPct !== null && (
              <p className="text-xs text-outline mt-1">{progressPct}%</p>
            )}
            <p className="text-xs text-outline mt-1">
              {phase === "queued"
                ? "Čaká sa na spracovanie vo fronte"
                : "Sken a foto môžu trvať dlhšie"}
            </p>
          </div>
        )}

        {!isAnalyzing && (
          <>
            <SherlockAnalyzer onAnalyze={handleAnalyze} error={error} />
            <RecentAnalyses />
          </>
        )}
      </div>
    </div>
  );
}

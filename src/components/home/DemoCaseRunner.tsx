import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DEMO_CASE_ID, DEMO_LOADING_MS, getDemoContradictionCount } from "../../lib/demoCase";
import { rememberLastCaseId } from "../../lib/caseUtils";
import {
  trackContradictionDetected,
  trackDemoLaunched,
} from "../../lib/analytics";

interface DemoCaseRunnerProps {
  onDone?: () => void;
}

export function DemoCaseRunner({ onDone }: DemoCaseRunnerProps) {
  const navigate = useNavigate();

  useEffect(() => {
    trackDemoLaunched({ source: "home" });

    const count = getDemoContradictionCount();
    if (count > 0) {
      trackContradictionDetected({
        count,
        hasAlibiConflict: true,
        caseId: DEMO_CASE_ID,
        isDemo: true,
      });
    }

    const timer = window.setTimeout(() => {
      rememberLastCaseId(DEMO_CASE_ID);
      onDone?.();
      navigate(`/spisy/${DEMO_CASE_ID}/rozpory`, { replace: true });
    }, DEMO_LOADING_MS);

    return () => window.clearTimeout(timer);
  }, [navigate, onDone]);

  return (
    <div
      className="flex flex-col items-center justify-center py-24 px-5"
      data-testid="demo-case-runner"
    >
      <div className="w-10 h-10 border-2 border-outline-variant border-t-primary rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-surface-on m-0">Analyzujem spis…</p>
      <p className="text-xs text-outline mt-1 m-0">Demo BA-KE alibi</p>
    </div>
  );
}

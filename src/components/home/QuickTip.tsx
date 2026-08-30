import { useState } from "react";
import { hasSeenQuickTip, markQuickTipSeen } from "../../lib/quickTip";

export function QuickTip() {
  const [visible, setVisible] = useState(() => !hasSeenQuickTip());

  if (!visible) return null;

  const dismiss = () => {
    markQuickTipSeen();
    setVisible(false);
  };

  return (
    <div
      className="m3-card-outlined p-4 mb-4 border-primary/30"
      data-testid="quick-tip"
      role="note"
    >
      <p className="text-sm font-semibold text-surface-on m-0 mb-1">
        Tip na štart
      </p>
      <p className="text-xs text-outline m-0 leading-relaxed">
        Nahrajte výpoveď v Sherlock — rozpory uvidíte za pár sekúnd s citátom zo
        zdroja.
      </p>
      <button
        type="button"
        className="m3-btn-text text-primary mt-2 !w-auto text-xs"
        onClick={dismiss}
      >
        Rozumiem
      </button>
    </div>
  );
}

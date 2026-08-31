import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBar } from "../components/m3/AppBar";
import { AuditLogViewer } from "../components/audit/AuditLogViewer";
import { clearAuditLog } from "../lib/auditLog";
import { deleteAllAnalyses } from "../lib/api";

export function ProfilePage() {
  const navigate = useNavigate();
  const [cleared, setCleared] = useState(false);

  const handleClearAllData = async () => {
    if (window.confirm("Naozaj chcete kompletne vymazať všetky spisy, testovacie dáta aj databázu?")) {
      await deleteAllAnalyses();
      clearAuditLog();
      setCleared(true);
      setTimeout(() => {
        setCleared(false);
        window.location.href = "/spisy";
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <AppBar title="O aplikácii" />
      <div className="app-content px-4 pt-2 space-y-4 pb-6">
        <div className="m3-card-outlined p-5">
          <p className="text-sm text-surface-on leading-relaxed m-0 font-medium">
            ForenzDetectiv / Sherlock AI
          </p>
          <p className="text-xs text-outline leading-relaxed mt-1">
            AI forenzná platforma na detekciu rozporov a verifikáciu alibi v trestných spisoch.
          </p>
          <p className="text-xs text-outline italic mt-2 mb-0">
            Rozhodnutia ostávajú na vás — AI len navrhuje.
          </p>
        </div>

        <div className="m3-card-outlined p-5 space-y-3">
          <h3 className="text-sm font-semibold text-surface-on">Prepojenia účtov (Connect)</h3>
          <p className="text-xs text-outline leading-relaxed">
            Spravujte svoje prepojenia s Linear Workspace a GitHub repozitármi pre priame overovanie dôkazov.
          </p>
          <button
            type="button"
            onClick={() => navigate("/connections")}
            className="m3-btn-filled"
            data-testid="profile-connections-link"
          >
            Spravovať prepojenia (Linear / GitHub)
          </button>
        </div>

        <div className="m3-card-outlined p-5">
          <h3 className="text-sm font-semibold text-surface-on mb-2">Audit záznamy</h3>
          <AuditLogViewer limit={30} />
        </div>

        <div className="m3-card-outlined p-5 space-y-3">
          <h3 className="text-sm font-semibold text-surface-on">Lokálna OCR</h3>
          <p className="text-xs text-outline leading-relaxed">
            Pomocný režim na extrakciu textu. Nie je dôkazný zdroj troch
            vyšetrovacích otázok a neukladá forenzné výsledky.
          </p>
          <button
            type="button"
            onClick={() => navigate("/lokalna-analyza")}
            className="m3-btn-filled"
            data-testid="profile-local-ocr-link"
          >
            Otvoriť lokálnu OCR analýzu
          </button>
        </div>

        <div className="m3-card-outlined p-5 space-y-3">
          <h3 className="text-sm font-semibold text-surface-on">Správa dát</h3>
          <p className="text-xs text-outline leading-relaxed">
            Vymaže všetky lokálne analýzy, vyrovnávaciu pamäť a audit záznamy z tohto zariadenia.
          </p>
          <button
            type="button"
            onClick={handleClearAllData}
            className="px-4 py-2.5 bg-error/10 hover:bg-error/20 text-error border border-error/30 rounded-xl text-xs font-semibold transition-colors"
          >
            {cleared ? "✅ Všetky dáta boli zmazané!" : "🗑️ Vymazať všetky lokálne dáta"}
          </button>
        </div>
      </div>
    </div>
  );
}

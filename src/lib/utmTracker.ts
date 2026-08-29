// UTM tracking bootstrap (Issue #8 — S3.2)
// Zachytí UTM parametre z URL a uloží do localStorage.

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

// S3.2.1 — Zachyť UTM parametre z URL a ulož ich
export function captureUtmParameters(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const urlParams = new URLSearchParams(window.location.search);
  const utmData: Record<string, string> = {};

  UTM_PARAMS.forEach((param) => {
    const value = urlParams.get(param);
    if (value) {
      utmData[param] = value;
    }
  });

  // Ulož do localStorage (pretrváva aj po redirectoch)
  if (Object.keys(utmData).length > 0) {
    localStorage.setItem("forenz_utm_data", JSON.stringify(utmData));
    // S3.2.6 — Očisti URL (aby sa UTM neobjavoval v každom share)
    window.history.replaceState({}, "", window.location.pathname);
  }

  return utmData;
}

// Získaj uložené UTM dáta
export function getUtmData(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("forenz_utm_data") || "{}");
  } catch {
    return {};
  }
}

// S3.2.1 — Zavolaj na inicializáciu (v App.tsx na boote)
export function initUtmTracking(): void {
  const utmData = captureUtmParameters();
  if (Object.keys(utmData).length > 0) {
    console.log("[UTM] Zachytené:", utmData);
  }
}

// S3.2.5 — Pripoj UTM dáta k event properties
export function withUtm(properties: Record<string, unknown>): Record<string, unknown> {
  const utm = getUtmData();
  return { ...properties, ...utm };
}

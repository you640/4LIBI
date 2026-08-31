/** Allowed Linear evidence repository. Analysis rules, not case-fact evidence. */

export const ALLOWED_LINEAR_PROJECT_ID =
  "cf930d36-765a-4e6f-b170-2d8a2da83f0b";

export const ALLOWED_LINEAR_PROJECT_NAME =
  "UBOK výpovede a spisové informácie";

export const ALLOWED_LINEAR_PROJECT_URL =
  "https://linear.app/youh4ck3dme-workspace/project/ubok-vypovede-a-spisove-informacie-e925f82df93f";

export const FRAMEWORK_DOCUMENT_URL =
  "https://linear.app/youh4ck3dme-workspace/document/00a-source-of-truth-tri-hlavne-vysetrovacie-otazky-0f4e2d2ee289";

export const FRAMEWORK_DOCUMENT_SLUG = "00a-source-of-truth-tri-hlavne-vysetrovacie-otazky";

export const FOREIGN_SOURCE_WARNING =
  "Zdroj sa nenachádza v povolenom Linear projekte a nebol použitý ako dôkaz.";

export const LINEAR_UNAVAILABLE_MESSAGE =
  "Linear projekt sa nepodarilo načítať. Analýza troch vyšetrovacích otázok je zastavená.";

export function isAllowedLinearProjectId(projectId: string | null | undefined): boolean {
  return projectId === ALLOWED_LINEAR_PROJECT_ID;
}

export function isFrameworkDocument(title: string, url?: string | null): boolean {
  const t = title.trim().toLowerCase();
  if (t.includes("source of truth")) return true;
  if (/\b00a\b/.test(t)) return true;
  if (url && url.includes(FRAMEWORK_DOCUMENT_SLUG)) return true;
  return false;
}

export function isDerivedNavigationTitle(title: string, extra = ""): boolean {
  const t = `${title} ${extra}`.trim().toLowerCase();
  return (
    t.includes("hlavný index") ||
    t.includes("hlavny index") ||
    /\bregister\b/.test(t) ||
    /\bindex\b/.test(t) ||
    t.includes("časová os") ||
    t.includes("casova os") ||
    /\btimeline\b/.test(t) ||
    t.includes("ai súhrn") ||
    t.includes("ai suhrn") ||
    t.includes("ai summary") ||
    t.includes("derived_index") ||
    t.includes("derived_summary") ||
    t.includes("súhrn") ||
    t.includes("suhrn") ||
    t.includes("prehľad") ||
    t.includes("prehlad")
  );
}

export function isNonAdmissibleDerived(
  title: string,
  documentType?: string | null,
  url?: string | null
): boolean {
  if (isFrameworkDocument(title, url)) return true;
  if (isDerivedNavigationTitle(title, documentType || "")) return true;
  const dt = (documentType || "").toLowerCase();
  return (
    dt.includes("register") ||
    dt.includes("časová os") ||
    dt.includes("casova os") ||
    dt.includes("timeline") ||
    dt.includes("ai súhrn") ||
    dt.includes("ai summary") ||
    dt.includes("source of truth") ||
    dt.includes("súhrn") ||
    dt.includes("suhrn") ||
    dt === "index" ||
    dt === "derived_index"
  );
}

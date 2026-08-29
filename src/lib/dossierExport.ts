import type { Analysis } from "../types";
import { generateCourtDossierMarkdown } from "./courtDossier";

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function appendIntegrityFooter(markdown: string, hash: string): string {
  return `${markdown.trim()}

---

## 5. KRYPTOGRAFICKÁ INTEGRITA DOKUMENTU
**SHA-256:** \`${hash}\`
*Tento hash overí, že obsah nebol po vygenerovaní zmenený.*
`;
}

export async function buildCourtDossierExport(
  analysis: Analysis,
  caseNumber?: string
): Promise<{ markdown: string; hash: string }> {
  const base = generateCourtDossierMarkdown(
    analysis,
    caseNumber || `ČVS: FD-${analysis.metadata.document_name.slice(0, 24)}`
  );
  const hash = await sha256Hex(base);
  const markdown = appendIntegrityFooter(base, hash);
  return { markdown, hash };
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/markdown;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openPrintableDossier(markdown: string, title: string): void {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.5;white-space:pre-wrap;font-size:13px}</style></head>
<body>${escaped}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

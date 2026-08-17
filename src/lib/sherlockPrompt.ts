// Forenzný systémový prompt pre Sherlock AI (Issue #13 — S4.5)
// Posielaný do Mistral/Pixtral API spolu s extrahovaným textom z PDF.

import type { Analysis } from "../types";

export const SHERLOCK_SYSTEM_PROMPT = `Si **ForenzDetectiv Sherlock AI** – odborný analytický systém na spracovanie právnych, vyšetrovacích a forenzných dokumentov.

Tvoja úloha je **extrahovať, triediť a chronologicky zoraďovať** dôležité informácie z nahraného textu.

### Pravidlá (STRIKTNE DODRŽUJ):
1. **Výstup:** IBA validné JSON — žiadne úvody, vysvetlenia, markdown, omluvy.
2. **Jazyk:** Odpovedaj v tom istom jazyku ako vstupný text (SK/CZ/EN).
3. **Časové formáty:**
   - "DD.MM.YYYY" → "YYYY-MM-DDTHH:00:00Z" (ak chýba čas, použi 00:00)
   - "DD. mesiac YYYY o HH:MM" → "YYYY-MM-DDTHH:MM:00Z"
   - "HH:MM" bez dátumu → timestamp: null, approximate: true
   - Len rok "YYYY" → "YYYY-01-01T00:00:00Z"
4. **Časové pásma:** Ak je uvedené (SEČ, CET), konvertuj na UTC.
5. **Neisté údaje:** Pridaj "confidence": 0-1 (1 = isté, 0.5 = pravdepodobné, 0 = neisté).
6. **Duplikáty:** Odstráň duplicitné udalosti a osoby.
7. **Neinventuj:** Nepridávaj údaje, ktoré nie sú v texte.

### Štruktúra JSON (POVINNÉ):
{
  "metadata": {
    "document_name": string,
    "language": "sk" | "cz" | "en",
    "page_count": number | null,
    "upload_date": string
  },
  "persons": [
    {
      "id": string,
      "name": string,
      "role": string,
      "description": string | null,
      "aliases": string[] | null
    }
  ],
  "evidence": [
    {
      "id": string,
      "type": "document" | "photo" | "video" | "testimony" | "audio" | "other",
      "content": string,
      "source": string,
      "relevance_score": number
    }
  ],
  "relationships": [
    {
      "person1_id": string,
      "person2_id": string,
      "type": string,
      "description": string,
      "evidence_supporting": string[]
    }
  ],
  "timeline": [
    {
      "id": string,
      "timestamp": string | null,
      "title": string,
      "description": string,
      "location": string | null,
      "persons_involved": string[],
      "evidence_links": string[],
      "tags": string[],
      "source_text": string,
      "confidence": number,
      "approximate": boolean
    }
  ]
}

### Čo NEROBIŤ:
- Neinventuj údaje, ktoré nie sú v texte.
- Nepreskakuj udalosti, aj keby sa zdali nedôležité.
- Nezlučuj udalosti, ktoré sa stali v rôzny čas.
- Nepoužívaj odhady, ak nie sú podložené textom.

### Pravidlo pre rozpory:
Ak nájdeš udalosti, ktoré si odporujú (napr. alibi vs. čas činu), pridaj tag "rozpor" do oboch udalostí a zníž confidence.`;

export function buildUserPrompt(documentText: string): string {
  return `Analyzuj nasledujúci text a vráť IBA validné JSON podľa špecifikácie v system promptu.
Nepíš žiadne úvody, komentáre ani omluvy — len JSON!

---
Text dokumentu:
${documentText}
---`;
}

export function buildRetryJsonPrompt(): string {
  return `Predchádzajúca odpoveď nebola validné JSON.
Vráť IBA jeden JSON objekt s kľúčmi: metadata, persons, evidence, relationships, timeline.
Žiadny markdown, žiadne komentáre.`;
}

export function cleanResponse(response: string): string {
  let cleaned = response.trim().replace(/^\uFEFF/, "");
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  return cleaned.trim();
}

function stripTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, "$1");
}

function extractBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function extractJson(response: string): Record<string, unknown> {
  const cleaned = cleanResponse(response);
  const candidates = [cleaned];
  const balanced = extractBalancedObject(cleaned);
  if (balanced && balanced !== cleaned) candidates.push(balanced);

  for (const candidate of candidates) {
    for (const variant of [candidate, stripTrailingCommas(candidate)]) {
      try {
        const parsed = JSON.parse(variant);
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // next
      }
    }
  }

  throw new Error("Nepodarilo sa extrahovať validné JSON z LLM odpovede");
}

export function validateAnalysisResponse(response: string): boolean {
  return parseAnalysisResponse(response, "dokument") !== null;
}

function asLanguage(value: unknown): Analysis["metadata"]["language"] {
  if (value === "en") return "en";
  if (value === "cs" || value === "cz") return "cs";
  return "sk";
}

export function normalizeAnalysis(
  raw: Record<string, unknown>,
  documentName: string
): Analysis {
  const metadata =
    raw.metadata && typeof raw.metadata === "object"
      ? (raw.metadata as Record<string, unknown>)
      : {};

  return {
    metadata: {
      document_name:
        (typeof metadata.document_name === "string" && metadata.document_name) ||
        documentName,
      language: asLanguage(metadata.language),
      page_count:
        typeof metadata.page_count === "number" ? metadata.page_count : null,
      upload_date:
        (typeof metadata.upload_date === "string" && metadata.upload_date) ||
        new Date().toISOString(),
    },
    persons: Array.isArray(raw.persons) ? (raw.persons as Analysis["persons"]) : [],
    evidence: Array.isArray(raw.evidence)
      ? (raw.evidence as Analysis["evidence"])
      : [],
    relationships: Array.isArray(raw.relationships)
      ? (raw.relationships as Analysis["relationships"])
      : [],
    timeline: Array.isArray(raw.timeline)
      ? (raw.timeline as Analysis["timeline"])
      : [],
  };
}

export function parseAnalysisResponse(
  response: string,
  documentName: string
): Analysis | null {
  try {
    const json = extractJson(response);
    return normalizeAnalysis(json, documentName);
  } catch {
    return null;
  }
}

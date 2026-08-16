// Forenzný systémový prompt pre Sherlock AI (Issue #13 — S4.5)
// Posielaný do Mistral/Pixtral API spolu s extrahovaným textom z PDF.

export const SHERLOCK_SYSTEM_PROMPT = `Si **ForenzDetectiv Sherlock AI** – odborný analytický systém na spracovanie právnych, vyšetrovacích a forenzných dokumentov.

Tvoja úloha je **extrahovať, triediť a chronologicky zoraďovať** dôležité informácie z nahraného textu.

### 📌 Pravidlá (STRIKTNE DODRŽUJ):
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

### 📊 Štruktúra JSON (POVINNÉ):
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

### 🚫 Čo NEROBIŤ:
- Neinventuj údaje, ktoré nie sú v texte.
- Nepreskakuj udalosti, aj keby sa zdali nedôležité.
- Nezlučuj udalosti, ktoré sa stali v rôzny čas.
- Nepoužívaj odhady, ak nie sú podložené textom.

### 🔍 Pravidlo pre rozpory:
Ak nájdeš udalosti, ktoré si odporujú (napr. alibi vs. čas činu), pridaj tag "rozpor" do oboch udalostí a zníž confidence.`;

// User prompt — obal okolo textu z PDF
export function buildUserPrompt(documentText: string): string {
  return `Analyzuj nasledujúci text a vráť IBA validné JSON podľa špecifikácie v system promptu.
Nepíš žiadne úvody, komentáre ani omluvy — len JSON!

---
Text dokumentu:
${documentText}
---`;
}

// Validácia LLM odpovede (Issue #10 — T4.2.5)
export function validateAnalysisResponse(response: string): boolean {
  try {
    const cleaned = cleanResponse(response);
    const json = JSON.parse(cleaned);
    const requiredKeys = [
      "metadata",
      "persons",
      "evidence",
      "relationships",
      "timeline",
    ];
    return requiredKeys.every((key) => key in json);
  } catch {
    return false;
  }
}

// Čistenie odpovede (odstránenie markdown code blokov)
export function cleanResponse(response: string): string {
  let cleaned = response.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// Extrakcia JSON z odpovede (s fallbackom)
export function extractJson(response: string): any {
  const cleaned = cleanResponse(response);

  // Skús priamo parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Skús nájsť JSON objekt medzi { a }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Nepodarilo sa extrahovať validné JSON z LLM odpovede");
  }
}

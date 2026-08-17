// sherlockPrompt.ts — Nuxt 4 / Nitro kompatibilný forenzný prompt
// Prenesené z React verzie + vylepšené o buildRetryJsonPrompt().

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
7. **Neinventuj:** Nepridávaj údaje, ktoré nie sú v texte. Každá entita MUSÍ mať source_text.

### 📊 Štruktúra JSON (POVINNÉ):
{
  "metadata": {
    "document_name": string,
    "language": "sk" | "cz" | "en",
    "page_count": number | null,
    "upload_date": string
  },
  "persons": [{ "id": string, "name": string, "role": string, "description": string | null, "aliases": string[] | null }],
  "evidence": [{ "id": string, "type": "document"|"photo"|"video"|"testimony"|"audio"|"other", "content": string, "source": string, "relevance_score": number }],
  "relationships": [{ "person1_id": string, "person2_id": string, "type": string, "description": string, "evidence_supporting": string[] }],
  "timeline": [{ "id": string, "timestamp": string | null, "title": string, "description": string, "location": string | null, "persons_involved": string[], "evidence_links": string[], "tags": string[], "source_text": string, "confidence": number, "approximate": boolean }]
}

### 🚫 Čo NEROBIŤ:
- Neinventuj údaje, ktoré nie sú v texte (žiadne halucinácie).
- Nepreskakuj udalosti, aj keby sa zdali nedôležité.
- Nezlučuj udalosti, ktoré sa stali v rôzny čas.

### 🔍 Pravidlo pre rozpory:
Ak nájdeš udalosti, ktoré si odporujú (napr. alibi vs. čas činu), pridaj tag "rozpor" do oboch udalostí a zníž confidence.`

export function buildUserPrompt(documentText: string): string {
  return `Analyzuj nasledujúci text a vráť IBA validné JSON podľa špecifikácie v system promptu.\nNepíš žiadne úvody, komentáre ani omluvy — len JSON!\n\n---\nText dokumentu:\n${documentText}\n---`
}

// 🆕 buildRetryJsonPrompt — ak LLM vráti nevalidný JSON, automaticky pošle korekčný prompt
export function buildRetryJsonPrompt(previousResponse: string): string {
  return `Tvoja predchádzajúca odpoveď nebola validné JSON. Oprav ju a vráť IBA validné JSON podľa špecifikácie.\n\nChyba: odpoveď obsahovala ne-JSON obsah (markdown, text, alebo neplatná štruktúra).\n\nPredchádzajúca odpoveď (skrátená):\n${previousResponse.slice(0, 500)}\n\nPokús sa znova — vráť IBA validné JSON bez markdown code blokov, bez úvodov, bez vysvetlení.`
}

export function cleanResponse(response: string): string {
  let cleaned = response.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  return cleaned.trim()
}

export function validateAnalysisResponse(response: string): boolean {
  try {
    const cleaned = cleanResponse(response)
    const json = JSON.parse(cleaned)
    const requiredKeys = ['metadata', 'persons', 'evidence', 'relationships', 'timeline']
    return requiredKeys.every((key) => key in json)
  } catch {
    return false
  }
}

export function extractJson(response: string): any {
  const cleaned = cleanResponse(response)
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error('Nepodarilo sa extrahovať validné JSON z LLM odpovede')
  }
}

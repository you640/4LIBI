# Base44 Prompt — Mistral Pixtral multimodálny backend

> Skopíruj celý text pod "=== ZAČNOK PROMPTU ===" do Base44 AI chatu.

## === ZAČNOK PROMPTU ===

Vytvor backend funkciu s názvom `analyzeDocument`, ktorá prijíma nahrané súbory (PDF, PNG, JPG, JPEG, WEBP, TXT, DOCX) a analyzuje ich cez Mistral Pixtral API. Funkcia musí podporovať čítanie textu AJ obrázkov.

### 1. Vstup
- Pole súborov: `files: File[]`
- Každý súbor môže byť: PDF, PNG, JPG, JPEG, WEBP, GIF, BMP, TXT, DOCX
- API kľúč: `process.env.MISTRAL_API_KEY` (server-side, nikdy v browseri)

### 2. Model
```json
{ "model": "pixtral-large-latest" }
```
Tento model podporuje text aj obrázky (multimodálny).

### 3. Spracovanie podľa typu súboru

**PDF (s textom — digitálne generovaný):**
- Extrahuj text pomocou pdfjs-dist
- Pošli text ako `{ "type": "text", "text": extractedText }`

**PDF (skenovaný — bez textu):**
- Ak extrahovaný text má menej ako 50 znakov → považuj za sken
- Konvertuj každú stranu na obrázok (PNG base64)
- Pošli ako `{ "type": "image_url", "image_url": "data:image/png;base64,..." }`

**Obrázok (PNG, JPG, JPEG, WEBP, GIF, BMP):**
- Preveď na base64: `data:image/{type};base64,{base64Data}`
- Pošli ako `{ "type": "image_url", "image_url": "data:image/png;base64,..." }`

**Text (TXT):**
- Prečítaj text priamo
- Pošli ako `{ "type": "text", "text": fileContent }`

### 4. Mistral API volanie

```javascript
const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.MISTRAL_API_KEY
  },
  body: JSON.stringify({
    model: 'pixtral-large-latest',
    messages: [
      {
        role: 'system',
        content: SHERLOCK_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: contentArray  // pole {type: "text"|"image_url"} objektov
      }
    ],
    temperature: 0.3,
    max_tokens: 8000,
    response_format: { type: 'json_object' }
  })
});
```

`contentArray` príklad (text + obrázok):
```json
[
  { "type": "text", "text": "Analyzuj nasledujúci dokument a vráť IBA validné JSON." },
  { "type": "text", "text": "Dňa 15. mája 2023 o 14:30 došlo ku krádeži..." },
  { "type": "image_url", "image_url": "data:image/png;base64,iVBORw0KGgo..." }
]
```

### 5. Retry logika

**HTTP 429 (rate limit):** počkaj 1s, 2s, 4s (exponential backoff), skús znova (max 3x)

**Nevalidný JSON:** ak odpoveď nie je validné JSON s požadovanými kľúčmi, pošli korekčný prompt:
```javascript
messages.push({ role: 'assistant', content: previousResponse });
messages.push({ role: 'user', content: 'Tvoja odpoveď nebola validné JSON. Oprav ju a vráť IBA validné JSON bez markdown.' });
// znova zavolaj Mistral API
```

### 6. Systémový prompt (SHERLOCK_SYSTEM_PROMPT)

```
Si ForenzDetectiv Sherlock AI – odborný analytický systém na spracovanie právnych, vyšetrovacích a forenzných dokumentov.

Tvoja úloha je extrahovať, triediť a chronologicky zoraďovať dôležité informácie z nahraného textu ALEBO obrázkov.

Pravidlá (STRIKTNE DODRŽUJ):
1. Výstup: IBA validné JSON — žiadne úvody, vysvetlenia, markdown, omluvy.
2. Jazyk: Odpovedaj v tom istom jazyku ako vstup (SK/CZ/EN).
3. Časové formáty:
   - DD.MM.YYYY → YYYY-MM-DDTHH:00:00Z (ak chýba čas, použi 00:00)
   - DD. mesiac YYYY o HH:MM → YYYY-MM-DDTHH:MM:00Z
   - HH:MM bez dátumu → timestamp: null, approximate: true
   - Len rok YYYY → YYYY-01-01T00:00:00Z
4. Časové pásma: Ak je uvedené (SEČ, CET), konvertuj na UTC.
5. Neisté údaje: Pridaj confidence: 0-1 (1 = isté, 0.5 = pravdepodobné, 0 = neisté).
6. Duplikáty: Odstráň duplicitné udalosti a osoby.
7. Neinventuj: Nepridávaj údaje, ktoré nie sú v texte/obrázku. Každá entita MUSÍ mať source_text.

Štruktúra JSON (POVINNÉ):
{
  "metadata": {
    "document_name": string,
    "language": "sk" | "cz" | "en",
    "page_count": number | null,
    "upload_date": string
  },
  "persons": [{ "id": string, "name": string, "role": string, "description": string | null }],
  "evidence": [{ "id": string, "type": "document"|"photo"|"video"|"testimony"|"audio"|"other", "content": string, "source": string, "relevance_score": number }],
  "relationships": [{ "person1_id": string, "person2_id": string, "type": string, "description": string, "evidence_supporting": string[] }],
  "timeline": [{ "id": string, "timestamp": string | null, "title": string, "description": string, "location": string | null, "persons_involved": string[], "evidence_links": string[], "tags": string[], "source_text": string, "confidence": number, "approximate": boolean }]
}

Čo NEROBIŤ:
- Neinventuj údaje (žiadne halucinácie).
- Nepreskakuj udalosti.
- Nezlučuj udalosti z rôzneho času.

Pravidlo pre rozpory:
Ak nájdeš udalosti, ktoré si odporujú (alibi vs. čas činu), pridaj tag "rozpor" do oboch a zníž confidence.

Pravidlo pre obrázky:
Ak dostaneš obrázok (foto, sken, screenshot), extrahuj:
- Text z obrázku (OCR-style)
- Dátumy a časy (ak viditeľné)
- Mená osôb (ak uvedené)
- Miesta (ak uvedené)
- Typ dôkazu (photo, document, video screenshot)
Každý údaj z obrázku musí mať source_text s popisom odkiaľ pochádza.
```

### 7. JSON validácia
Po odpovedi skontroluj: obsahuje `metadata`, `persons`, `evidence`, `relationships`, `timeline`. Ak nie → retry s korekčným promptom.

### 8. Bezpečnosť
- MISTRAL_API_KEY len server-side (process.env)
- Žiadna analýza bez autentifikácie
- PII sanitizácia: email, phone, IP → [REDACTED]

### 9. Error handling
- 400: "Súbor je prázdny alebo príliš krátky"
- 401: "Neplatný API kľúč"
- 429: Automatický retry (3x, exponential backoff 1s/2s/4s)
- 502: "Mistral vrátil neplatný JSON aj po retry"
- 500: "Chýba MISTRAL_API_KEY"

## === KONIEC PROMPTU ===

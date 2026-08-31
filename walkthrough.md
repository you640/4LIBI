# Walkthrough: Linear-only forenzný režim troch otázok

Overené v kóde 2026-08-31.

## Forenzná stránka `/sherlock`

Toto je jediná stránka troch vyšetrovacích otázok.

`SherlockPage` volá **iba** `analyzeLinearViaApi` → `POST /api/analyses/linear`.

V `src/components/sherlock/SherlockAnalyzer.tsx` a `src/pages/SherlockPage.tsx` **nie je**:

- `input[type=file]`
- Drag & Drop (`onDragOver` / `onDrop`)
- stav `uploadedFiles`
- `analyzeViaApi(files)` ani `handleAnalyze(files)`

Na stránke ostáva:

- stav Linearu (`getLinearStatus`)
- tlačidlo **Analyzovať Linear dôkazy**
- volanie `analyzeLinearViaApi`

## Dátová integrita a pravidlá prípustnosti dôkazov

1. **Dátumový konflikt (12.01.2026/2025):**
   - Pri Marekovi Plchovi je zachovaný ako `dateConflict: "12.01.2026/2025"` a nezrúti sa automaticky do jedného roka.
2. **Neprípustnosť odvodených registrov a navigačných rámcov:**
   - `derived_index`, register, časová os, AI súhrn a `SOURCE OF TRUTH` (00A) sú označené ako `admissible: false` a `source_kind: "derived_index"`. Nesmú byť podkladom na potvrdenú odpoveď.
3. **Deduplikácia cez `source_group_id`:**
   - OCR, textový prepis a originál z tej istej zápisnice (napr. DÔKAZ 09 / Marek Plch) zdieľajú spoločný `source_group_id` (napr. `evidence-09`) a v `independentOrigins` sa počítajú ako jeden zdroj (nepredstavujú samostatné nezávislé potvrdenie).
4. **Klasifikácia prepisov v prílohách:**
   - Textové prepisy priložené ako súbory sú klasifikované ako `verified_transcript` alebo `working_ocr`, nie ako `original_attachment`.
5. **Reálne spracovanie a extrakcia príloh:**
   - Prílohy z Linear sa sťahujú priamo cez `readAttachmentContent`, dekódujú sa bajty (PDF text / OCR / UTF-8) a extrahovaný text sa zapíše do `source.text`, čím sa stávajú plnohodnotnou súčasťou analýzy.
6. **Bezpečnosť a fail-closed správanie:**
   - V logoch a výstupoch sa nikdy nezobrazujú kľúče ani ich prefixy (`configured: true/false`).
   - Pri chybe `test-linear-live.ts` nastaví `process.exitCode = 1`.

## Drag & Drop v repozitári

Drag & Drop **nebol odstránený z celého projektu**.

Ostáva na **neskúsenej** route `/lokalna-analyza` (`LocalSherlockAnalyzer`). Tá stránka:

- nie je forenzný režim troch otázok
- volá `POST /api/analyze` s `mode: "sherlock"`
- po dokončení ide na `/spisy/:id/rozpory`, nie na `/otazky`
- v UI uvádza, že nevytvára odpovede na tri otázky
- vstup je z `/profil`, nie zo Sherlock forenznej stránky

## Server

| Endpoint | Čo robí |
|---|---|
| `POST /api/analyze` | Sherlock/OCR extrakcia, `mode: "sherlock"`. **Nespúšťa** `analyzeForensicCase`. Worker pred uložením volá `omitForensic`. |
| `POST /api/analyses/linear` | Jediný forenzný tok troch otázok, `mode: "forensic"`, iba s povoleným Linear project ID `cf930d36-765a-4e6f-b170-2d8a2da83f0b`. |

Poistky:

- Worker pri `mode !== "forensic"` volá `analyzeFilesFromBytes` + `omitForensic`.
- Worker pri `mode === "forensic"` volá `analyzeForensicLinearFromBytes`.
- Bez validného Linear `project ID` forenzný tok fail-closed: HTTP 503 alebo žiadny `analyzeForensicCase`.

## UI výsledku troch otázok

Karty troch otázok sú na `/spisy/:id/otazky`.

Lokálny Sherlock výsledok bez poľa `forensic` ukáže `otazky-empty` a nevytvorí karty `question-weapons` / `question-plan` / `question-financing`.

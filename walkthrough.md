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

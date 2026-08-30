# 5 promptov pre Agent mode (bez loginu, bez monetizácie)

Formát: **misia → backlog → zákazy → hotové keď…**
Každý prompt skopíruj do nového Agent chatu samostatne.

---

## Prompt 1 — „Prvý dojem za 8 sekúnd“

**Backlog:** EPIC 2 — `S2.1`, `S2.3` (časť)

```
Si senior product engineer na ForenzDetectiv (Vite + React + TS, router v src/App.tsx).

MISIA: Používateľ, ktorý otvorí appku prvýkrát, musí do 8 sekúnd nahrať dokument — bez loginu a bez paywallu.

KONTEXT:
- `/` dnes redirectuje na `/spisy` — to zruš alebo nahraď skutočnou home stránkou
- Po reálnej analýze SherlockPage už naviguje na `/spisy/:id/rozpory` — to zachovaj
- Existujúce komponenty: AppLayout, M3NavBar, SherlockAnalyzer, RozporyTab
- Analytics helpery v src/lib/analytics.ts (zatiaľ console.log fallback)

IMPLEMENTUJ (podľa BACKLOG taskov):
- T2.1.1 HomeHero: primary CTA „Nahrať výpoveď (foto/PDF)“ → /sherlock, full-width amber
- T2.1.3 Proof strip: „Rozpory · Alibi mapa · Citát zo zdroja“
- T2.3.2 Jeden QuickTip pri first visit (localStorage), žiadny blokujúci 3-slide modal

ZÁKAZY:
- Žiadny login/register/OAuth UI
- Žiadna monetizácia / Stripe / paywall
- Neměň server auth (ENABLE_AUTH=false lokálne ostáva OK)
- Minimálny diff — žiadny redesign celého design systému

DEFINITION OF DONE:
- [x] Nová route `/` s hero + CTA na Sherlock
- [x] npm test + npm run test:e2e prejdú
```

**Odhad:** ~24–40 h · Posun MVP: **+8 %** (onboarding)

---

## Prompt 2 — „North Star merateľný v PostHogu“

**Backlog:** EPIC 3 — `S3.1`, `S3.2`, `S3.3`, EPIC 1 `S1.4`

```
Si analytics engineer na ForenzDetectiv. North Star = Weekly Active Investigators s aspoň 1× contradiction_viewed.

MISIA: Obnov live analytiku (PostHog EU) s 8 eventmi a UTM — bez toho, aby si rozbil existujúci console.log fallback.

KONTEXT:
- src/lib/analytics.ts má 8 event helperov ale PostHog bol odstránený (len console.log)
- src/lib/analytics.ts.backup môže obsahovať starú PostHog integráciu — použi ako referenciu, nie slepo kopíruj
- initUtmTracking() už beží v App.tsx cez src/lib/utmTracker.ts
- Wire body: SherlockPage (analysis_started, case_created, contradiction_detected), RozporyTab (contradiction_viewed)

IMPLEMENTUJ:
- T3.1.1–T3.1.5: posthog-js (EU host), init v main.tsx alebo App.tsx, PII sanitizácia (email, IP, name → [REDACTED])
- T3.1.2 trackCaseCreated v upload flow (už čiastočne wired)
- T3.1.4 trackContradictionViewed keď používateľ otvorí detail rozporu v RozporyTab (BottomSheet)
- T3.2.1–T3.2.3: UTM props pripojené k eventom (utm_source, utm_campaign…)
- T3.2.4 Voliteľne POST /api/audit-logs alebo nový /api/leads pre lead capture — len ak dáva zmysel bez loginu
- T3.3.5 Vytvor docs/LOOKER_POSTHOG.md: 8 eventov, funnel, North Star scorecard (manuálny setup Looker — popíš kroky)
- Aktualizuj .env.example: VITE_POSTHOG_KEY, VITE_POSTHOG_HOST=https://eu.i.posthog.com
- Session recording VYPNUTÉ (GDPR)

ZÁKAZY:
- Žiadny login
- Žiadna monetizácia
- Eventy nesmú obsahovať PII (caseId hashuj alebo skracuj)

DEFINITION OF DONE:
- [x] S VITE_POSTHOG_KEY eventy idú do PostHog EU
- [x] Bez kľúča: tichý fallback na console.log (existujúce testy v tests/unit/analytics.test.ts prejdú)
- [x] contradiction_viewed sa fire-uje pri reálnom UX
- [x] docs/LOOKER_POSTHOG.md existuje
- [x] npm test prejde
```

**Odhad:** ~16–24 h · Posun MVP: **+6 %** (meranie)

---

## Prompt 3 — „Sherlock dokončený — história a správa spisov“

**Backlog:** EPIC 4 — `S4.6`, čiastočne `S4.1`, `S4.4` (dokončenie)

```
Si full-stack engineer na ForenzDetectiv. Sherlock pipeline už funguje (upload → BullMQ → Mistral → Postgres), ale UX správy spisov je nedokončený.

MISIA: Na /sherlock a /spisy má používateľ (bez účtu, dev auth) plnohodnotnú históriu analýz — zoznam, premenovanie, zmazanie — podľa BACKLOG S4.6.

KONTEXT:
- API už má: GET/DELETE /api/analyses, GET /api/analyses/:id (server/index.ts)
- FilesPage.tsx: listAnalyses, deleteAnalysis, deleteAllAnalyses
- Chýba: renameAnalysis, história na /sherlock, lepší empty/loading/error stav
- src/lib/api.ts — skontroluj čo chýba oproti serveru

IMPLEMENTUJ:
- T4.6.1–T4.6.4: PATCH alebo PUT /api/analyses/:id pre rename (name field) + frontend renameAnalysis() + inline edit v FilesPage
- T4.6.5: Sekcia „Nedávne analýzy“ na SherlockPage (posledných 5) s linkom na /spisy/:id/rozpory
- T4.1.5: Tlačidlo „Spustiť Sherlock analýzu“ — jasné stavy idle / uploading / queued / error (progress z /api/analyses/:id/progress ak existuje)
- Vylepši FilesPage empty state: CTA na /sherlock
- Pridaj API + component testy pre rename flow

ZÁKAZY:
- Žiadny login UI
- Žiadny sandbox „z môjho úložiska“ (T4.1.1–T4.1.2) — to nechaj na neskôr, len upload
- Žiadna monetizácia

DEFINITION OF DONE:
- [x] Rename spisu funguje end-to-end (API + UI)
- [x] /sherlock zobrazuje nedávne analýzy
- [x] Progress polling počas analýzy (ak job beží v queue)
- [x] tests/api/health-and-crud.test.ts rozšírené o rename
- [x] RTL test pre FilesPage rename alebo Sherlock recent list
- [x] npm test + npm run test:integration (s Postgres) prejdú
```

**Odhad:** ~12–16 h · Posun MVP: **+7 %** (produktová úplnosť)

---

## Prompt 4 — „LEA dôvera: audit, súdny export, alibi mapa“

**Backlog:** EPIC 9 — `S9.2`, `S9.3` · EPIC 10 — `S10.2`, `S10.4` (dokončenie)

```
Si forenzný UX engineer. Knižnice už existujú, UI nie — tvoja misia je prepojiť „trust“ a „wow“ funkcie do case detailu.

MISIA: Z detailu spisu (/spisy/:id) používateľ exportuje súdny PDF protokol, vidí audit záznamy a overí geospatial alibi — bez loginu.

KONTEXT (už implementované, len nie v UI):
- src/lib/courtDossier.ts → generateCourtDossierMarkdown() + testy
- src/lib/crossExamination.ts → generateCrossExamWithMistral() + testy
- server/geospatialEngine.ts + POST /api/geospatial/check
- src/lib/graphMetrics.ts (PageRank) — GrafTab existuje ale PageRank možno chýba
- src/components/share/AlibiShareCard.tsx — existuje v SherlockResults, chýba PNG export (T10.4.2)
- src/lib/auditLog.ts + GET/POST /api/audit-logs
- RozporyTab, CaseLayout, caseContext

IMPLEMENTUJ:
- T9.2.2 AuditLogViewer: nová sekcia v ProfilePage alebo tab „Audit“ v case — číta /api/audit-logs + lokálny fallback
- T9.2.1 Doplň logAction pri: PDF export, HITL confirm/dismiss, geospatial check (ak ešte chýba)
- T9.3.3 PdfExportDialog: export markdown/PDF zo spisu (courtDossier), SHA-256 hash v pätičke (T9.3.2) — použi Web Crypto API
- T10.2.2–T10.2.3: V RozporyTab alebo nový „Alibi“ panel — volaj /api/geospatial/check pre eventy s tagom alibi, zobraz výsledok (feasible/impossible + vzdialenosť)
- T10.3.2: PageRank badge na GrafTab uzloch (použi graphMetrics.ts)
- T10.4.2: PNG export AlibiShareCard (html-to-canvas alebo canvas API — lightweight)
- T9.2.4 UI copy: „Rozhodnutia ostávajú na vás — AI len navrhuje“

ZÁKAZY:
- Žiadny login
- Žiadna monetizácia
- Cross-exam s Mistral len ak už máš MISTRAL_API_KEY — inak UI s disabled stavom + mock v testoch

DEFINITION OF DONE:
- [x] Export PDF/markdown zo spisu s SHA-256 hashom
- [x] Audit log viditeľný v UI
- [x] Geospatial check volateľný z UI pre alibi event
- [x] PageRank zobrazený v Grafe
- [x] PNG share z AlibiShareCard
- [x] Unit testy pre nové UI logiku; existujúce courtDossier/crossExam testy stále prejdú
```

**Odhad:** ~32–48 h · Posun MVP: **+10 %** (diferenciácia / LEA trust)

---

## Prompt 5 — „Beta na internete + pravda v dokumentácii“

**Backlog:** EPIC 11 — `S11.1`, `S11.2` · EPIC 13 (30 dní) · README produkcia

```
Si DevOps + tech writer pre ForenzDetectiv. Frontend dnes ide na Vercel (statický dist), API musí žiť samostatne — to ešte nie je hotové.

MISIA: Jedna klikateľná beta URL kde Sherlock reálne funguje (nie len mock E2E) + README/BACKLOG odrážajú realitu (Hono, nie Convex).

KONTEXT:
- Stack: Vite frontend, Hono API :5176, Prisma Postgres, Redis BullMQ, Mistral server-only
- docker-compose.yml: postgres + redis lokálne
- CI: .github/workflows/ci.yml — unit, integration (PG+Redis), e2e (chromium, Vite-only + API mock)
- playwright.config.ts — E2E mockuje /api/** v tests/e2e/fixtures.ts
- README tvrdí P0 hotové, BACKLOG má všetko TODO — nesúlad

IMPLEMENTUJ:
- Deploy návod + minimálna infra (vyber jeden stack, napr. Railway/Fly.io/Render):
  - Hono API + Postgres + Redis na jednom mieste
  - Frontend na Vercel s VITE_API_URL alebo Vite proxy len pre dev
- Dockerfile alebo railway.toml / fly.toml pre server (ak chýba — vytvor)
- GitHub Actions voliteľný deploy job (secrets: DATABASE_URL, REDIS_URL, MISTRAL_API_KEY) — aspoň dokumentovaný manual deploy
- Health check: /api/health v deploy skripte
- Sentry produkcia: dokumentuj VITE_SENTRY_DSN setup (kód už existuje)
- S11.2.6 + sync BACKLOG:
  - Označ DONE čo je hotové (S4.2–S4.5 Hono, S11.1 CI, PWA S6.3 čiastočne)
  - Odstráň odkazy na Convex/Base44 z aktívnych taskov
  - README: aktuálny router (/spisy nie /files), PostHog stav, deploy kroky
- E2E: pridaj voliteľný projekt „e2e-fullstack“ s webServer: [vite, tsx server] — len v CI integration job alebo dokumentovaný npm run test:e2e:full

ZÁKAZY:
- Žiadny login / OAuth deploy flow
- Žiadna monetizácia / Stripe docs prioritne
- Secrets nikdy do gitu

DEFINITION OF DONE:
- [x] docs/DEPLOY.md: krok za krokom beta deploy (frontend + API + PG + Redis)
- [x] README + BACKLOG synchronizované so skutočným stavom
- [x] curl /api/health funguje na staging URL (popísané v docs)
- [x] Existujúci CI zostáva zelený
- [x] .env.example aktualizovaný pre produkciu (ALLOWED_ORIGINS, DATABASE_URL, REDIS_URL)
```

**Odhad:** ~16–24 h · Posun MVP: **+12 %** (beta dostupnosť)

---

## Prompt 6 — „Alibi mapa + cross-exam v case detaile“

**Backlog:** EPIC 10 — `T10.2.2` · cross-exam UI

```
(Pozri Agent chat Prompt 6 — implementované)
```

DEFINITION OF DONE:
- [x] Alibi mapa viditeľná po geospatial checku (alebo jasný empty state)
- [x] Cross-exam UI generuje otázky s mockom v testoch; s kľúčom volá Mistral
- [x] Žiadny crash bez súradníc / bez API key
- [x] Component + unit testy zelené
- [x] npm run test:all prejde (docker compose up -d postgres redis pred tým)
- [x] BACKLOG S10.2 DONE

**Odhad:** ~16–24 h · Posun MVP: **+4–6 %**

---

## Odporúčané poradie (30 dní)

| Týždeň | Prompt                   | Prečo                              |
| ------ | ------------------------ | ---------------------------------- |
| 1      | **#1** Home              | Konverzia bez infra                |
| 1–2    | **#2** Analytics         | Meranie North Star                 |
| 2      | **#3** Sherlock história | Denné používanie                   |
| 3      | **#5** Deploy + docs     | Beta pre testerov                  |
| 4      | **#4** LEA trust         | Diferenciácia pred širším launchom |

---

## Čo zámerne nie je v promptoch

| Vylúčené               | Dôvod            |
| ---------------------- | ---------------- |
| EPIC 5 Monetizácia     | Tvoja požiadavka |
| Login / OAuth UI       | Tvoja požiadavka |
| EPIC 7 Lokalizácia CZ  | Až po SK beta    |
| EPIC 8 Marketing / Ads | Nie engineering  |
| S10.5 RAG              | P3, príliš veľké |

---

## Očakávaný posun po všetkých 5

| Metrika                     | Teraz    | Po 5 promptoch |
| --------------------------- | -------- | -------------- |
| Technické MVP               | ~70 %    | **~88–92 %**   |
| Beta-ready (reálni testeri) | ~50 %    | **~75 %**      |
| Celý BACKLOG                | ~25–30 % | **~40 %**      |

---

Ak chceš, v **Agent mode** môžem začať **Promptom #1** (Home) — je najrýchlejší win bez závislosti na deployi.

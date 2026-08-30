# 🔥 ForenzDetectiv — SUPER MEGA BACKLOG

> **Vízia:** Premeniť ForenzDetectiv na **najlepší forenzný nástroj na svete** — v spise, ktorý ste prečítali stokrát, nájdete rozpor za sekundu a uvidíte presné miesto, kde sa lúšti alibi.
>
> **North Star Metric:** `Weekly Active Investigators` s aspoň 1 `contradiction_viewed` — nie raw DAU.
>
> **Cieľ:** Top 10 Paid Productivity SK do 12 mesiacov.
>
> Tento dokument je živý backlog. Každá položka má prioritu (P0–P3), odhad (čas €), a status. Postupne ho premieňame na GitHub Issues / Jira tickets.

---

## 📊 Legenda

| Značka | Priorita | Význam |
|--------|----------|--------|
| **P0** | 🔴 Kritické | Ship blocker — bez toho nespustíme |
| **P1** | 🟡 Vysoká | Core produkt — treba pred launchom |
| **P2** | 🟢 Stredná | Monetizácia & store — po MVP |
| **P3** | 🔵 Nízka | Polish & docs — kontinuálne |

**Status:** `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED`

---

# 📦 EPIC 1 — Stabilita & Monitoring (P0)

> Bez stability niet dôvery. LEA (Law Enforcement Agencies) a advokáti nepoužijú nástroj, ktorý padá.

## S1.1 Sentry + ErrorBoundary + top 3 bugfix
- **Priorita:** P0
- **Odhad:** 80–120 h · 0–50 €
- **Status:** `DONE` (základná integrácia)

### Tasks
- [x] **T1.1.1** `@sentry/react` v dependencies
- [x] **T1.1.2** Globálny `<ErrorBoundary>` v `main.tsx`
- [x] **T1.1.3** `VITE_SENTRY_DSN` v `.env.example` + docs/DEPLOY.md
- [ ] **T1.1.4** Opraviť top 3 crash-y podľa crash reportov
- [x] **T1.1.5** Retry logika pre AI volania (`aiRetry.ts`)
- [ ] **T1.1.6** Bulk concurrency max 2

## S1.2 Odstrániť debug instrumentation z produkcie
- **Priorita:** P0
- **Odhad:** 1 h
- **Status:** `TODO`

### Tasks
- [ ] **T1.2.1** Odstrániť WebSocket probes z `vite.config.js`
- [ ] **T1.2.2** Odstrániť log ingest na `127.0.0.1:7743` z `src/main.jsx`
- [ ] **T1.2.3** Ponechať HMR config (`host: '127.0.0.1'`) — ten je OK
- [ ] **T1.2.4** Overiť, že produkčný build neobsahuje debug kód

## S1.3 PostHog EU live keys (RB-02)
- **Priorita:** P0
- **Odhad:** 1 h
- **Status:** `DONE` (kód + docs; live key v prod env)

### Tasks
- [ ] **T1.3.1** Získať PostHog EU Project API Key (ops)
- [x] **T1.3.2** `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` v `.env.example`
- [ ] **T1.3.3** Overiť live events v PostHog EU
- [x] **T1.3.4** Session recording vypnutý (GDPR)

## S1.4 Wire trackContradictionDetected na reálnu detekciu (RB-03)
- **Priorita:** P0
- **Odhad:** 2 h
- **Status:** `DONE`

### Tasks
- [x] **T1.4.1** `trackContradictionDetected` po úspešnej analýze (`SherlockPage`)
- [x] **T1.4.2** ~~Demo path~~ odstránené
- [x] **T1.4.3** Žiadne PII v properties (hash `caseId`)
- [x] **T1.4.4** `npm test` + lint/typecheck PASS

## S1.5 Audit log v2 — logAction() wire (RB audit)
- **Priorita:** P0
- **Odhad:** 2 h
- **Status:** `DONE`

### Tasks
- [x] **T1.5.1** `logAction()` pri: case create, alibi check, PDF export, HITL
- [x] **T1.5.2** `AuditLogViewer` v `/profil` a `/spisy/:id/audit`
- [x] **T1.5.3** Audit + server sync `/api/audit-logs`

---

# 🎨 EPIC 2 — UX/UI Excelencia (P0–P1)

> Onboarding, ktorý predáva hodnotu, nie slides.

## S2.1 Empty Home s 1-tap CTA
- **Priorita:** P0
- **Odhad:** 16–24 h
- **Status:** `DONE`

### Tasks
- [x] **T2.1.1** `HomePage.tsx` — CTA „Nahrať výpoveď“
- [x] **T2.1.3** Proof strip
- [ ] **T2.1.5** BulkScanButton farba (ak existuje)

## S2.2 canned spis
- **Priorita:** —
- **Status:** `REMOVED`

## S2.3 Onboarding — 3 slides → 1 tip
- **Priorita:** P1
- **Odhad:** 24–40 h
- **Status:** `TODO`

### Tasks
- [ ] **S2.3.1** Odstrániť blokujúci `WelcomeIntroModal` pri first visit
- [ ] **S2.3.2** Ponechať `QuickTip` ako jediný first-run UX
- [ ] **S2.3.3** Lazy-load views cez `Suspense` (code-split)
- [ ] **S2.3.4** Lazy-load Tesseract / jspdf (ťažké knižnice)

## S2.4 BulkScanButton label fix
- **Priorita:** P1
- **Odhad:** 0.5 h
- **Status:** `TODO`

### Tasks
- [ ] **T2.4.1** Zmeniť label z `≤100` na `≤20` na mobile (`BulkScanButton.jsx`)

## S2.5 Farbová schéma (UI + ASO align)
- **Priorita:** P1
- **Odhad:** 8 h
- **Status:** `TODO`

| Token | Hodnota | Použitie |
|-------|---------|----------|
| Background | slate-950 `#020617` | App shell, Play screenshots |
| Surface | slate-900 + white/5 border | Cards, panels |
| Primary CTA | amber-500 `#f59e0b` | Scan, export |
| Accent / links | blue-400 `#60a5fa` | Graf, entity chips |
| Danger / rozpor | red-500 `#ef4444` | Red flags, contradictions |
| Success | emerald-400 | Done, alibi OK |
| Text | slate-100 / slate-400 | Hierarchia |

- [ ] **T2.5.1** Odstrániť purple gradient z ikony (nízka rozpoznateľnosť v Play browse)

---

# 📊 EPIC 3 — Analytics & North Star (P0–P1)

> Čo nemeriaš, to nevieš zlepšiť.

## S3.1 PostHog 8 eventov + wiring
- **Priorita:** P0
- **Odhad:** 16–24 h · 0 €
- **Status:** `DONE`

### Kľúčové eventy
1. `case_created`
2. `contradiction_detected`
3. `contradiction_viewed`
4. `pdf_exported`
5. `alibi_checked`
6. `error_occurred`
7. `analysis_started`

### Tasks
- [x] **T3.1.1** 8 helperov v `src/lib/analytics.ts`
- [x] **T3.1.2** Wire `trackCaseCreated` v upload flow
- [x] **T3.1.3** Wire `trackAlibiChecked` + `trackPdfExported`
- [x] **T3.1.4** PII sanitizácia (email, IP → `[REDACTED]`)
- [x] **T3.1.5** Fallback na `console.log` keď PostHog nie je dostupný

## S3.2 UTM tracking bootstrap (RB-07)
- **Priorita:** P0
- **Odhad:** 4 h
- **Status:** `DONE`

### Tasks
- [x] **T3.2.1** `initUtmTracking()` v `App.tsx` na boote
- [ ] **T3.2.2** Legacy `MiniPlayground` / `LeadCaptureModal` — nahradené HomePage + QuickTip
- [x] **T3.2.3** UTM dáta v PostHog eventoch (`withUtm`)
- [ ] **T3.2.4** Lead capture backend — mimo scope (bez loginu)

## S3.3 Looker Studio North Star dashboard (RB-04)
- **Priorita:** P1
- **Odhad:** 2 h
- **Status:** `IN_PROGRESS`

### Tasks
- [x] **T3.3.1** Dokumentácia v `docs/LOOKER_POSTHOG.md`
- [ ] **T3.3.2** Scorecard: weekly unique users s `contradiction_viewed` (manuálny Looker setup)
- [ ] **T3.3.3** Funnel v Looker Studio
- [ ] **T3.3.4** Zdieľateľný link
- [ ] **T3.3.5** Dokumentovať v `docs/LOOKER_POSTHOG.md`

## S3.4 Automatizované alerty
- **Priorita:** P2
- **Odhad:** 4 h
- **Status:** `TODO`

### Tasks
- [ ] **T3.4.1** Alert: "Retention kleslo pod 30%" → Slack/Notion
- [ ] **T3.4.2** Alert: "Crash-free users < 99%" → Sentry
- [ ] **T3.4.3** Alert: "LLM 429 rate > 5%" → ops

---

# 🤖 EPIC 4 — Sherlock AI Analyzer (P0)

> Hlavný game-changer. PDF dnu → štruktúrovaná analýza von.

## S4.1 Sherlock — výber dokumentov (oboje)
- **Priorita:** P0
- **Odhad:** 24–40 h
- **Status:** `IN_PROGRESS` (upload hotový, sandbox nie)

### Tasks
- [ ] **T4.1.1** Prepínač zdroja: "Z môjho sandboxu" / "Nahrať nový"
- [ ] **T4.1.2** Zoznam sandbox súborov (owner-scoped query)
- [ ] **T4.1.3** Multi-selekcia súborov
- [x] **T4.1.4** Dropzone pre priamy PDF upload
- [x] **T4.1.5** Tlačidlo "Spustiť Sherlock analýzu" so stavmi + progress

## S4.2 Backend — Hono API `/api/analyze`
- **Priorita:** P0
- **Odhad:** 40–60 h
- **Status:** `DONE`

### Tasks
- [x] **T4.2.1** Auth middleware + owner scoping
- [x] **T4.2.2** Upload súborov do `uploads/`
- [x] **T4.2.3** Extrakcia textu (pdfjs-dist)
- [x] **T4.2.4** Mistral LLM + BullMQ fronta
- [x] **T4.2.5** JSON validácia (metadata, persons, evidence, relationships, timeline)
- [x] **T4.2.6** Uloženie do Prisma `analyses`

## S4.3 Databáza — `analyses` tabuľka
- **Priorita:** P0
- **Odhad:** 4 h
- **Status:** `DONE`

### Tasks
- [x] **T4.3.1** Polia: ownerId, name, data JSON, status, errorMessage, timestamps
- [x] **T4.3.2** Index by owner
- [x] **T4.3.3** Status filtering

## S4.4 Frontend — Timeline, osoby, dôkazy, vzťahy
- **Priorita:** P0
- **Odhad:** 40–60 h
- **Status:** `DONE`

### Tasks
- [x] **T4.4.1** Case layout + taby (rozpory, timeline, graf, osoby, audit)
- [x] **T4.4.2** Timeline chronologicky
- [x] **T4.4.3** Vyhľadávanie v timeline/rozpory
- [x] **T4.4.4** Karty osôb
- [x] **T4.4.5** Dôkazy v analýze
- [x] **T4.4.6** Graf vzťahov (`GrafTab`)
- [x] **T4.4.7** Detail eventov + bottom sheets

## S4.5 Sherlock — LLM systémový prompt (forenzný)
- **Priorita:** P0
- **Odhad:** 4 h
- **Status:** `DONE`

### Tasks
- [x] **T4.5.1** `sherlockPrompt.ts`
- [x] **T4.5.2** JSON schéma
- [x] **T4.5.3–T4.5.7** confidence, source_text, temperature 0.3

## S4.6 Sherlock — história uložených analýz
- **Priorita:** P1
- **Odhad:** 8 h
- **Status:** `DONE`

### Tasks
- [x] **T4.6.1** GET `/api/analyses`
- [x] **T4.6.2** GET `/api/analyses/:id`
- [x] **T4.6.3** PATCH rename
- [x] **T4.6.4** DELETE
- [x] **T4.6.5** Nedávne analýzy na `/sherlock`

---

# 💳 EPIC 5 — Monetizácia (P2)

> Freemium + predplatné. Niche Top 10 Paid.

## S5.1 Stripe live `createCheckoutSession` (RB-05)
- **Priorita:** P2
- **Odhad:** 3 h
- **Status:** `TODO`

### Tasks
- [ ] **T5.1.1** Vytvoriť backend funkciu `createCheckoutSession` (vráti `{ id }`)
- [ ] **T5.1.2** S `VITE_STRIPE_PUBLIC_KEY` → `redirectToCheckout`
- [ ] **T5.1.3** Bez kľúča ostáva test mode + banner v `PricingModal`
- [ ] **T5.1.4** Aktualizovať `docs/STRIPE_SETUP.md`
- [ ] **T5.1.5** Secrets v Railway/Vercel env, nie v gite

## S5.2 Paywall — `canCreateCase` enforcement
- **Priorita:** P2
- **Odhad:** 4 h
- **Status:** `TODO`

### Tasks
- [ ] **T5.2.1** Zavolať `canCreateCase()` pri vytváraní nového spisu
- [ ] **T5.2.2** Free limit: max 5 spisov
- [ ] **T5.2.3** Paywall blokuje > limit s CTA na Pro

## S5.3 Referral rewards
- **Priorita:** P2
- **Odhad:** 4 h
- **Status:** `TODO`

### Tasks
- [ ] **T5.3.1** Generovanie referral linku (`ReferralModal`)
- [ ] **T5.3.2** Logika: +30 dní Pro pri konverzii pozvaného
- [ ] **T5.3.3** Agency: 1 free seat pri 3 paid

## S5.4 Pro tier + pricing
- **Priorita:** P2
- **Odhad:** 2 h
- **Status:** `TODO`

| Tier | Cena | Limity |
|------|------|--------|
| Free | 0 € | 5 spisov, 10 analýz/mes |
| Pro | 9.99 €/mes | neobmedzene, PDF export, alibi mapa |
| Agency | 49 €/mes | 5 sedačiek, shared cases, audit log |

---

# 📱 EPIC 6 — PWA / TWA / Play Store (P2)

> Top 10 Paid Productivity SK.

## S6.1 TWA Bubblewrap projekt (RB-06)
- **Priorita:** P2
- **Odhad:** 1 h
- **Status:** `TODO`

### Tasks
- [ ] **T6.1.1** Vytvoriť Android Bubblewrap projekt
- [ ] **T6.1.2** Nahradniť `REPLACE_WITH_UPLOAD_KEY_SHA256` v `assetlinks.json` reálnym fingerprintom z keystore
- [ ] **T6.1.3** Pridať PNG 512 maskable ikony (nielen SVG)
- [ ] **T6.1.4** Overiť Digital Asset Links verification (Chrome / Play)
- [ ] **T6.1.5** Dokumentovať v `docs/TWA_SETUP.md`

## S6.2 ASO optimalizácia
- **Priorita:** P2
- **Odhad:** 24–40 h · 25 € (design)
- **Status:** `TODO`

### Tasks
- [ ] **T6.2.1** Title (30 zn): "ForenzDetectiv: AI rozpory"
- [ ] **T6.2.2** Short desc: "Najdi rozpory vo výpovediach a nemožné alibi — AI so zdrojovým citátom."
- [ ] **T6.2.3** Long description (HOOK → PROOF → FEATURES → CTA → TRUST)
- [ ] **T6.2.4** Ikona: slate `#0f172a` + amber akcent, čitateľná 48px
- [ ] **T6.2.5** Screenshots: 1 Rozpor · 2 Alibi mapa · 3 Graf · 4 Scan · 5 PDF
- [ ] **T6.2.6** A/B test title + ikona

### 10 kľúčových slov (SK long-tail)
1. analýza výpovedí
2. detekcia rozporov
3. vyšetrovací spis
4. forenzná analýza
5. kontrola alibi
6. graf vzťahov
7. AI pre vyšetrovateľov
8. digitálna kartotéka
9. skenovanie dokumentov
10. rozpory vo svedectvách

## S6.3 PWA manifest + service worker
- **Priorita:** P2
- **Odhad:** 4 h
- **Status:** `DONE` (čiastočne)

### Tasks
- [x] **T6.3.1** `manifest.json` + vite-plugin-pwa
- [x] **T6.3.2** Service worker (workbox cache)
- [ ] **T6.3.3** PWA kamera prístup

---

# 🌍 EPIC 7 — Lokalizácia (P2–P3)

> CZ + PL = 3x trh.

## S7.1 CZ lokalizácia
- **Priorita:** P2
- **Odhad:** 60–80 h · 200 € (preklad)
- **Status:** `TODO`

### Tasks
- [ ] **T7.1.1** Rozšíriť `cs.json` slovník (z ~5% na 50%+ UI coverage)
- [ ] **T7.1.2** Migrovať `ForenzDetectiv.jsx` na `t()`
- [ ] **T7.1.3** Migrovať `HomeHero.jsx` na `t()`
- [ ] **T7.1.4** Migrovať modals na `t()`
- [ ] **T7.1.5** CZ Play listing
- [ ] **T7.1.6** CZ PDF export

## S7.2 PL soft launch
- **Priorita:** P3
- **Odhad:** 80 h
- **Status:** `TODO`

### Tasks
- [ ] **T7.2.1** `pl.json` slovník
- [ ] **T7.2.2** PL Play listing
- [ ] **T7.2.3** PL sample case (nie canned SK spis)

## S7.3 3 jazyky s najväčším potenciálom
1. **čeština** (CZ — najbližšia, nízka bariéra)
2. **poľština** (PL — 38M obyvateľov)
3. **angličtina** (EN — globálny potenciál)

---

# 📈 EPIC 8 — Marketing & Rast (P2–P3)

## S8.1 Organický rast (70% úsilia)
- **Priorita:** P2
- **Odhad:** 15–20 h/týždeň · 0–150 €/mes
- **Status:** `TODO`

### Tasks
- [ ] **T8.1.1** LinkedIn 3x/týždeň (pravnícka komunita)
- [ ] **T8.1.2** YouTube Shorts: alibi/rozpor 15s videá
- [ ] **T8.1.3** Infografika: "Checklist forenznej analýzy"
- [ ] **T8.1.4** Facebook právnické skupiny
- [ ] **T8.1.5** Webinar: analýza spisov
- [ ] **T8.1.6** SharedCase CTA loop
- [ ] **T8.1.7** Podcast outreach (true-crime, právo)

## S8.2 Platený rast (500–1000 €/mes)
- **Priorita:** P2
- **Odhad:** 20 h/mes · 3000–6000 €/6mes
- **Status:** `TODO`

### Tasks
- [ ] **T8.2.1** Google UAC 50% rozpočtu
- [ ] **T8.2.2** Search kampane 20% ("forenzná analýza", "rozpory výpovedí")
- [ ] **T8.2.3** LinkedIn job titles 20% (detektív, vyšetrovateľ, advokát)
- [ ] **T8.2.4** Creative test 10%
- [ ] **T8.2.5** Optimalizácia na `contradiction_viewed` event, nie install
- [ ] **T8.2.6** Retarget D+1, D+14 churn
- [ ] **T8.2.7** Kill-CPI threshold (business rozhodnutie)
- [ ] **T8.2.8** Dokumentovať v `docs/GOOGLE_ADS.md`

## S8.3 Virálnosť & word-of-mouth
- **Priorita:** P2
- **Odhad:** 40–60 h
- **Status:** `TODO`

### Tasks
- [ ] **T8.3.1** Alibi Impossible share card (PNG pre LinkedIn)
- [ ] **T8.3.2** Referral: "Pozvi kolegu: +1 mes Pro / 14d trial"
- [ ] **T8.3.3** Gamifikácia: badges (First Contradiction, Alibi Buster, Case Closed)
- [ ] **T8.3.4** PR: tech blogy (TechCrunch SK, Android Authority, Živě.cz)

## S8.4 Beta 100 + segmented (RB-07)
- **Priorita:** P2
- **Odhad:** 40 h + calls
- **Status:** `TODO`

### Tasks
- [ ] **T8.4.1** Zoznam ~100 beta (LEA, advokáti, investigátori)
- [ ] **T8.4.2** Invite flow
- [ ] **T8.4.3** Overiť: `lead_captured` / `case_created` v PostHog s `utm_source`
- [ ] **T8.4.4** Feedback loop (Notion / formulár)

---

# 🔐 EPIC 9 — LEA Trust Pack (P2)

> Dôvera pre Law Enforcement Agencies.

## S9.1 Trust Pack modal + whitepaper
- **Priorita:** P2
- **Odhad:** 16 h
- **Status:** `TODO`

### Tasks
- [ ] **T9.1.1** `TrustPackModal` wired
- [ ] **T9.1.2** Whitepaper ako PDF (nie `.txt`)
- [ ] **T9.1.3** RLS (Row Level Security) dokumentácia
- [ ] **T9.1.4** Rate limit dokumentácia

## S9.2 Audit log v2
- **Priorita:** P2
- **Odhad:** 24 h
- **Status:** `DONE`

### Tasks
- [x] **T9.2.1** `logAction()` pri PDF export, alibi check, HITL confirm/dismiss
- [x] **T9.2.2** `AuditLogViewer` v `/profil` a `/spisy/:id/audit`
- [ ] **T9.2.3** Export audit logu (PDF/CSV)
- [x] **T9.2.4** „Rozhodnutia ostávajú na vás — AI len navrhuje“

## S9.3 Court PDF s SHA-256 hash
- **Priorita:** P2
- **Odhad:** 40–60 h
- **Status:** `DONE`

### Tasks
- [x] **T9.3.1** `dossierExport.ts` + `courtDossier.ts`
- [x] **T9.3.2** SHA-256 hash protokolu (Web Crypto API)
- [x] **T9.3.3** `PdfExportDialog.tsx` v CaseHeader
- [ ] **T9.3.4** Export options: citácie, mapa, audit log

---

# 🧩 EPIC 10 — Game-Changer Funkcie (P2–P3)

> 3 must-have + 1 Wow.

## S10.1 Cross-doc rozpory s `source_quote` (must-have)
- **Priorita:** P2
- **Odhad:** 40 h
- **Status:** `TODO`

### Tasks
- [ ] **T10.1.1** Detekcia rozporov medzi dokumentami
- [ ] **T10.1.2** `source_quote` s citátom zo zdroja (strana, dokument)
- [ ] **T10.1.3** Vizuálne prepojenie rozpor → zdroj

## S10.2 SK geospatial alibi (must-have)
- **Priorita:** P2
- **Odhad:** 40 h
- **Status:** `DONE`

### Tasks
- [x] **T10.2.1** Haversine formula (`geospatialEngine.ts`)
- [x] **T10.2.2** Mapa s alibi bodmi (vizualizácia) — SVG `AlibiMap` v RozporyTab
- [x] **T10.2.3** Časová konzistencia — UI v `RozporyTab` + `/api/geospatial/check`

## S10.3 Graf vzťahov + PageRank (must-have)
- **Priorita:** P2
- **Odhad:** 40 h
- **Status:** `DONE`

### Tasks
- [x] **T10.3.1** Grafová reprezentácia vzťahov (`GrafTab`)
- [x] **T10.3.2** PageRank badge na uzloch
- [x] **T10.3.3** Interaktívny graf (drag, zoom)

## S10.4 Alibi Impossible share card (WOW)
- **Priorita:** P2
- **Odhad:** 16 h
- **Status:** `DONE`

### Tasks
- [x] **T10.4.1** `AlibiShareCard` + bottom sheet v RozporyTab
- [x] **T10.4.2** PNG export (`shareCardPng.ts`)
- [x] **T10.4.3** Virálny CTA text na karte

## S10.5 Sherlock RAG (future)
- **Priorita:** P3
- **Odhad:** 80 h
- **Status:** `TODO`

### Tasks
- [ ] **T10.5.1** Retrieval-Augmented Generation nad spismi
- [ ] **T10.5.2** Q&A: "Kedy bol Ján Novák v bance?"
- [ ] **T10.5.3** Citácia zdroja v každej odpovedi

---

# 📚 EPIC 11 — Dokumentácia & CI/CD (P3)

## S11.1 GitHub Actions CI
- **Priorita:** P0
- **Odhad:** 4 h
- **Status:** `DONE`

### Tasks
- [x] **S11.1.1** GitHub Actions workflow
- [x] **S11.1.2** Workflow: `test → lint → typecheck → build`
- [x] **S11.1.3** Integration job (Postgres + Redis)
- [x] **S11.1.4** Playwright e2e (chromium, mock API)

## S11.2 Dokumentácia
- **Priorita:** P3
- **Odhad:** kontinuálne
- **Status:** `IN_PROGRESS`

### Tasks
- [x] **T11.2.1** `docs/LOOKER_POSTHOG.md`
- [ ] **T11.2.2** `docs/GOOGLE_ADS.md`
- [ ] **T11.2.3** `docs/STRIPE_SETUP.md`
- [ ] **T11.2.4** `docs/TWA_SETUP.md`
- [ ] **T11.2.5** `docs/ASO_METADATA.md`
- [x] **T11.2.6** `README.md` + `docs/DEPLOY.md` synchronizované so stavom (Hono, /spisy, deploy)

## S11.3 Nástrojový stack

| Oblasť | Nástroj | Cena/mes | Na čo |
|--------|---------|----------|-------|
| Analytics | PostHog (EU) | 0–450 € | Funnels, retention, events |
| Crashes | Sentry | 0–26 € | Errors, performance, alerts |
| Dashboard | Looker Studio | 0 | 1 command center |
| Ads | Google Ads + Play Console | 500–1000 € | UAC, ASO experiments |
| Email/Push | OneSignal / Firebase | 0–50 € | Lifecycle D+1/D+3 |
| Revenue | Stripe (+ RevenueCat pri IAP) | 2.9%+ | Pro, Agency |
| Design | Figma + Canva | 0–15 € | Screenshots, wireframes |
| CI/QA | GitHub Actions + Playwright | 0 | npm test, e2e |
| ASO research | AppTweak / manual | 0–100 € | Keyword volume SK/CZ |
| Comms | Slack + Notion | 0–20 € | Alerty, roadmap, beta feedback |

---

# 🎯 EPIC 12 — KPI & Metriky (P3)

## S12.1 KPI ciele (baseline doplniť)

| Metrika | Baseline `[DOPLN]` | Cieľ 6 mes. | Cieľ 12 mes. |
|---------|-------------------|-------------|--------------|
| Stiahnutia | `[DOPLN]` | 50 000 | 150 000 |
| MAU | `[DOPLN]` | 2 000 | 8 000 |
| D7 retention | `[DOPLN]` | 18% | 22% |
| Demo to contradiction | `[DOPLN]` | 45% | 55% |
| Free to Pro | `[DOPLN]` | 3% | 5% |
| MRR | `[DOPLN]` | 500 € | 3 000 € |
| Play rating | `[DOPLN]` | 4.5 (200 reviews) | 4.6 (400) |
| Crash-free | `[DOPLN]` | 99.5% | 99.8% |

## S12.2 KPI tabuľka s akciami

| Metrika | Cieľ | Nástroj | Akcia pri zlyhaní |
|---------|------|---------|-------------------|
| DAU/MAU | >20% | PostHog | Zlepšiť retention |
| Retention (Day 7) | >40% | PostHog | Optimalizovať onboarding |
| CTR | >5% | Google Ads | A/B testovať reklamy |
| ARPU | 0.50€+ | Stripe | Pridať premium funkcie |
| Crash-Free Users | >99% | Sentry | Opraviť kritické chyby |

---

# 🚀 EPIC 13 — Akčný plán 30/60/90 dní

## Prvých 30 dní (Rýchle víťazstvá) — P0
- [ ] Opraviť top 3 chyby podľa crash reportov (Sentry)
- [ ] A/B testovať nový popis a ikonu na Google Play
- [ ] Spustiť beta test so 100 užívateľmi a zozbierať feedback
- [ ] Odstrániť debug instrumentation
- [ ] Wire PostHog 8 eventov + UTM
- [ ] Wire audit logging
- [ ] Move `@sentry/react` + `posthog-js` do `dependencies`
- [ ] Sherlock analyzer MVP (upload → analýza → timeline)

**Odhad:** ~80–120 h · 0–50 €

## 60 dní (Stredné ciele) — P1–P2
- [ ] Pridať 1 "Wow" funkciu (Alibi Impossible share card)
- [ ] Spustiť influencer kampaň s 3 mikro-influencermi (300–600 €)
- [ ] Optimalizovať onboarding podľa analýzy drop-offov
- [ ] Pro tier Stripe + referral invite
- [ ] CZ lokalizácia UI + Play listing
- [ ] Looker North Star dashboard

**Odhad:** ~100 h · 300–600 €

## 90 dní (Dlhodobý rast) — P2–P3
- [ ] Lokalizovať do 2 nových jazykov (CZ + PL)
- [ ] Spustiť platenú kampaň na Google Ads s rozpočtom 1 000 €
- [ ] Získať 1 000+ recenzií (4.5+ hviezdičiek)
- [ ] TWA Bubblewrap + Play Store live
- [ ] Agency pilot 1
- [ ] Court PDF s SHA-256 hash

**Odhad:** ~120 h · 1 000 €+ ads

---

# ⚠️ EPIC 14 — Riziká & Riešenia

| Riziko | Pravdep. (1-5) | Vplyv (1-5) | Riešenie |
|--------|----------------|-------------|----------|
| Nízka retencia | 4 | 5 | Zlepšiť onboarding + push notifikácie |
| Konkurencia kopíruje USP | 3 | 4 | Rýchlo pridať nové funkcie |
| Nízky rozpočet | 5 | 3 | Zamerať sa na organický rast |
| Technické problémy | 2 | 5 | Investovať do QA testovania |
| Cloud AI nedôvera (LEA) | 3 | 5 | On-prem roadmap, RLS, audit log |
| Mistral 429 rate limit | 3 | 4 | Retry s exponential backoff, queue |
| Negatívne recenzie po unready launch | 2 | 5 | Beta 100 pred launchom |

---

# 📋 Prioritizovaný zoznam úloh (Top → Bottom)

| # | Úloha | Epic | Priorita | Čas | € |
|---|------|------|----------|-----|---|
| 1 | Odstrániť debug instrumentation | S1.2 | P0 | 1h | 0 |
| 2 | Sentry + ErrorBoundary + bugfix | S1.1 | P0 | 80-120h | 0-50 |
| 3 | Wire UTM + PostHog | S3.1, S3.2 | P0 | 20h | 0 |
| 4 | Wire audit logging | S1.5, S9.2 | P0 | 2h | 0 |
| 5 | PostHog EU live keys | S1.3 | P0 | 1h | 0 |
| 6 | Wire trackContradictionDetected | S1.4 | P0 | 2h | 0 |
| 7 | Sherlock analyzer MVP | S4.1–S4.6 | P0 | 120h | 0 |
| 8 | GitHub Actions CI green | S11.1 | P0 | 4h | 0 |
| 9 | Empty Home + 1-tap CTA | S2.1 | P0 | 24h | 0 |
| 10 | ~~canned spis~~ | S2.2 | — | — | removed |
| 11 | Onboarding 1 tip + lazy-load | S2.3 | P1 | 32h | 0 |
| 12 | BulkScanButton label | S2.4 | P1 | 0.5h | 0 |
| 13 | TWA + ASO + ikona | S6.1, S6.2 | P2 | 40h | 25 |
| 14 | LEA trust pack + beta 100 | S9.1, S8.4 | P2 | 56h | 0 |
| 15 | CZ lokalizácia + Play listing | S7.1 | P2 | 70h | 200 |
| 16 | Pro tier Stripe + referral | S5.1–S5.3 | P2 | 11h | 0 |
| 17 | PostHog + Looker dashboard | S3.3 | P1 | 24h | 0 |
| 18 | Alibi Impossible share card (wow) | S10.4 | P2 | 16h | 0 |
| 19 | Google Ads 500-1000 € s kill CPI | S8.2 | P2 | 20h/mes | 3000-6000 |
| 20 | Court PDF + SHA-256 | S9.3 | P2 | 50h | 0 |

---

# 💰 Odhad nákladov a času (súčet 6 mesiacov)

| Aktivita | Čas | Náklady (€) | Kedy |
|----------|-----|-------------|------|
| Stabilita + Sentry + bugfix | 80-120 h | 0-50 | M1 |
| Demo spis + UX Home | 40-60 h | 0 | M1 |
| Play TWA + ASO + ikona | 24-40 h | 25 | M1 |
| Analytics + Looker | 16-24 h | 0 | M1 |
| Beta 100 + trust pack | 40 h + calls | 0 | M1-2 |
| Onboarding + lazy load | 24-40 h | 0 | M2 |
| Alibi share + Pro Stripe | 40-60 h | 0 | M2 |
| Influencer 3x | 10 h | 300-600 | M2 |
| CZ lokalizácia | 60-80 h | 200 | M4 |
| Google Ads 6 mes. | 20 h/mes | 3000-6000 | M2-7 |
| PL + Agency sales | 80 h | 500 | M5-6 |
| Sherlock analyzer MVP | 120 h | 0 | M1 |

**Celkom:** ~500–700 h (founder + občasný contractor) · **4 000–8 000 €** pri 500 €/mes ads.

---

# 🎯 USP veta (vsade)

> **"V spise, ktorý ste prečítali stokrát, nájdete rozpor za sekundu — a uvidíte presné miesto, kde sa lúšti alibi."**

# 🧭 North Star

> **Weekly Active Investigators** s aspoň 1 `contradiction_viewed` — nie raw DAU.
> Cieľ: Top 10 Paid Productivity SK, nie free chart proti ChatGPT.

---

*Posledná aktualizácia: 2026-08-16*
*Stav: Živý dokument — aktualizovať po každom sprinte.*

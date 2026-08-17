# 🔍 ForenzDetectiv

> **V spise, ktorý ste prečítali stokrát, nájdete rozpor za sekundu — a uvidíte presné miesto, kde sa lúšti alibi.**

AI forenzný analyzátor, ktorý z PDF dokumentov extrahuje osoby, dôkazy, vzťahy a chronologickú časovú os — a nájde rozpory vo výpovediach s citátom zo zdroja, nie s dohadom.

**North Star:** Weekly Active Investigators s aspoň 1 `contradiction_viewed`.
**Cieľ:** Top 10 Paid Productivity SK do 12 mesiacov.

---

## 🚀 Rýchly štart

### Požiadavky
- Node.js 22+
- npm 10+

### Inštalácia

```bash
git clone https://github.com/you640/4LIBI.git
cd 4LIBI
npm install
```

### Vývojový server

```bash
npm run dev
```

Aplikácia beží na `http://127.0.0.1:5173/`.

### Build

```bash
npm run build      # TypeScript + Vite build
npm run preview    # Náhľad produkčného buildu
```

### Typecheck

```bash
npm run typecheck
```

---

## 🔧 Environment premenné

Skopíruj `.env.example` do `.env` a vyplň hodnoty:

```bash
cp .env.example .env
```

| Premenná | Kde | Účel | Povinné |
|----------|-----|------|---------|
| `MISTRAL_API_KEY` | Convex env | Sherlock AI analýza (LLM) | Áno (pre reálnu analýzu) |
| `VITE_POSTHOG_KEY` | `.env` | PostHog EU analytics | Nie (fallback na console.log) |
| `VITE_POSTHOG_HOST` | `.env` | PostHog EU host | Nie (default `eu.i.posthog.com`) |
| `VITE_SENTRY_DSN` | `.env` | Sentry error monitoring | Nie (no-op bez DSN) |
| `VITE_SENTRY_ENV` | `.env` | Sentry environment | Nie (default: `production`) |
| `VITE_STRIPE_PUBLIC_KEY` | `.env` | Stripe Checkout (monetizácia) | Nie (test mode bez kľúča) |

**Bez kľúčov** aplikácia funguje s demo spisom (BA-KE alibi). Sentry a PostHog sú tichý no-op.

---

## 📱 PWA — Add to Home Screen (iPhone 17 Air)

Aplikácia je mobile-first s `100dvh` a `safe-area-inset`. PWA manifest je v `public/manifest.json`.

**Na iPhone:** Safari → Zdieľať → Pridať na plochu.

---

## 📂 Štruktúra projektu

```
4LIBI/
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI (typecheck + build)
├── convex/                            # Backend (Convex)
│   ├── schema.ts                      # Databázová schéma (files, analyses)
│   ├── analyses.ts                    # Queries/mutations pre analyses (owner-scoped)
│   └── analyze.ts                     # Node action: PDF → text → Mistral → JSON → DB
├── public/
│   ├── manifest.json                  # PWA manifest
│   └── icon.svg                       # App ikona (slate/amber)
├── src/
│   ├── components/
│   │   ├── AppLayout.tsx              # App shell + bottom navigation
│   │   ├── ErrorBoundary.tsx          # Globálny ErrorBoundary (Sentry)
│   │   ├── Icons.tsx                  # Inline SVG ikony
│   │   ├── share/
│   │   │   └── AlibiShareCard.tsx      # Virálna share karta (Alibi Impossible)
│   │   └── sherlock/
│   │       ├── SherlockAnalyzer.tsx   # Výber dokumentov (sandbox/upload)
│   │       └── SherlockResults.tsx    # Timeline, osoby, dôkazy, vzťahy
│   ├── lib/
│   │   ├── analytics.ts               # PostHog 8 eventov + PII sanitizácia
│   │   ├── auditLog.ts                # Audit log v2 (LEA compliance)
│   │   ├── mistralApi.ts              # Mistral API helper s retry (429)
│   │   ├── pdfParser.ts               # pdfjs-dist extrakcia textu z PDF
│   │   ├── sentry.ts                  # Sentry inicializácia
│   │   ├── sherlockPrompt.ts          # Forenzný systémový prompt + JSON validácia
│   │   └── utmTracker.ts              # UTM tracking bootstrap
│   ├── pages/
│   │   ├── HomePage.tsx               # Hero s 1-tap CTA + demo spis
│   │   ├── SherlockPage.tsx           # Analyzátor + results kontajner
│   │   ├── FilesPage.tsx              # Moje spisy (placeholder)
│   │   └── ProfilePage.tsx            # Profil a nastavenia (placeholder)
│   ├── App.tsx                        # Router + init (UTM, PostHog)
│   ├── main.tsx                       # Entry point (Sentry + ErrorBoundary)
│   ├── types.ts                       # Analysis typy + demo dáta (BA-KE alibi)
│   ├── index.css                      # Tailwind + 100dvh + safe-area
│   └── vite-env.d.ts                  # Vite env typy
├── .env.example                       # Environment premenné
├── BACKLOG.md                         # SUPER MEGA BACKLOG (14 epics)
├── index.html                         # HTML entry (meta tags, theme-color)
├── package.json
├── tailwind.config.js                 # Design tokens (slate/amber)
├── tsconfig.json
└── vite.config.ts
```

---

## ✨ Funkcie

### Sherlock AI Analyzer
- **Výber dokumentov** — z sandboxu alebo priamy upload (PDF, TXT, DOCX)
- **PDF → text** — extrakcia cez `pdfjs-dist` (Node.js kompatibilný)
- **Mistral API** — forenzný systémový prompt, `temperature: 0.3`, retry pri 429
- **JSON validácia** — required keys: metadata, persons, evidence, relationships, timeline
- **Časová os** — chronologicky zoradená, vyhľadávanie v `source_text`
- **Rozpory** — farebne označené (červená), alibi (modrá)
- **Alibi Impossible share card** — virálna karta pre LinkedIn/sociálne siete

### Stabilita & Monitoring
- **Sentry** — ErrorBoundary + `captureException`, GDPR-compliant (replay vypnutý)
- **PostHog EU** — 8 eventov, PII sanitizácia, fallback na console.log
- **UTM tracking** — zachytávanie kampaní z URL
- **Audit log** — LEA compliance (kto, čo, kedy)

### UX/UI
- **100dvh** — dynamic viewport height (rieši mobile address bar)
- **safe-area-inset** — notch/dynamic island (iPhone 17 Air)
- **Bottom navigation** — Domov, Sherlock, Spisy, Profil
- **Slate/amber** — design tokens podľa `BACKLOG.md` S2.5

---

## 📊 Stav projektu

### ✅ Hotové (P0 — ship blockers)
Všetkých 14 P0 issues uzavretých. Pozri [Issues](https://github.com/you640/4LIBI/issues?q=is%3Aissue+is%3Aclosed).

| # | Issue | Epic |
|---|-------|------|
| #1 | Odstrániť debug instrumentation | Stabilita |
| #2 | Sentry + ErrorBoundary | Stabilita |
| #3 | PostHog EU live keys | Analytics |
| #4 | Wire trackContradictionDetected | Analytics |
| #5 | Audit log v2 | Stabilita |
| #6 | Empty Home s 1-tap CTA | UX |
| #7 | PostHog 8 eventov | Analytics |
| #8 | UTM tracking bootstrap | Analytics |
| #9 | Sherlock — výber dokumentov | Sherlock |
| #10 | Backend — Convex analyze | Sherlock |
| #11 | Databáza — analyses | Sherlock |
| #12 | Frontend — Timeline | Sherlock |
| #13 | LLM systémový prompt | Sherlock |
| #14 | GitHub Actions CI | CI/CD |

### 📋 Čo ostáva (P1–P3)
Kompletný zoznam v [BACKLOG.md](./BACKLOG.md) — 14 epics, ~100 taskov.

**Najbližšie (P1):**
- S2.2 — Demo spis BA-KE aha moment
- S2.3 — Onboarding 1 tip + lazy-load
- S3.3 — Looker Studio North Star dashboard
- S4.6 — Sherlock história uložených analýz

---

## 🔗 Odkazy

- [BACKLOG.md](./BACKLOG.md) — SUPER MEGA BACKLOG (14 epics)
- [Issues](https://github.com/you640/4LIBI/issues) — GitHub Issues tracker
- [CI](https://github.com/you640/4LIBI/actions) — GitHub Actions

---

## 🛠️ Tech stack

| Vrstva | Technológia |
|--------|-------------|
| Frontend | React 18 + TypeScript 5 + Vite 5 |
| Štýly | Tailwind CSS 3 (custom design tokens) |
| Routing | React Router 6 |
| Backend | Convex (schema, queries, mutations, node actions) |
| PDF parsing | pdfjs-dist |
| AI / LLM | Mistral API (mistral-large-latest) |
| Error monitoring | Sentry (`@sentry/react`) |
| Analytics | PostHog EU (`posthog-js`) |
| CI/CD | GitHub Actions |

---

*ForenzDetectiv — AI, ktorá v spise nájde rozpor a nemožné alibi. Rozhodnutia ostávajú na vás.*

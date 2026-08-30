# ForenzDetectiv

> V spise, ktorý ste prečítali stokrát, nájdete rozpor za sekundu — a uvidíte presné miesto, kde sa lúšti alibi.

**ForenzDetectiv** je Progressive Web App (PWA) pre forenznú analýzu výpovedí. Z PDF/TXT extrahuje osoby, dôkazy, vzťahy a chronologickú os, deteguje **rozpory** a **nemožné alibi** (vrátane geospatial overenia a mapy), pripraví **cross-exam** otázky a umožní export súdneho protokolu so SHA-256 hashom.

**North Star:** Weekly Active Investigators s aspoň 1× `contradiction_viewed` (PostHog EU).

**Princíp dôvery:** *AI len navrhuje — rozhodnutia ostávajú na vás.*

---

## Prehľad (Overview)

| Schopnosť | Popis |
|-----------|--------|
| Sherlock AI | Upload dokumentov → BullMQ fronta → Mistral (server) → Postgres |
| Rozpory + HITL | Potvrdenie / zamietnutie rozporov s audit trail |
| Alibi | Geospatial check + SVG mapa bodov A/B |
| Cross-exam | Otázky cez `/api/cross-exam` (Mistral alebo lokálne šablóny) |
| LEA trust | Audit log, Markdown/PDF export, PageRank graf, PNG share karta |
| **PWA** | Inštalovateľná aplikácia, precache assetov, auto-update SW |

### PWA funkcie

| Funkcia | Stav |
|---------|------|
| Web App Manifest | Áno (`vite-plugin-pwa` + `public/manifest.json`) |
| Service Worker | Áno (Workbox, `registerType: autoUpdate`) |
| Inštalácia (Add to Home Screen) | Áno — `display: standalone` |
| Offline UI shell | Áno — precache JS/CSS/HTML/ikony |
| Offline Sherlock analýza | **Nie** — vyžaduje Hono API + `MISTRAL_API_KEY` |

---

## Technický stack

| Vrstva | Technológia |
|--------|-------------|
| UI | React 18, TypeScript, React Router 7, Tailwind CSS 3 |
| Build | Vite 7, `vite-plugin-pwa`, Workbox 7 |
| API | **Hono** (`@hono/node-server`), port `5176` |
| Dáta | Prisma 7 + PostgreSQL (`pg` adapter) |
| Fronta | BullMQ + Redis (ioredis) |
| AI | Mistral API (**server-only**, žiadne `VITE_MISTRAL_*`) |
| Offline cache | IndexedDB cez `idb` (`src/lib/db.ts`) — výsledky analýz |
| Analytics | PostHog EU (`posthog-js`) + console fallback |
| Monitoring | Sentry (`@sentry/react`) |
| Testy | Vitest 4, Testing Library, Playwright |
| CI | GitHub Actions |
| Deploy | Vercel (frontend) + Railway (API + PG + Redis) |

> Backend je **Hono + Prisma**, nie Convex ani Base44.

---

## Inštalácia a spustenie

### Požiadavky

- **Node.js 22+**
- Platné `DATABASE_URL` a `REDIS_URL` (Railway cloud alebo vlastný Postgres + Redis)

### Lokálny vývoj

```bash
git clone https://github.com/you640/4LIBI.git
cd 4LIBI
npm install
cp .env.example .env
# Doplň DATABASE_URL, REDIS_URL, MISTRAL_API_KEY, JWT_SECRET, API_KEY
node scripts/test-cloud-db.mjs   # overenie PG + Redis
npm run dev
```

`npm run dev` spustí súčasne API (`tsx watch server/index.ts`) a Vite. Pred štartom `predev` uvoľní porty `5175`/`5176` a overí DB (`scripts/ensure-db.mjs`).

| Služba | URL |
|--------|-----|
| Frontend (Vite) | http://127.0.0.1:5175 |
| API (Hono) | http://127.0.0.1:5176 |
| Health | http://127.0.0.1:5176/api/health |

Lokálne **nepotrebujete** `VITE_API_URL` — Vite proxy mapuje `/api` → `http://127.0.0.1:5176`.

### Užitočné skripty

| Príkaz | Účel |
|--------|------|
| `npm run dev` | API + web (dev) |
| `npm run build` | `tsc -b` + produkčný Vite build (`dist/`) |
| `npm run preview` | Náhľad buildu (port 4173) |
| `npm run test:all` | `pretest:all` (`check-env`) → unit/api/components → integration → e2e |
| `npm run test:e2e:full` | E2E proti reálnemu API |
| `npm run typecheck` / `npm run lint` | Typy / ESLint |
| `node scripts/health-check.mjs` | Health probe |

### Testy

```bash
npm test                 # 203 testov: unit + api + components
npm run test:all         # + integration + e2e (vyžaduje DATABASE_URL / REDIS_URL)
```

Integračné testy používajú `DATABASE_URL` z `.env` (Railway alebo lokálny Postgres). `scripts/ensure-integration-db.mjs` pripraví testovaciu schému.

---

## PWA špecifikácia

### Registrácia Service Worker

V [`src/main.tsx`](src/main.tsx):

```ts
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true); // auto-apply nová verzia
  },
  onOfflineReady() {
    console.log("[PWA] Aplikácia je pripravená na offline použitie.");
  },
});
```

### Konfigurácia (`vite.config.ts`)

| Parameter | Hodnota | Význam |
|-----------|---------|--------|
| `registerType` | `autoUpdate` | SW sa aktualizuje automaticky |
| `includeAssets` | ikony + `manifest.json` | Extra assety do precache |
| `workbox.globPatterns` | `**/*.{js,css,html,svg,png,ico,woff2}` | Precache build výstupu |
| Runtime: Google Fonts | `CacheFirst` (1 rok) | Fonty z CDN |

### Manifest

Zdroje: [`public/manifest.json`](public/manifest.json) + generovaný manifest z `VitePWA`.

| Pole | Hodnota |
|------|---------|
| `name` | ForenzDetectiv — AI rozpory vo výpovediach |
| `short_name` | ForenzDetectiv |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `theme_color` / `background_color` | `#F7F9FC` |
| `lang` | `sk` |
| `start_url` | `/` |
| Ikony | `/forenzdetectiv.png` 512×512 (`any` + `maskable`) |
| Shortcuts | Sherlock (`/sherlock`) |

HTML (`index.html`) dopĺňa `apple-touch-icon`, `mobile-web-app-capable` a `theme-color`.

### Offline limity (dôležité)

1. **Shell UI** a statické assety — offline po prvej návšteve (produkčný build + SW).
2. **Cache výsledkov analýz** — IndexedDB (`src/lib/db.ts`), nie localStorage; **PDF súbory sa offline neukladajú**.
3. **Upload / Mistral / fronta / CRUD spisov** — vyžadujú online API.
4. Dev režim (`npm run dev`) má SW obmedzene; plnú PWA overujte cez `npm run build && npm run preview` (HTTPS/localhost).

### Privacy fronty (BullMQ)

| Stav jobu | Retencia v Redis |
|-----------|------------------|
| Completed | Okamžité zmazanie (`removeOnComplete: { age: 0, count: 0 }`) |
| Failed | Max 24 h / 100 jobov |
| DELETE spisu | `removeAnalysisJob` odstráni job `analysis_<id>` |

Chunker pridáva do každého bloku meta `[KONTEXT: ANALÝZA STRANY CCA N]` podľa značiek `--- STRANA N ---` z pdfParser.
---

## Architektúra priečinkov

```
ALIBI-MSITRAL/
├── public/                 # Statické PWA assety
│   ├── manifest.json
│   └── forenzdetectiv.png
├── src/
│   ├── main.tsx            # React root + registerSW
│   ├── App.tsx             # Router, analytics/UTM init
│   ├── index.css
│   ├── types.ts            # Analysis a domain types
│   ├── pages/              # Route-level pages
│   │   ├── HomePage.tsx
│   │   ├── SherlockPage.tsx
│   │   ├── FilesPage.tsx   # /spisy
│   │   ├── CaseLayout.tsx
│   │   └── ProfilePage.tsx
│   ├── components/
│   │   ├── home/           # QuickTip
│   │   ├── sherlock/       # SherlockAnalyzer, RecentAnalyses
│   │   ├── case/           # RozporyTab, AlibiMap, PdfExportDialog, …
│   │   ├── m3/             # Material-3 shell (AppBar, NavBar, BottomSheet)
│   │   ├── audit/          # AuditLogViewer
│   │   └── share/          # AlibiShareCard
│   └── lib/                # Doménová logika (API client, AI, geospatial, IndexedDB …)
│       ├── db.ts           # IndexedDB cache analýz (idb)
│       ├── documentChunker.ts  # Chunky + meta strany
│       └── api.ts          # REST klient + offline cache
├── server/                 # Hono API
│   ├── index.ts
│   ├── queue.ts            # BullMQ
│   ├── middleware.ts
│   ├── prisma.ts
│   └── geospatialEngine.ts
├── prisma/                 # Schema + migrácie
├── tests/                  # unit / api / components / integration / e2e
├── scripts/                # ensure-db, health-check, test-cloud-db, …
├── docs/                   # DEPLOY, ARCHITECTURE, ONBOARDING, …
├── vite.config.ts          # Vite + PWA + proxy
├── Dockerfile              # Railway API image
└── vercel.json             # SPA + /api rewrite na Railway
```

### Routing

| Cesta | Popis |
|-------|-------|
| `/` | Home — hero, CTA na Sherlock |
| `/sherlock` | Upload + analýza + nedávne analýzy |
| `/spisy` | Zoznam spisov |
| `/spisy/:id/rozpory` | Rozpory, alibi mapa, cross-exam |
| `/spisy/:id/timeline` | Časová os |
| `/spisy/:id/graf` | Graf + PageRank |
| `/spisy/:id/osoby` | Osoby |
| `/spisy/:id/audit` | Audit log spisu |
| `/profil` | O aplikácii + globálny audit |

---

## API (Hono)

Väčšina endpointov pod `/api/*` prechádza **rate limítom** a **auth middleware** (`x-api-key` / JWT podľa `ENABLE_AUTH`). Výnimka: `GET /api/health`.

### Health

| Metóda | Cesta | Auth | Odpoveď |
|--------|-------|------|---------|
| `GET` | `/api/health` | Nie | `{ status, timestamp, version, mistralConfigured }` |

### Analýza a fronta

| Metóda | Cesta | Body (skrátene) | Odpoveď |
|--------|-------|-----------------|---------|
| `POST` | `/api/analyze` | multipart súbory | job / analysis id |
| `GET` | `/api/analyses/:id/progress` | — | progress / status |
| `POST` | `/api/forenz/analyze` | text + meta | analysis payload |
| `POST` | `/api/forenz/ocr` | obrazové dáta | OCR text |

### Spisy (CRUD)

| Metóda | Cesta | Poznámka |
|--------|-------|----------|
| `GET` | `/api/analyses` | Zoznam owner-scoped |
| `GET` | `/api/analyses/:id` | Detail + výsledok |
| `PATCH` | `/api/analyses/:id` | Rename (`name`) |
| `DELETE` | `/api/analyses/:id` | Zmazanie jedného |
| `DELETE` | `/api/analyses` | Zmazanie všetkých |

### HITL, audit, alibi, cross-exam

| Metóda | Cesta | Request | Response |
|--------|-------|---------|----------|
| `GET/POST` | `/api/analyses/:id/hitl` | `{ eventId, status }` | HITL záznamy |
| `GET/POST` | `/api/audit-logs` | `{ action, details? }` | zoznam / create |
| `POST` | `/api/geospatial/check` | `{ locA, timeA, locB, timeB, personName? }` | `{ success, result: TravelFeasibilityResult \| null }` |
| `POST` | `/api/cross-exam` | `{ contradictions[], contextText?, mode? }` | `{ success, questions[], source: "mistral" \| "local" }` |
| `POST` | `/api/agent/chat` | `{ message }` | chat odpoveď |

`mode` pre cross-exam: `"mild" | "aggressive" | "alibi"` (default `alibi`). Bez `MISTRAL_API_KEY` vráti `source: "local"`.

---

## Kľúčové UI komponenty

| Komponent | Props | Úloha |
|-----------|-------|-------|
| `AlibiMap` | `result: TravelFeasibilityResult \| null \| undefined` | SVG mapa A/B alebo empty state |
| `PdfExportDialog` | `open`, `onClose`, `analysis`, `caseId` | Markdown download + print, SHA-256 |
| `AlibiShareCard` | `analysis`, `onClose` | Virálna karta + PNG export |
| `AuditLogViewer` | `caseId?`, `limit?` (default 50) | Zoznam audit záznamov |
| `BottomSheet` | `open`, `onClose`, `title`, `children` | M3 bottom sheet (detail rozporu) |
| `CaseHeader` | `analysis`, `analysisId` | Hlavička spisu + export |
| `SherlockAnalyzer` | (file/analyze callbacks podľa stránky) | Upload UI |
| `RecentAnalyses` | — | Posledných N ready analýz |
| `RozporyTab` | — (CaseContext) | Rozpory, geo check, mapa, cross-exam, HITL |

Klientsky cross-exam helper:

```ts
requestCrossExam({
  contradictions,
  contextText,
  mode?: "mild" | "aggressive" | "alibi",
  caseId?,
  eventId?,
}): Promise<{ questions: CrossExamQuestion[]; source: "mistral" | "local" }>
```

---

## Environment premenné

Skopíruj [`.env.example`](.env.example) → `.env`.

| Premenná | Kde | Účel |
|----------|-----|------|
| `DATABASE_URL` | server | PostgreSQL / Prisma |
| `REDIS_URL` | server | BullMQ |
| `MISTRAL_API_KEY` | server | Sherlock + cross-exam (povinné pre ostrú AI) |
| `MISTRAL_OCR_API_KEY` / `MISTRAL_BACKUP_API_KEY` | server | OCR / fallback |
| `ALLOWED_ORIGINS` | server | CORS (Vercel domény) |
| `JWT_SECRET` / `API_KEY` | server | Auth |
| `ENABLE_AUTH` | server | `false` len lokálne — **nikdy v produkcii** |
| `VITE_API_URL` | build (voliteľné) | Absolútna URL API; prázdne = same-origin `/api` (lokálny proxy / Vercel rewrite) |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | build | PostHog EU |
| `VITE_SENTRY_DSN` | build | Sentry (no-op bez DSN) |

Mistral kľúče sú **výhradne server-side**.

---

## Beta deploy

| Služba | URL |
|--------|-----|
| Frontend | https://forenzdetectiv-web.vercel.app |
| API (Railway) | https://api-production-3466e.up.railway.app |
| Health (priamo) | https://api-production-3466e.up.railway.app/api/health |
| Health (cez Vercel rewrite) | https://forenzdetectiv-web.vercel.app/api/health |

Vercel projekt: `viandmos-projects/forenzdetectiv-web`. `vercel.json` posiela `/api/*` na Railway, takže **`VITE_API_URL` na Verceli nie je povinné** — prehliadač volá same-origin `/api`.

Railway: `DATABASE_URL`, `REDIS_URL`, `MISTRAL_API_KEY`, `JWT_SECRET`, `API_KEY`, `ALLOWED_ORIGINS`.

Podrobný návod: **[docs/DEPLOY.md](./docs/DEPLOY.md)**

Artefakty: [`Dockerfile`](./Dockerfile), [`vercel.json`](./vercel.json).

---

## Ďalšia dokumentácia

| Súbor | Obsah |
|-------|-------|
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Live URL, Vercel rewrite, Railway |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Stack, tok dát, env |
| [docs/ONBOARDING.md](./docs/ONBOARDING.md) | Setup vývojára |
| [docs/LOOKER_POSTHOG.md](./docs/LOOKER_POSTHOG.md) | North Star metriky / funnel |
| [docs/BETA_TESTING.md](./docs/BETA_TESTING.md) | Návod pre beta testerov |
| [BACKLOG.md](./BACKLOG.md) | Roadmapa |

---

## Stav projektu (2026-08-30)

| Oblasť | Stav |
|--------|------|
| Hono API + Prisma + BullMQ | ✅ |
| PWA (manifest + Workbox + autoUpdate) | ✅ |
| Home (CTA → Sherlock) + história spisov | ✅ |
| Alibi mapa + cross-exam UI | ✅ |
| BullMQ privacy wipe + page-aware chunker | ✅ |
| IndexedDB cache analýz (`idb`) | ✅ |
| PostHog wiring + LEA trust (audit, PDF, graf) | ✅ |
| CI (`npm test` + lint + typecheck + build) | ✅ |
| Vercel frontend `forenzdetectiv-web` | ✅ https://forenzdetectiv-web.vercel.app |
| Railway API + PG + Redis | ✅ `/api/health` ok, Mistral nakonfigurovaný |
| Canned offline spis | ❌ odstránený |
| Live PostHog / Looker dashboard | ⚠️ kód hotový, kľúče v `.env` môžu byť prázdne |
| Login / OAuth UI | ❌ zámerne mimo scope |
| Monetizácia / Stripe | ❌ P2 backlog |
| RAG nad spisom | ❌ P3 |

---

*ForenzDetectiv — AI navrhuje, rozhodnutia ostávajú na vás.*

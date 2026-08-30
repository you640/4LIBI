# 🏗️ ForenzDetectiv — Architektonická dokumentácia

> **Verzia:** 0.2.0-beta | **Posledná aktualizácia:** 2026-08-30

---

## Prehľad architektúry

ForenzDetectiv je **full-stack AI forenzná platforma** s oddeleným frontendom (Vercel) a backendom (Railway).

```
┌─────────────────────────────────────────────────────────────────┐
│                   VERCEL (Frontend — SPA)                       │
│                                                                 │
│   React 18 + TypeScript + Vite 7 + Tailwind + Material You     │
│   PWA (Workbox) — offline asset caching                        │
│                                                                 │
│   Route: /                 → HomePage (CTA → Sherlock)         │
│   Route: /sherlock         → SherlockPage (upload + AI)        │
│   Route: /spisy            → FilesPage                         │
│   Route: /spisy/:id/*      → CaseLayout (rozpory, timeline, …) │
│   Route: /profil           → ProfilePage                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ same-origin /api  (Vercel rewrite)
                           │ voliteľne VITE_API_URL → Railway
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               RAILWAY (Backend — Docker Container)              │
│                                                                 │
│   Hono API Server (server/index.ts) — PORT (Railway / 8080)   │
│   ├── POST /api/analyze        → BullMQ Queue                  │
│   ├── GET  /api/analyses       → Prisma → PostgreSQL           │
│   ├── GET  /api/analyses/:id   → Prisma → PostgreSQL           │
│   ├── GET  /api/analyses/:id/progress → BullMQ                 │
│   ├── POST /api/cross-exam     → Mistral alebo lokálne šablóny │
│   ├── POST /api/geospatial/check → travel feasibility          │
│   └── GET  /api/health         → status + mistralConfigured    │
│                                                                 │
│   BullMQ Worker (server/queue.ts)                              │
│   ├── Spracúva PDF úlohy asynchrónne                          │
│   ├── Volá Mistral/Pixtral AI                                  │
│   └── Ukladá výsledky do PostgreSQL                           │
│                                                                 │
│   Railway Services:                                            │
│   ├── 🐘 PostgreSQL  ←── DATABASE_URL                         │
│   └── 🔴 Redis       ←── REDIS_URL                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS API volania
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MISTRAL AI (External API)                     │
│   ├── mistral-large-latest  → textová analýza, rozpory         │
│   └── pixtral-12b-2409      → OCR zo skenov a fotografií       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dátový tok: PDF Upload → AI Analýza → Výsledky

```
1. Používateľ nahrá PDF na SherlockPage
          │
          ▼
2. Frontend: POST /api/analyze
   (multipart/form-data, max 25 MB, max 20 súborov)
          │
          ▼
3. server/index.ts → uloží súbor do /uploads/
   → vytvorí Analysis záznam v PostgreSQL (status: pending)
   → zaradí job do BullMQ fronty
   → vráti { jobId, analysisId }
          │
          ▼
4. Frontend polling: GET /api/analyses/:id/progress
   (každé 2 sekundy, kým status !== "done" | "failed")
          │
          ▼
5. BullMQ Worker spracúva job:
   a) ocrService.ts  → Pixtral OCR (naskenované stránky)
   b) pdfParser.ts   → pdf.js extrakcia textu
   c) documentChunker.ts → rozdelí na chunky (max ~12 000 tokenov)
   d) analyzeCore.ts → pre každý chunk volá Mistral API
   e) sherlockPrompt.ts → SHERLOCK_SYSTEM_PROMPT + buildUserPrompt()
   f) mergeAnalysisResults() → zlúči chunky do jedného Analysis
   g) Uloží do PostgreSQL (status: done)
          │
          ▼
6. Frontend: GET /api/analyses/:id → zobrazí výsledky
   ├── CaseLayout (CaseContext provider)
   ├── GrafTab     → vzťahový graf osôb
   ├── TimelineTab → chronologická os
   ├── RozporyTab  → rozpory + krížový výsluch
   ├── OsobyTab    → zoznam osôb
   └── AlibiMap    → geospatiálne alibi-vyhodnotenie
```

---

## Vrstvy aplikácie

### Frontend (`src/`)

| Vrstva | Technológia | Popis |
|---|---|---|
| Routing | React Router v7 | SPA navigácia, lazy loading |
| State | React Context (`CaseContext`) | Zdieľaný stav spisu |
| HTTP | `src/lib/api.ts` | Wrapper pre fetch volania |
| AI API Base | `src/lib/apiBase.ts` | `getApiBase()` — prázdne = same-origin `/api` |
| Offline | IndexedDB (`src/lib/db.ts`) | Cache analýz pre offline |
| PWA | Workbox (vite-plugin-pwa) | Service Worker, offline assets |
| Monitoring | Sentry `@sentry/react` | Error tracking + Source Maps |
| Analytics | PostHog EU | `trackEvent()`, GDPR compliant |
| Dizajn | Tailwind + Material You | `tailwind.config.js` tokeny |

### Backend (`server/`)

| Vrstva | Technológia | Popis |
|---|---|---|
| API Server | Hono v4 | Lightweight TS web framework |
| ORM | Prisma v7 | PostgreSQL type-safe klient |
| Queue | BullMQ v6 | Redis-based job queue |
| OCR | Pixtral API | Naskenované dokumenty |
| Auth | JWT + API Key | `server/middleware.ts` |
| Rate-limit | Custom middleware | Per-IP, per-endpoint |
| Audit | `logAuditAction()` | Každá zmena loggovaná do DB |

---

## Environment premenné

### Railway (Backend)

| Premenná | Povinná | Hodnota v produkcii |
|---|---|---|
| `DATABASE_URL` | 🔴 ÁNO | `postgresql://...` Railway PostgreSQL |
| `REDIS_URL` | 🔴 ÁNO | `redis://...` Railway Redis |
| `MISTRAL_API_KEY` | 🔴 ÁNO | Z console.mistral.ai |
| `JWT_SECRET` | 🔴 ÁNO | Náhodný reťazec min. 32 znakov |
| `API_KEY` | 🔴 ÁNO | Silný API kľúč |
| `ALLOWED_ORIGINS` | 🔴 ÁNO | Vercel URL + vlastná doména |
| `ENABLE_AUTH` | 🟡 | `true` (default) |
| `PORT` | 🟡 | Railway nastaví automaticky |

### Vercel (Frontend)

Live: https://forenzdetectiv-web.vercel.app — projekt `forenzdetectiv-web`.

| Premenná | Povinná | Hodnota v produkcii |
|---|---|---|
| `VITE_API_URL` | 🟡 | Prázdne = rewrite `/api` → Railway. Inak absolútna Railway URL. |
| `VITE_POSTHOG_KEY` | 🟡 | PostHog EU project key |
| `VITE_POSTHOG_HOST` | 🟡 | `https://eu.i.posthog.com` |
| `VITE_SENTRY_DSN` | 🟡 | Sentry DSN |
| `VITE_SENTRY_ENV` | 🟡 | `production` |
| `VITE_STRIPE_PUBLIC_KEY` | 🟡 | Stripe public key (zatiaľ nepoužité) |

---

## Lokálny vývoj

```bash
cp .env.example .env          # DATABASE_URL, REDIS_URL, kľúče
node scripts/test-cloud-db.mjs
npx prisma migrate deploy     # ak treba na cieľovej DB
npm run dev
# → API:      http://127.0.0.1:5176
# → Frontend: http://127.0.0.1:5175

npm test              # 203 testov (unit + api + components)
npm run typecheck
npm run lint
```

---

## CI/CD pipeline (GitHub Actions → Railway → Vercel)

```
git push main
    │
    ▼
GitHub Actions (.github/workflows/ci.yml)
├── npm test (unit + api + components)
├── npm run typecheck
├── npm run lint
└── npm run build
    │
    ▼
Railway: Docker image (Dockerfile) + Prisma migrate
Vercel:  projekt forenzdetectiv-web (vercel.json rewrite /api)
```

---

## Bezpečnostné princípy

1. **`MISTRAL_API_KEY` je server-only** — nikdy nie `VITE_*` prefix
2. **CORS fail-closed** — nikdy sa nevracia `*` s `credentials: true`
3. **Auth fail-closed** — ak `ENABLE_AUTH` nie je explicitne `false`, auth je zapnutá
4. **Audit log** — každá zmena (upload, delete, rename) sa loguje do DB
5. **Rate limiting** — per-IP na API + client-side localStorage limit
6. **`.env` v `.gitignore`** — nikdy komitiť tajné kľúče

---

## Súvisiace dokumenty

- [`docs/DEPLOY.md`](./DEPLOY.md) — Live URL a nasadenie Railway + Vercel
- [`docs/ONBOARDING.md`](./ONBOARDING.md) — Príručka pre nového vývojára
- [`docs/BETA_TESTING.md`](./BETA_TESTING.md) — Beta testovanie
- [`BACKLOG.md`](../BACKLOG.md) — Roadmapa

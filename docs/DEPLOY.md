# Beta deploy — ForenzDetectiv

Aktuálny stack (2026-08-30):

| Komponent | Hosting | Stav |
|-----------|---------|------|
| **Frontend** (Vite SPA) | [Vercel](https://vercel.com) — projekt `forenzdetectiv-web` | live |
| **API** (Hono + BullMQ) | [Railway](https://railway.app) — Docker (`Dockerfile`) | live |
| **Postgres** | Railway PostgreSQL | live |
| **Redis** | Railway Redis | live |

---

## Live URL

| Služba | URL |
|--------|-----|
| Frontend | https://forenzdetectiv-web.vercel.app |
| API | https://api-production-3466e.up.railway.app |
| Health (Railway) | https://api-production-3466e.up.railway.app/api/health |
| Health (cez Vercel `/api`) | https://forenzdetectiv-web.vercel.app/api/health |

```bash
curl -sS https://forenzdetectiv-web.vercel.app/api/health
# {"status":"ok","version":"0.2.0-beta","mistralConfigured":true,...}
```

---

## Architektúra

```
Browser → https://forenzdetectiv-web.vercel.app
              ↓ same-origin /api  (vercel.json rewrite)
         https://api-production-3466e.up.railway.app/api/*
              ↓
         Postgres + Redis + Mistral API
```

Lokálne: Vite proxy `/api` → `127.0.0.1:5176` (žiadny `VITE_API_URL`).

Na Verceli **nie je povinné** `VITE_API_URL`. Ak je prázdne, frontend volá `/api/...` a Vercel to prepíše na Railway — bez CORS. Ak `VITE_API_URL` nastavíte, prehliadač ide priamo na Railway a `ALLOWED_ORIGINS` musí obsahovať Vercel origin.

---

## 1. Railway — API + Postgres + Redis

Image: [`Dockerfile`](../Dockerfile) (`node:22-alpine`, `prisma migrate deploy`, `tsx server/index.ts`). Health: `GET /api/health`.

### Premenné (Railway → Service → Variables)

| Premenná | Povinné |
|----------|---------|
| `DATABASE_URL` | Áno |
| `REDIS_URL` | Áno |
| `MISTRAL_API_KEY` | Áno (reálna analýza) |
| `JWT_SECRET` (min. 32 znakov) | Áno (auth fail-closed) |
| `API_KEY` | Áno (auth fail-closed) |
| `ALLOWED_ORIGINS` | Áno — aspoň Vercel origin, ak používate priamy `VITE_API_URL` |
| `HOST` | `0.0.0.0` |
| `PORT` | Railway inject |
| `NODE_ENV` | `production` |

**Produkcia:** nenastavujte `ENABLE_AUTH=false`.

Voliteľné: `MISTRAL_BACKUP_API_KEY`, `MISTRAL_OCR_API_KEY`, `SENTRY_AUTH_TOKEN`.

### Migrácie

Bežia v `CMD` image:

```bash
npx prisma migrate deploy && npx tsx server/index.ts
```

---

## 2. Vercel — frontend

Projekt: `viandmos-projects/forenzdetectiv-web`.

Konfigurácia je v [`vercel.json`](../vercel.json):

- Framework Vite, `npm run build`, output `dist`
- Rewrite `/api/:path*` → Railway API
- SPA fallback na `index.html` (`/spisy`, `/sherlock`, …)
- Cache: `index.html` / `sw.js` bez cache, `/assets` immutable

### Environment Variables

Na aktuálnom projekte **žiadne** `VITE_*` (API ide cez rewrite). Voliteľne:

| Premenná | Účel |
|----------|------|
| `VITE_API_URL` | Priamy call na Railway (vtedy treba CORS) |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | PostHog EU |
| `VITE_SENTRY_DSN` / `VITE_SENTRY_ENV` | Sentry |

Po zmene `VITE_*` vždy **Redeploy** (build-time inlining).

---

## 3. Sentry (produkcia)

Bez DSN je Sentry no-op. Ak zapínate: Client DSN → `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV=production`.

---

## 4. PostHog (North Star)

Event `contradiction_viewed` — pozri [`LOOKER_POSTHOG.md`](./LOOKER_POSTHOG.md). Bez kľúča: `console.log`.

---

## 5. CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml): lint, typecheck, `npm test` (unit + api + components), build. Deploy ide cez Vercel Git integráciu a Railway Git/Docker, nie cez manuálny `deploy.yml`.

---

## 6. Lokálny full-stack

```bash
cp .env.example .env   # DATABASE_URL, REDIS_URL, MISTRAL_API_KEY, JWT_SECRET, API_KEY
node scripts/test-cloud-db.mjs
npm run dev            # web :5175 + api :5176
node scripts/health-check.mjs
npm test
npm run test:e2e
```

---

## 7. Checklist pred zdieľaním beta URL

- [x] `GET /api/health` vracia `status: ok` (Railway aj cez Vercel rewrite)
- [x] Frontend na https://forenzdetectiv-web.vercel.app
- [x] SPA routing `/sherlock`, `/spisy`
- [ ] Sherlock upload → analýza → `/spisy/:id/rozpory` (overiť s API kľúčom)
- [ ] `ALLOWED_ORIGINS` na Railway obsahuje Vercel origin, ak zapnete `VITE_API_URL`
- [x] Žiadne secrets v gite (len `.env.example`)

---

## Riešenie problémov

| Symptóm | Riešenie |
|---------|----------|
| CORS error | Buď nechajte `VITE_API_URL` prázdne (rewrite), alebo doplňte origin do `ALLOWED_ORIGINS` |
| Sherlock „API nedostupné“ | Health cez `/api/health` na Vercel URL; Railway logy |
| Analýza visí vo fronte | `REDIS_URL`, worker logy |
| 503 databáza | `DATABASE_URL`, `npx prisma migrate deploy` |
| 401 na API | `x-api-key` / JWT; lokálne `ENABLE_AUTH=false` |

---

*Posledná aktualizácia: 2026-08-30 — Hono + Prisma + BullMQ; Vercel rewrite `/api` → Railway.*

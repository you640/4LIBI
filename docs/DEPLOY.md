# Beta deploy — ForenzDetectiv

Tento návod popisuje **odporúčaný stack** pre verejnú beta:

| Komponent | Hosting | Prečo |
|-----------|---------|-------|
| **Frontend** (Vite SPA) | [Vercel](https://vercel.com) | Statický `dist/`, CDN, preview URL |
| **API** (Hono + BullMQ worker) | [Railway](https://railway.app) | Docker, Postgres + Redis pluginy, jeden projekt |
| **Postgres** | Railway PostgreSQL | Prisma migrácie |
| **Redis** | Railway Redis | BullMQ fronta pre Sherlock |

Alternatívy: Render.com, Fly.io — rovnaký `Dockerfile`, iné env UI.

---

## Architektúra

```
Browser → https://beta.forenzdetectiv.sk (Vercel)
              ↓ VITE_API_URL
         https://api-xxx.up.railway.app (Hono :PORT)
              ↓
         Postgres + Redis + Mistral API
```

Lokálne: Vite proxy `/api` → `127.0.0.1:5176` (žiadny `VITE_API_URL`).

---

## 1. Railway — API + Postgres + Redis

### 1.1 Nový projekt

1. [railway.app](https://railway.app) → **New Project**
2. **Add PostgreSQL** → skopíruj `DATABASE_URL`
3. **Add Redis** → skopíruj `REDIS_URL`
4. **Deploy from GitHub** → tento repozitár, branch `main`
5. Railway deteguje `Dockerfile` + `railway.toml`

### 1.2 Premenné prostredia (Railway → Service → Variables)

| Premenná | Príklad | Povinné |
|----------|---------|---------|
| `DATABASE_URL` | z PostgreSQL pluginu | Áno |
| `REDIS_URL` | z Redis pluginu | Áno |
| `MISTRAL_API_KEY` | z console.mistral.ai | Áno (reálna analýza) |
| `JWT_SECRET` | min. 32 znakov | Áno (ak `ENABLE_AUTH` ≠ false) |
| `API_KEY` | náhodný reťazec | Áno (ak auth zapnutá) |
| `ALLOWED_ORIGINS` | `https://beta.forenzdetectiv.sk,https://tvoj-projekt.vercel.app` | Áno |
| `HOST` | `0.0.0.0` | Áno (Docker default) |
| `PORT` | Railway nastaví automaticky | Nie (Railway inject) |
| `NODE_ENV` | `production` | Odporúčané |

**Produkcia — auth:** nenastavujte `ENABLE_AUTH=false`. Klient posiela `x-api-key` alebo JWT (dev: `x-owner-id` len lokálne).

**Voliteľné:** `MISTRAL_BACKUP_API_KEY`, `MISTRAL_OCR_API_KEY`, `SENTRY_AUTH_TOKEN`

### 1.3 Health check po deployi

Railway volá `GET /api/health` (pozri `railway.toml`).

Manuálne (nahraďte URL):

```bash
curl -sS https://YOUR-RAILWAY-APP.up.railway.app/api/health
# Očakávané: {"status":"ok","timestamp":"...","version":"1.0.0"}

node scripts/health-check.mjs https://YOUR-RAILWAY-APP.up.railway.app/api/health
```

### 1.4 Migrácie

Spúšťajú sa automaticky v `Dockerfile` CMD:

```bash
npx prisma migrate deploy && npx tsx server/index.ts
```

---

## 2. Vercel — frontend

### 2.1 Import projektu

1. [vercel.com](https://vercel.com) → Import Git repozitár
2. Framework: **Vite**
3. Build: `npm run build`
4. Output: `dist`

### 2.2 Environment Variables (Vercel → Settings)

| Premenná | Hodnota |
|----------|---------|
| `VITE_API_URL` | `https://YOUR-RAILWAY-APP.up.railway.app` (bez `/` na konci) |
| `VITE_POSTHOG_KEY` | PostHog EU project key (voliteľné) |
| `VITE_POSTHOG_HOST` | `https://eu.i.posthog.com` |
| `VITE_SENTRY_DSN` | Sentry DSN (voliteľné) |
| `VITE_SENTRY_ENV` | `staging` alebo `production` |

**Dôležité:** Po zmene `VITE_*` spustite **Redeploy** — premenné sa vkladajú pri build time.

### 2.3 CORS

V Railway nastavte `ALLOWED_ORIGINS` na presnú Vercel URL (aj preview domény ak potrebujete):

```
https://forenzdetectiv.vercel.app,https://beta.forenzdetectiv.sk
```

### 2.4 SPA routing

`vercel.json` v repozitári presmeruje ne-API cesty na `index.html` (`/spisy`, `/sherlock`, …).

---

## 3. Sentry (produkcia)

1. Vytvorte projekt na [sentry.io](https://sentry.io)
2. Skopírujte **Client DSN** → `VITE_SENTRY_DSN` vo Vercel
3. Nastavte `VITE_SENTRY_ENV=staging`
4. (Voliteľné) Source maps: `SENTRY_AUTH_TOKEN` v CI — pozri `.env.example`

Bez DSN je Sentry no-op (aplikácia funguje normálne).

---

## 4. PostHog (North Star)

1. EU projekt na [posthog.com](https://eu.posthog.com)
2. `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST=https://eu.i.posthog.com` vo Vercel
3. North Star event: `contradiction_viewed` — pozri `docs/LOOKER_POSTHOG.md`

Bez kľúča: analytics padá na `console.log` (dev-friendly).

---

## 5. GitHub Actions — voliteľný deploy

Workflow `.github/workflows/deploy.yml` je **manual-only** (`workflow_dispatch`).

Potrebné GitHub Secrets:

| Secret | Popis |
|--------|-------|
| `RAILWAY_TOKEN` | Railway API token |
| `DATABASE_URL` | (pre migrácie mimo Railway) |
| `REDIS_URL` | |
| `MISTRAL_API_KEY` | |

Odporúčaný postup pre beta: deploy API cez Railway GitHub integráciu, frontend cez Vercel — bez secrets v CI.

---

## 6. Lokálny full-stack test

```bash
docker compose up -d postgres redis
cp .env.example .env   # doplň MISTRAL_API_KEY ak testuješ analýzu
npm run dev            # web :5175 + api :5176

# Health
node scripts/health-check.mjs

# E2E s mock API (CI default)
npm run test:e2e

# E2E proti reálnemu API (vyžaduje PG + Redis)
npm run test:e2e:full
```

---

## 7. Checklist pred beta URL

- [ ] `curl` na `/api/health` vracia `status: ok`
- [ ] Vercel `VITE_API_URL` ukazuje na Railway API
- [ ] `ALLOWED_ORIGINS` obsahuje Vercel doménu
- [ ] Sherlock upload → analýza → `/spisy/:id/rozpory` funguje
- [ ] Demo `/spisy/demo/rozpory` funguje offline (bez API)
- [ ] `npm run test:all` prešlo v CI
- [ ] Žiadne secrets v gite (len `.env.example`)

---

## 8. Staging URL (placeholder)

Po prvom deployi doplňte sem:

| Služba | URL |
|--------|-----|
| Frontend (Vercel) | `https://YOUR-PROJECT.vercel.app` |
| API (Railway) | `https://YOUR-APP.up.railway.app` |
| Health | `https://YOUR-APP.up.railway.app/api/health` |

```bash
curl -sS https://YOUR-APP.up.railway.app/api/health | jq .
```

---

## Riešenie problémov

| Symptóm | Riešenie |
|---------|----------|
| CORS error v prehliadači | Skontrolujte `ALLOWED_ORIGINS` na API |
| Sherlock „API nedostupné“ | `VITE_API_URL` + redeploy Vercel |
| Analýza visí vo fronte | Redis `REDIS_URL`, worker logy v Railway |
| 503 databáza | `DATABASE_URL`, `npx prisma migrate deploy` |
| 401 na API | Nastavte `x-api-key` alebo JWT; v dev `ENABLE_AUTH=false` |

---

*Posledná aktualizácia: 2026-08 — stack Hono + Prisma + BullMQ (nie Convex).*

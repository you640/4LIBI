# 🚀 ForenzDetectiv — Onboarding pre nového vývojára

> Čas potrebný: ~30 minút | Predpoklady: Node 22+, Git, PowerShell / bash, prístup k Railway PG + Redis

---

## 1. Klonuj repozitár

```bash
git clone https://github.com/you640/4LIBI.git
cd 4LIBI
```

---

## 2. Nastav `.env`

```bash
# Skopíruj šablónu
cp .env.example .env
```

Otvor `.env` a doplň minimálne tieto hodnoty:

| Premenná | Kde ju získaš |
|---|---|
| `MISTRAL_API_KEY` | [console.mistral.ai](https://console.mistral.ai/) → API Keys |
| `DATABASE_URL` | Railway PostgreSQL (plugin Variables) |
| `REDIS_URL` | Railway Redis (plugin Variables) |
| `JWT_SECRET` | Vygeneruj: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `API_KEY` | Ľubovoľný reťazec min. 16 znakov |

> ⚠️ **NIKDY** nekomitiť `.env` — je v `.gitignore`

---

## 3. Over pripojenie na Cloud Databázu & Redis

```bash
# Otestuj pripojenie na live Railway databázu a Redis:
node scripts/test-cloud-db.mjs
```

Výstup overí `PostgreSQL pripojený!` a `Redis pripojený! (PONG)`. Žiadny lokálny Docker nie je potrebný.

---

## 4. Nainštaluj závislosti

```bash
npm install
```

---

## 5. Inicializuj databázu

```bash
# Spusti migrácie
npx prisma migrate dev

# (voliteľné) Seed dát pre vývoj
npx prisma db seed
```

---

## 6. Spusti vývojový server

```bash
npm run dev
```

Otvorí sa:
- **Frontend:** http://localhost:5175
- **API server:** http://localhost:5176
- **API health:** http://localhost:5176/api/health

> Frontend volá API cez Vite proxy `/api` → `localhost:5176` (bez `VITE_API_URL` v `.env`)

---

## 7. Overiť funkčnosť

```bash
# Unit + api + component testy (203)
npm test

# TypeScript kontrola
npm run typecheck

# ESLint
npm run lint

# Health check API
npm run health-check

# Test Mistral API kľúča
npm run test:mistral
```

Všetky by mali skončiť bez chýb ✅

---

## 8. Adresárová štruktúra (rýchly prehľad)

```
├── src/                # Frontend (React + TypeScript)
│   ├── pages/          # Stránky (HomePage, SherlockPage, CaseLayout...)
│   ├── components/     # UI komponenty (case/, sherlock/, m3/)
│   └── lib/            # Core logika (api.ts, sherlockPrompt.ts, ...)
│
├── server/             # Backend (Hono API server)
│   ├── index.ts        # API endpointy
│   ├── queue.ts        # BullMQ worker
│   └── prisma.ts       # Prisma klient
│
├── prisma/
│   └── schema.prisma   # DB schéma
│
├── scripts/            # Dev utility skripty
├── tests/              # Testy (unit/, components/, api/)
└── docs/               # Dokumentácia
```

---

## 9. Nasadenie na Railway (Backend)

```bash
# Prihlás sa do Railway CLI
railway login

# Prepoj projekt
railway link

# Nastav environment premenné v Railway dashboarde:
# DATABASE_URL, REDIS_URL, MISTRAL_API_KEY, JWT_SECRET, API_KEY, ALLOWED_ORIGINS

# Deploy (alebo push na main → GitHub Actions → auto-deploy)
railway up
```

> **ALLOWED_ORIGINS** (ak používate `VITE_API_URL`):  
> `https://forenzdetectiv-web.vercel.app,https://forenzdetectiv.sk`

---

## 10. Nasadenie na Vercel (Frontend)

```bash
# Prihlás sa do Vercel CLI
npx vercel login

# Link na projekt forenzdetectiv-web a produkčný deploy
npx vercel link --yes --project forenzdetectiv-web
npx vercel --prod
```

Live frontend: https://forenzdetectiv-web.vercel.app

`VITE_API_URL` na Verceli **nie je povinné** — `vercel.json` posiela `/api` na Railway. Voliteľne:

| Premenná | Hodnota |
|---|---|
| `VITE_API_URL` | Railway API, len ak chcete priamy call (vtedy CORS) |
| `VITE_POSTHOG_KEY` | PostHog EU project key |
| `VITE_SENTRY_DSN` | Sentry DSN |

---

## Časté chyby

| Chyba | Riešenie |
|---|---|
| `DATABASE_URL` / `REDIS_URL` refused | Over `node scripts/test-cloud-db.mjs` a hodnoty v `.env` |
| `Mistral API 401` | Skontroluj `MISTRAL_API_KEY` v `.env` |
| `CORS error` vo Verceli | Buď nechaj `VITE_API_URL` prázdne, alebo pridaj origin do `ALLOWED_ORIGINS` |
| `Prisma P1001` | Databáza nedostupná — Railway status / connection string |
| Port 5176 obsadený | `node scripts/free-dev-ports.mjs 5176` |

---

## Kontakty & dokumenty

- 📋 [BACKLOG.md](../BACKLOG.md) — Roadmapa a TODO
- 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md) — Technická architektúra
- 🚀 [DEPLOY.md](./DEPLOY.md) — Detailný deploy návod
- 🧪 [BETA_TESTING.md](./BETA_TESTING.md) — Beta testovanie

---

> **Tip:** Ak niečo nefunguje, spusti `npm run health-check` — zobrazí stav DB, Redis aj Mistral API.

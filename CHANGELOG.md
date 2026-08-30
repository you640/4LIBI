# Changelog

Všetky významné zmeny v projekte ForenzDetectiv.

Formát je založený na [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

## [Unreleased] — 2026-08-30

### Odstránené

- Canned offline spis (Home CTA, `/spisy/demo`, `DEMO_ANALYSIS`, `DemoCaseRunner`)
- `docs/todo.md` (agent prompt guide)

### Zmenené

- Vercel projekt **`forenzdetectiv-web`**: live https://forenzdetectiv-web.vercel.app
- `vercel.json` — SPA routing + rewrite `/api/*` na Railway (`api-production-3466e.up.railway.app`)
- Dokumentácia (README, DEPLOY, ARCHITECTURE, ONBOARDING, BETA_TESTING) zosúladená so stavom: bez Docker Compose, bez `railway.toml`, 203 testov, Vite 7 / React Router 7
- Analytics: event `demo_launched` zrušený (7 eventov)

## [0.2.0-beta] — 2026-08-29

### Pridané

- **Page Badges** — odznaky `s. N` v `RozporyTab` a `TimelineTab` pre rýchlu orientáciu vo spise
- **`PageBadge` komponent** — jednotné zobrazenie čísla strany v UI
- **`resolvePageFromText` / `resolveEventPage`** — fallback parsovanie strany z `--- STRANA N ---` a `[KONTEXT: ANALÝZA STRANY CCA N]`
- **IndexedDB cache** — analýzy sa ukladajú do IndexedDB namiesto `localStorage` (väčší objem, async API)
- **Privacy Wipe** — BullMQ joby sa odstraňujú pri DELETE analýzy (`removeOnComplete`, `removeAnalysisJob`)
- **LLM prompt** — pole `page` v JSON pre timeline a relationships + normalizácia v `sherlockPrompt`
- **Beta deploy docs** — `docs/BETA_TESTING.md`, rozšírený `docs/DEPLOY.md`

### Zmenené

- **Typový refaktoring grafu** — odstránená index signature z `GraphNodeRecord` / `GraphEdgeRecord`; `GrafTab` volá `calculateGraphMetrics` bez `as unknown as`
- **documentChunker** — merge zachováva `page` pri zlučovaní výsledkov chunkov
- **Produkčná validácia env** — pri `NODE_ENV=production` a zapnutej auth sa vyžadujú `JWT_SECRET` a `API_KEY`

### Testy

- 7 nových scenárov pre stránkovanie a fallbacky (`caseUtils.page`, `sherlockPrompt`, `documentChunker`, `RozporyTab`)
- Celkom **204** testov (unit + api + components)

### Poznámky pre deploy

- Frontend: Vercel (`forenzdetectiv-web`, `/api` rewrite → Railway)
- API: Railway Docker (`Dockerfile`, health `/api/health`)
- Uploady na Railway sú ephemerálne — pre perzistenciu zváž Volume alebo object storage

## [0.1.0] — skoršie verzie

- Počiatočná verzia: Vite + React PWA, Hono API, Prisma, BullMQ, Mistral Sherlock analýza

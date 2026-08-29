# Changelog

Všetky významné zmeny v projekte ForenzDetectiv.

Formát je založený na [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

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

- Frontend: Vercel (`VITE_API_URL` → Railway API)
- API: Railway Docker (`Dockerfile` + `railway.toml`, health `/api/health`)
- Uploady na Railway sú ephemerálne — pre perzistenciu zváž Volume alebo object storage

## [0.1.0] — skoršie verzie

- Počiatočná verzia: Vite + React PWA, Hono API, Prisma, BullMQ, Mistral Sherlock analýza

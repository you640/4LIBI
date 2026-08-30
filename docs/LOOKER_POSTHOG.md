# PostHog EU + Looker Studio — North Star

ForenzDetectiv meria **Weekly Active Investigators** s aspoň 1× `contradiction_viewed`.

## 8 kľúčových eventov

| Event | Kedy sa posiela |
|-------|-----------------|
| `analysis_started` | Upload + Spustiť Sherlock |
| `case_created` | Po úspešnom vytvorení analýzy |
| `contradiction_detected` | Po analýze (počet rozporov) |
| `contradiction_viewed` | Otvorenie detailu rozporu |
| `pdf_exported` | Export súdneho PDF |
| `alibi_checked` | Geospatial alibi check |
| `error_occurred` | Chyba analýzy / API |

Všetky eventy automaticky obsahujú uložené UTM parametre (`utm_source`, `utm_campaign`, …).

## Env premenné

```env
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

Bez `VITE_POSTHOG_KEY` aplikácia loguje eventy do konzoly (`[Analytics] …`) — testy a lokálny dev fungujú bez PostHog.

Session recording je **vypnuté** (GDPR).

## PostHog setup

1. Vytvor projekt na [eu.posthog.com](https://eu.posthog.com)
2. Skopíruj Project API Key do `VITE_POSTHOG_KEY`
3. Spusti app, urob upload flow → over v **Live events**

## Looker Studio (S3.3)

1. PostHog → Data pipelines → Export to BigQuery (alebo CSV export pre MVP)
2. Looker Studio → Create → BigQuery / Sheets connector
3. **Scorecard:** Unique users / týždeň kde `event = contradiction_viewed`
4. **Funnel:**
   - `analysis_started`
   - → `case_created`
   - → `contradiction_detected`
   - → `contradiction_viewed`
   - → `pdf_exported`
5. Zdieľateľný link pre tím — ulož do Notion/Slack

## North Star formula

```
WAU_investigators = COUNT(DISTINCT user_id)
  WHERE event = 'contradiction_viewed'
  AND timestamp >= start_of_week
```

Použi PostHog Trends alebo HogQL pre týždenný graf.

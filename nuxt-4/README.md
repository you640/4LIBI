# Nuxt 4 balík — ForenzDetectiv komponenty

> Prenos z React do Vue 3 / Nuxt 4. Skopíruj tieto súbory do svojho dashboard-4libi projektu.

## Štruktúra

```
nuxt-4/
├── components/
│   └── AlibiShareCard.vue            # Virálna share karta (Vue 3)
├── composables/
│   ├── usePdfParser.ts               # pdfjs-dist worker composable
│   ├── useAuditLog.ts                # Chain of Custody audit log
│   └── useUtmTracker.ts              # UTM + gclid tracking
├── lib/
│   ├── types.ts                     # Analysis typy (Vue kompatibilné)
│   └── sherlockPrompt.ts             # Forenzný prompt + buildRetryJsonPrompt
└── server/
    └── api/
        └── sherlock/
            └── analyze.post.ts       # Nitro endpoint (Mistral API, server-side)
```

## Inštalácia do dashboard-4libi

### 1. Skopíruj súbory

```powershell
Copy-Item nuxt-4\components\AlibiShareCard.vue        C:\Users\42195\Desktop\dashboard-4libi\components\
Copy-Item nuxt-4\composables\usePdfParser.ts         C:\Users\42195\Desktop\dashboard-4libi\composables\
Copy-Item nuxt-4\composables\useAuditLog.ts          C:\Users\42195\Desktop\dashboard-4libi\composables\
Copy-Item nuxt-4\composables\useUtmTracker.ts        C:\Users\42195\Desktop\dashboard-4libi\composables\
Copy-Item nuxt-4\lib\types.ts                        C:\Users\42195\Desktop\dashboard-4libi\lib\
Copy-Item nuxt-4\lib\sherlockPrompt.ts               C:\Users\42195\Desktop\dashboard-4libi\lib\
Copy-Item nuxt-4\server\api\sherlock\analyze.post.ts  C:\Users\42195\Desktop\dashboard-4libi\server\api\sherlock\
```

### 2. Nainštaluj pdfjs-dist

```bash
cd C:\Users\42195\Desktop\dashboard-4libi
npm install pdfjs-dist
```

### 3. Nastav MISTRAL_API_KEY

V `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    mistralApiKey: process.env.MISTRAL_API_KEY,
  },
})
```

V `.env`:

```
MISTRAL_API_KEY=tvoj_kluc_z_https://console.mistral.ai
```

### 4. Použitie komponentov

#### AlibiShareCard

```vue
<script setup lang="ts">
import type { Analysis } from '~/lib/types'

const analysis = ref<Analysis | null>(null)
const showShare = ref(false)
</script>

<template>
  <button @click="showShare = true">Zdielat rozpor</button>
  <AlibiShareCard v-if="showShare && analysis" :analysis="analysis" @close="showShare = false" />
</template>
```

#### usePdfParser (klientska extrakcia PDF)

```vue
<script setup lang="ts">
const { extractTextFromPdf } = usePdfParser()

async function handleFileUpload(file: File) {
  const text = await extractTextFromPdf(file)
  const analysis = await $fetch('/api/sherlock/analyze', {
    method: 'POST',
    body: { text, documentName: file.name },
  })
}
</script>
```

#### useAuditLog (Chain of Custody)

```vue
<script setup lang="ts">
const { auditCaseCreate, auditContradictionViewed, auditAlibiCheck, auditPdfExport } = useAuditLog()

auditCaseCreate({ fileCount: 1, source: 'upload' })
auditContradictionViewed({ contradictionId: 'T001' })
auditAlibiCheck({ caseId: 'case_abc123', result: 'impossible' })
auditPdfExport({ format: 'pdf', caseId: 'case_abc123' })
</script>
```

#### useUtmTracker (kampan atribucia)

```vue
<script setup>
// V app.vue alebo layoute:
const { initUtmTracking } = useUtmTracker()
initUtmTracking()
</script>
```

#### Nitro endpoint (server-side Mistral API)

POST /api/sherlock/analyze
Body: { text: string, documentName?: string }
Response: Analysis (metadata, persons, evidence, relationships, timeline)

```typescript
const analysis = await $fetch('/api/sherlock/analyze', {
  method: 'POST',
  body: { text: extractedText, documentName: file.name },
})
```

## Vylepsenia oproti React verzii

1. buildRetryJsonPrompt() - ak Mistral vrati nevalidny JSON, automaticky retry s korekcnym promptom
2. Mistral API kluc server-side - nie v browseri (bezpecne, cez process.env.MISTRAL_API_KEY)
3. Chain of Custody audit log - 4 specificke akcie
4. gclid tracking - okrem UTM zachytava aj Google Ads click ID
5. Vue 3 Composition API - vsetko ako composables

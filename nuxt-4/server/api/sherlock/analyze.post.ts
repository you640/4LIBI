// analyze.post.ts — Nitro server endpoint pre Nuxt 4
// POST /api/sherlock/analyze
// Telo: { text: string, documentName?: string }
// Odpoveď: Analysis (metadata, persons, evidence, relationships, timeline)
//
// Naostro volá Mistral API — API kľúč je server-side (bezpečné, nie v browseri).
// Ak LLM vráti nevalidný JSON, automaticky retry s buildRetryJsonPrompt().

import {
  SHERLOCK_SYSTEM_PROMPT,
  buildUserPrompt,
  buildRetryJsonPrompt,
  validateAnalysisResponse,
  extractJson,
} from '../../../lib/sherlockPrompt'
import type { Analysis } from '../../../lib/types'

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { text, documentName } = body as { text: string; documentName?: string }

  if (!text || text.trim().length < 10) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Text dokumentu je príliš krátky alebo prázdny',
    })
  }

  const apiKey = process.env.MISTRAL_API_KEY || useRuntimeConfig().mistralApiKey
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Chýba MISTRAL_API_KEY — nastavte v server environment',
    })
  }

  // Skráť text pre LLM limit
  const maxChars = 120000
  const truncatedText =
    text.length > maxChars
      ? text.slice(0, maxChars) + '\n\n[Dokument bol skrátený kvôli limitu LLM]'
      : text

  console.log(`[Sherlock] Starting analysis — ${truncatedText.length} chars`)

  const messages = [
    { role: 'system', content: SHERLOCK_SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(truncatedText) },
  ]

  // 1. Prvý pokus
  let llmResponse = await callMistral(messages, apiKey)

  // 2. Ak nevalidný JSON — retry s korekčným promptom
  if (!validateAnalysisResponse(llmResponse)) {
    console.warn('[Sherlock] Prvý pokus nevalidný — retry s korekčným promptom')
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: llmResponse },
      { role: 'user', content: buildRetryJsonPrompt(llmResponse) },
    ]
    llmResponse = await callMistral(retryMessages, apiKey)
  }

  // 3. Stále nevalidné — chyba
  if (!validateAnalysisResponse(llmResponse)) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Mistral API vrátil neplatný JSON aj po retry',
    })
  }

  // 4. Extrahuj a doplň metadáta
  const analysisData = extractJson(llmResponse) as Analysis

  if (!analysisData.metadata) {
    analysisData.metadata = {
      document_name: documentName || 'Neznámy dokument',
      language: 'sk',
      page_count: null,
      upload_date: new Date().toISOString(),
    }
  } else {
    analysisData.metadata.document_name =
      analysisData.metadata.document_name || documentName || 'Neznámy dokument'
    analysisData.metadata.upload_date =
      analysisData.metadata.upload_date || new Date().toISOString()
  }

  console.log(
    `[Sherlock] Analýza dokončená — ${analysisData.timeline?.length || 0} timeline eventov`
  )

  return analysisData
})

// === Helper: Mistral API call s retry pri 429 ===
async function callMistral(
  messages: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<string> {
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages,
          temperature: 0.3,
          max_tokens: 8000,
        }),
      })

      if (response.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000
        console.warn(`[Sherlock] Mistral 429 — retry za ${waitMs}ms (pokus ${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Mistral API chyba (${response.status}): ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content) throw new Error('Mistral API vrátil prázdnu odpoveď')
      return content
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxRetries - 1) {
        const waitMs = Math.pow(2, attempt) * 500
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
    }
  }

  throw lastError || new Error('Mistral API volanie zlyhalo po retry')
}

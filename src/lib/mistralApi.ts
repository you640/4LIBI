// Mistral/Pixtral API helper (Issue #10 — S4.2.4)
// Node-compatible fetch volanie s exponential backoff retry pri 429.

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MistralConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonObject?: boolean;
}

/**
 * Zavolá Mistral/Pixtral API a vráti text odpovede.
 * Retry pri 429 s exponential backoff.
 */
export async function callMistralApi(
  messages: MistralMessage[],
  config: MistralConfig
): Promise<string> {
  const {
    apiKey,
    model = "mistral-large-latest",
    temperature = 0.3, // nízka kreativita = presnosť (S4.5.7)
    maxTokens = 16000,
    jsonObject = false,
  } = config;

  if (!apiKey) {
    throw new Error(
      "Chýba MISTRAL_API_KEY — nastavte na Hono serveri (.env), nie v prehliadači."
    );
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonObject ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      // 429 — rate limit, retry s backoff
      if (response.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(
          `[Sherlock] Mistral 429 — retry za ${waitMs}ms (pokus ${attempt + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      // Iné chyby
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Mistral API chyba (${response.status}): ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      const content = messageContentToText(data?.choices?.[0]?.message?.content);

      if (!content) {
        throw new Error("Mistral API vrátil prázdnu odpoveď");
      }

      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1 && isRetryable(error, lastError)) {
        const waitMs = Math.pow(2, attempt) * 500;
        console.warn(
          `[Sherlock] Chyba — retry za ${waitMs}ms (pokus ${attempt + 1}/${maxRetries}):`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Mistral API volanie zlyhalo po retry");
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const rec = part as { text?: unknown; content?: unknown };
          if (typeof rec.text === "string") return rec.text;
          if (typeof rec.content === "string") return rec.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";

interface OcrPage {
  markdown?: string;
}

/**
 * Mistral OCR — skenované PDF a fotky (JPG/PNG/WEBP).
 * Súbor ide ako data URI; výstup je spojený markdown zo strán.
 */
export async function callMistralOcr(config: {
  apiKey: string;
  kind: "document" | "image";
  mime: string;
  base64: string;
}): Promise<string> {
  const { apiKey, kind, mime, base64 } = config;

  if (!apiKey) {
    throw new Error(
      "Chýba MISTRAL_API_KEY — nastavte na Hono serveri (.env), nie v prehliadači."
    );
  }

  const dataUri = `data:${mime};base64,${base64}`;
  const document =
    kind === "image"
      ? { type: "image_url", image_url: dataUri }
      : { type: "document_url", document_url: dataUri };

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(MISTRAL_OCR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "mistral-ocr-latest",
          document,
        }),
      });

      if (response.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `[Sherlock] OCR 429 — retry za ${waitMs}ms (pokus ${attempt + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Mistral OCR chyba (${response.status}): ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      const pages: OcrPage[] = Array.isArray(data?.pages) ? data.pages : [];
      const text = pages
        .map((page) => page.markdown || "")
        .join("\n\n")
        .trim();

      if (text.length < 10) {
        throw new Error("OCR nenašiel čitateľný text v dokumente.");
      }

      console.log(`[Sherlock] OCR hotové — ${text.length} znakov, ${pages.length} strán`);
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1 && isRetryable(error, lastError)) {
        const waitMs = Math.pow(2, attempt) * 500;
        console.warn(
          `[Sherlock] OCR chyba — retry za ${waitMs}ms (pokus ${attempt + 1}/${maxRetries}):`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Mistral OCR volanie zlyhalo po retry");
}

function isRetryable(error: unknown, lastError: Error): boolean {
  if (error instanceof Error && /429/.test(error.message)) return true;
  return /fetch|network|Failed/i.test(lastError.message);
}


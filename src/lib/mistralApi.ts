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
    maxTokens = 8000,
  } = config;

  if (!apiKey) {
    throw new Error(
      "Chýba MISTRAL_API_KEY — nastavte v environment variables (Convex / Base44)"
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
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Mistral API vrátil prázdnu odpoveď");
      }

      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Retry len pri 429 alebo sieťových chybách
      if (attempt < maxRetries - 1) {
        const waitMs = Math.pow(2, attempt) * 500;
        console.warn(
          `[Sherlock] Chyba — retry za ${waitMs}ms (pokus ${attempt + 1}/${maxRetries}):`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  throw lastError || new Error("Mistral API volanie zlyhalo po retry");
}

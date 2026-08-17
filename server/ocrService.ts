export interface OCROptions {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
}

export interface OCRResult {
  text: string;
  pageCount?: number;
  sourceType: 'pdf' | 'image' | 'text';
  confidence?: number;
  processingTimeMs: number;
}

interface MistralChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class OCRService {
  private apiKey: string;
  private model: string;
  private maxRetries: number;

  constructor(options: OCROptions = {}) {
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.MISTRAL_API_KEY : '') || '';
    this.model = options.model || 'pixtral-large-latest';
    this.maxRetries = options.maxRetries || 3;
  }

  async extractFromImageBase64(base64Image: string, mimeType = 'image/jpeg'): Promise<OCRResult> {
    const startTime = Date.now();
    const dataUri = base64Image.startsWith('data:') ? base64Image : `data:${mimeType};base64,${base64Image}`;

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.maxRetries) {
      try {
        attempts++;
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Extrahuj VŠETOK text z tohto forenzného dokumentu/zápisnice doslovne a presne. Zachovaj štruktúru, odstavce, dátumy a čísla. Nevynechaj žiadne údaje.'
                  },
                  {
                    type: 'image_url',
                    image_url: dataUri
                  }
                ]
              }
            ],
            temperature: 0.1
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Mistral OCR response error ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as MistralChatResponse;
        const rawText = data?.choices?.[0]?.message?.content || '';
        const cleanedText = this.cleanTextForSearch(rawText);

        return {
          text: cleanedText,
          pageCount: 1,
          sourceType: 'image',
          confidence: 0.95,
          processingTimeMs: Date.now() - startTime
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempts < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts)));
        }
      }
    }

    throw new Error(`OCR extrakcia zlyhala po ${this.maxRetries} pokusoch: ${lastError?.message || 'Neznáma chyba'}`);
  }

  cleanTextForSearch(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export function createOCRService(options?: OCROptions): OCRService {
  return new OCRService(options);
}

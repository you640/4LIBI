// usePdfParser.ts — Nuxt 4 composable pre pdfjs-dist
// Klientska extrakcia textu z PDF priamo v prehliadači (worker).

export function usePdfParser() {
  async function extractTextFromPdf(file: File | ArrayBuffer): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist')

    // Nastav workerSrc pre prehliadač
    if (typeof window !== 'undefined') {
      // @ts-expect-error — workerSrc pre prehliadač
      pdfjsLib.GlobalWorkerOptions.workerSrc = (
        await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      ).default
    }

    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(' ')
      fullText += pageText + '\n\n'
    }

    return fullText.trim()
  }

  function isPdf(file: File | ArrayBuffer): boolean {
    if (file instanceof File) {
      return file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
    }
    const bytes = new Uint8Array(file.slice(0, 5))
    return String.fromCharCode(...bytes).startsWith('%PDF')
  }

  function truncateText(text: string, maxChars = 120000): string {
    if (text.length <= maxChars) return text
    return text.slice(0, maxChars) + '\n\n[Dokument bol skrátený kvôli limitu LLM]'
  }

  return { extractTextFromPdf, isPdf, truncateText }
}

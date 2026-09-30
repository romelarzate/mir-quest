import type { DocumentVersionRef, PdfPage, PdfTextSource, SourceDocumentRef } from '../extraction/types'
import type { CanonicalDocument } from './types'

export const markdownSourceId = 'markdown-text-source'

export const markdownSourceRules: string[] = [
  'El adaptador NO reimplementa validacion: reutiliza el extractor de la Fase 5.5.',
  'El texto no interpretado se entrega tal cual para que el extractor lo vea.',
  'La geometria no existe en Markdown: se declara null y el extractor lo registra.',
]

export function canonicalDocumentToPages(document: CanonicalDocument): PdfPage[] {
  const pages = new Map<number, { lines: string[]; hasImages: boolean }>()
  for (const block of document.blocks) {
    if (block.kind === 'page-break') continue
    const entry = pages.get(block.page) ?? { lines: [], hasImages: false }
    if (block.kind === 'uninterpreted') entry.lines.push(block.sourceText)
    else if (block.kind === 'heading' && block.text.length === 0) entry.lines.push('#' + String(block.level ?? 2))
    else entry.lines.push(block.text)
    if (block.kind === 'figure') entry.hasImages = true
    pages.set(block.page, entry)
  }

  return Array.from(pages.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, entry]) => ({
      pageNumber,
      text: entry.lines.join(String.fromCharCode(10)),
      width: null,
      height: null,
      declaredColumns: null,
      columnTexts: null,
      hasImages: entry.hasImages,
    }))
}

export function createMarkdownTextSource(document: CanonicalDocument): PdfTextSource {
  const pages = canonicalDocumentToPages(document)
  return {
    id: markdownSourceId,
    label: 'Fuente de texto derivada del Markdown canonico',
    status: 'synthetic',
    loadPages: async (_document: SourceDocumentRef, _version: DocumentVersionRef) => pages.map((page) => ({ ...page })),
  }
}

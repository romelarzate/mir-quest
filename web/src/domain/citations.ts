import type { DocumentChunk, DocumentRecord } from './documents'

/**
 * Procedencia de un fragmento. Si un dato no se conoce, se deja a null.
 * Nunca se rellena una página, sección o rango inventado.
 */

export type CitationRange = {
  start: number
  end: number
}

export type Citation = {
  documentId: string
  documentVersionId: string
  chunkId: string
  documentTitle: string
  page: number | null
  section: string | null
  range: CitationRange | null
  label: string
}

export type CitationInput = {
  documentId: string
  documentVersionId: string
  chunkId: string
  documentTitle: string
  page?: number | null
  section?: string | null
  range?: CitationRange | null
}

export function buildCitation(input: CitationInput): Citation {
  const page = typeof input.page === 'number' && Number.isFinite(input.page) && input.page > 0 ? input.page : null
  const section =
    typeof input.section === 'string' && input.section.trim().length > 0 ? input.section.trim() : null
  const range =
    input.range && input.range.end > input.range.start ? { start: input.range.start, end: input.range.end } : null

  return {
    documentId: input.documentId,
    documentVersionId: input.documentVersionId,
    chunkId: input.chunkId,
    documentTitle: input.documentTitle,
    page,
    section,
    range,
    label: '',
  }
}

export function labelForCitation(citation: Omit<Citation, 'label'>): string {
  const parts: string[] = [citation.documentTitle]
  if (citation.section) parts.push(citation.section)
  if (citation.page !== null) parts.push('pág. ' + String(citation.page))
  if (citation.page === null && !citation.section) parts.push('sin página')
  if (citation.range) parts.push('car. ' + String(citation.range.start) + '-' + String(citation.range.end))
  return parts.join(' · ')
}

export function finalizeCitation(citation: Citation): Citation {
  return { ...citation, label: labelForCitation(citation) }
}

export function citationHasLocation(citation: Citation): boolean {
  return citation.page !== null || citation.section !== null || citation.range !== null
}

export function formatCitation(citation: Citation): string {
  return citation.label.length > 0 ? citation.label : labelForCitation(citation)
}

export function citationKey(citation: Citation): string {
  return citation.documentId + '|' + citation.documentVersionId + '|' + citation.chunkId
}

export function citationFromChunk(chunk: DocumentChunk, document: DocumentRecord): Citation {
  return finalizeCitation(
    buildCitation({
      documentId: chunk.documentId,
      documentVersionId: chunk.versionId,
      chunkId: chunk.id,
      documentTitle: document.metadata.title,
      page: chunk.page,
      section: chunk.section,
      range: chunk.charRange,
    }),
  )
}

export function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>()
  const result: Citation[] = []
  for (const citation of citations) {
    const key = citationKey(citation)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(citation)
  }
  return result
}

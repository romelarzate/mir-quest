import type { DocumentPageMap, MarkdownBlock, TraceabilityChain } from './types'

export const provenanceRules: string[] = [
  'Todo bloque de contenido tiene una entrada en el page map.',
  'Los offsets solo se rellenan si la fuente los conoce; si no, quedan en null.',
  'La cadena PDF -> bloque -> contenido -> entidad debe ser reconstruible.',
  'Una cadena incompleta se declara incompleta, nunca se asume.',
]

export type BuildPageMapInput = {
  sourceDocumentId: string
  documentVersionId: string
  blocks: MarkdownBlock[]
}

export function buildPageMap(input: BuildPageMapInput): DocumentPageMap[] {
  return input.blocks.map((block) => ({
    markdownBlockId: block.blockId,
    sourceDocumentId: input.sourceDocumentId,
    documentVersionId: input.documentVersionId,
    sourcePageStart: block.page,
    sourcePageEnd: block.page,
    sourceOffsetStart: null,
    sourceOffsetEnd: null,
    confidence: block.uncertain ? 0.5 : 1,
  }))
}

export function pageMapForBlock(pageMap: DocumentPageMap[], blockId: string): DocumentPageMap | undefined {
  return pageMap.find((entry) => entry.markdownBlockId === blockId)
}

export function blocksForPage(blocks: MarkdownBlock[], page: number): MarkdownBlock[] {
  return blocks.filter((block) => block.page === page)
}

export function pageRangeForBlock(
  pageMap: DocumentPageMap[],
  blockId: string,
): { start: number; end: number } | null {
  const entry = pageMapForBlock(pageMap, blockId)
  if (!entry) return null
  return { start: entry.sourcePageStart, end: entry.sourcePageEnd }
}

export function missingPageMapEntries(pageMap: DocumentPageMap[], blocks: MarkdownBlock[]): string[] {
  const mapped = new Set(pageMap.map((entry) => entry.markdownBlockId))
  return blocks.filter((block) => !mapped.has(block.blockId)).map((block) => block.blockId)
}

export type BuildTraceInput = {
  sourceDocumentId: string
  documentVersionId: string
  markdownArtifactId: string
  markdownBlockId: string
  sourcePageStart: number | null
  sourcePageEnd: number | null
  extractedQuestionNumber?: number | null
  knowledgeEntityId?: string | null
}

export function buildTraceabilityChain(input: BuildTraceInput): TraceabilityChain {
  const missing: string[] = []
  if (input.markdownArtifactId.trim().length === 0) missing.push('markdownArtifactId')
  if (input.markdownBlockId.trim().length === 0) missing.push('markdownBlockId')
  if (input.sourcePageStart === null) missing.push('sourcePageStart')
  if (input.sourcePageEnd === null) missing.push('sourcePageEnd')

  return {
    sourceDocumentId: input.sourceDocumentId,
    documentVersionId: input.documentVersionId,
    markdownArtifactId: input.markdownArtifactId,
    markdownBlockId: input.markdownBlockId,
    sourcePageStart: input.sourcePageStart ?? 0,
    sourcePageEnd: input.sourcePageEnd ?? 0,
    extractedQuestionNumber: input.extractedQuestionNumber ?? null,
    knowledgeEntityId: input.knowledgeEntityId ?? null,
    complete: missing.length === 0,
    missing,
  }
}

export function describeTrace(chain: TraceabilityChain): string {
  return [
    chain.sourceDocumentId,
    'v ' + chain.documentVersionId,
    'art ' + chain.markdownArtifactId.slice(0, 12),
    'bloque ' + chain.markdownBlockId,
    'pag ' + String(chain.sourcePageStart) + '-' + String(chain.sourcePageEnd),
    chain.extractedQuestionNumber === null ? 'sin pregunta' : 'pregunta ' + String(chain.extractedQuestionNumber),
    chain.complete ? 'cadena completa' : 'cadena incompleta: ' + chain.missing.join(', '),
  ].join(' · ')
}

export function traceChainFromBlocks(
  blocks: MarkdownBlock[],
  pageMap: DocumentPageMap[],
  input: { sourceDocumentId: string; documentVersionId: string; markdownArtifactId: string; page: number },
): TraceabilityChain[] {
  return blocks
    .filter((block) => block.page === input.page)
    .map((block) => {
      const entry = pageMapForBlock(pageMap, block.blockId)
      return buildTraceabilityChain({
        sourceDocumentId: input.sourceDocumentId,
        documentVersionId: input.documentVersionId,
        markdownArtifactId: input.markdownArtifactId,
        markdownBlockId: block.blockId,
        sourcePageStart: entry ? entry.sourcePageStart : null,
        sourcePageEnd: entry ? entry.sourcePageEnd : null,
      })
    })
}

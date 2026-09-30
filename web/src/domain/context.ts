import { dedupeCitations } from './citations'
import type { Citation } from './citations'
import type { RetrievalHit, RetrievalResult, RetrievalStatus } from './retrieval'
import type { DocumentSearchProvider } from './retrieval'
import type { SourceType } from './types'

export type ContextSource = {
  documentId: string
  documentVersionId: string
  title: string
  subjectId: string | null
  sourceType: SourceType
  sourceIds: string[]
  isDemo: boolean
}

export type StudyContextMetadata = {
  query: string
  subjectId: string | null
  topicId: string | null
  documentIds: string[]
  maxResults: number
  providerId: string
  status: RetrievalStatus
  generatedAt: string
  hitCount: number
  characters: number
}

export type StudyContext = {
  query: string
  chunks: RetrievalHit[]
  sources: ContextSource[]
  citations: Citation[]
  text: string
  metadata: StudyContextMetadata
  warnings: string[]
}

export type BuildStudyContextInput = {
  query: string
  subjectId?: string | null
  topicId?: string | null
  documentIds?: string[]
  maxResults?: number
  maxChars?: number
}

export type AssembleOptions = {
  maxChars?: number
  now?: Date
  sourceIdsByDocument?: Record<string, string[]>
}

function sourcesFromHits(hits: RetrievalHit[], sourceIdsByDocument: Record<string, string[]>): ContextSource[] {
  const byId = new Map<string, ContextSource>()
  for (const hit of hits) {
    if (byId.has(hit.documentId)) continue
    byId.set(hit.documentId, {
      documentId: hit.documentId,
      documentVersionId: hit.metadata.versionId,
      title: hit.metadata.documentTitle,
      subjectId: hit.metadata.subjectId,
      sourceType: hit.metadata.sourceType,
      sourceIds: sourceIdsByDocument[hit.documentId] ?? [],
      isDemo: hit.metadata.isDemo,
    })
  }
  return Array.from(byId.values())
}

function renderContextText(hits: RetrievalHit[], maxChars: number): string {
  const parts: string[] = []
  let total = 0
  for (const hit of hits) {
    const header = '[' + hit.citation.label + ']'
    const block = header + '\n' + hit.text
    if (total + block.length > maxChars) break
    parts.push(block)
    total += block.length
  }
  return parts.join('\n\n')
}

export function assembleStudyContext(
  retrieval: RetrievalResult,
  input: BuildStudyContextInput,
  options: AssembleOptions = {},
): StudyContext {
  const now = options.now ?? new Date()
  const maxChars = options.maxChars ?? 4000
  const sourceIdsByDocument = options.sourceIdsByDocument ?? {}
  const warnings: string[] = []

  if (retrieval.status === 'not-implemented') {
    warnings.push('La recuperación documental no está conectada. No hay fragmentos ni citas.')
  }
  if (retrieval.status === 'empty') {
    warnings.push('Sin fragmentos para la consulta. No se generará contenido.')
  }
  if (retrieval.status === 'error') {
    warnings.push('Error de recuperación: ' + (retrieval.error ?? 'desconocido'))
  }
  if (retrieval.results.some((hit) => hit.metadata.isDemo)) {
    warnings.push('Hay fragmentos marcados como DEMO: no son material clínico autorizado.')
  }
  if (retrieval.results.some((hit) => hit.citation.page === null && hit.citation.section === null)) {
    warnings.push('Algunos fragmentos no tienen página ni sección conocidas: la cita queda sin localización.')
  }

  const text = renderContextText(retrieval.results, maxChars)

  return {
    query: input.query,
    chunks: retrieval.results,
    sources: sourcesFromHits(retrieval.results, sourceIdsByDocument),
    citations: dedupeCitations(retrieval.results.map((hit) => hit.citation)),
    text,
    metadata: {
      query: input.query,
      subjectId: input.subjectId ?? null,
      topicId: input.topicId ?? null,
      documentIds: input.documentIds ?? [],
      maxResults: input.maxResults ?? retrieval.results.length,
      providerId: retrieval.providerId,
      status: retrieval.status,
      generatedAt: now.toISOString(),
      hitCount: retrieval.results.length,
      characters: text.length,
    },
    warnings,
  }
}

/**
 * Recupera fragmentos relevantes y construye el contexto que se entregará
 * (en una fase futura) al modelo generativo.
 */
export async function buildStudyContext(
  provider: DocumentSearchProvider,
  input: BuildStudyContextInput,
  options: AssembleOptions = {},
): Promise<StudyContext> {
  const retrieval = await provider.search({
    text: input.query,
    subjectId: input.subjectId ?? null,
    topicId: input.topicId ?? null,
    documentIds: input.documentIds,
    maxResults: input.maxResults,
  })
  return assembleStudyContext(retrieval, input, options)
}

export function contextIsEmpty(context: StudyContext): boolean {
  return context.chunks.length === 0
}

export function contextSourceIds(context: StudyContext): string[] {
  const ids = new Set<string>()
  for (const source of context.sources) {
    for (const id of source.sourceIds) ids.add(id)
  }
  return Array.from(ids)
}

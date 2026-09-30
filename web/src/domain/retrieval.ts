import { citationFromChunk, dedupeCitations } from './citations'
import type { Citation } from './citations'
import { applyTransition, createDocumentRecord, documentStatusLabels, findDuplicateDocument, planChunks } from './documents'
import type { DocumentChunk, DocumentError, DocumentIndex, DocumentMetadata, DocumentRecord } from './documents'
import { normalizeSearchText } from './search'
import type { SourceType } from './types'

export type RetrievalCapability =
  | 'semantic-search'
  | 'topic-lookup'
  | 'question-lookup'
  | 'atlas-context'
  | 'summary-generation'
  | 'flashcard-generation'

export const retrievalCapabilities: RetrievalCapability[] = [
  'semantic-search',
  'topic-lookup',
  'question-lookup',
  'atlas-context',
  'summary-generation',
  'flashcard-generation',
]

export type RetrievalQuery = {
  text: string
  subjectId?: string | null
  topicId?: string | null
  documentIds?: string[]
  maxResults?: number
}

export type RetrievalHitMetadata = {
  documentTitle: string
  versionId: string
  versionLabel: string
  page: number | null
  section: string | null
  subjectId: string | null
  sourceType: SourceType
  chunkIndex: number
  isDemo: boolean
}

export type RetrievalHit = {
  documentId: string
  chunkId: string
  text: string
  score: number
  citation: Citation
  metadata: RetrievalHitMetadata
}

export type RetrievalStatus = 'ok' | 'empty' | 'not-implemented' | 'error'

export type RetrievalResult = {
  query: string
  results: RetrievalHit[]
  providerId: string
  status: RetrievalStatus
  error: string | null
  generatedAt: string
  capabilities: RetrievalCapability[]
}

export type UploadDocumentInput = {
  fileName: string
  mimeType: string
  checksum: string
  text: string
  subjectId?: string | null
  sourceType?: SourceType
  metadata?: Partial<DocumentMetadata>
  page?: number | null
  section?: string | null
  maxChars?: number
  isDemo?: boolean
}

export type UploadDocumentResult = {
  ok: boolean
  documentId: string | null
  chunkCount: number
  error: DocumentError | null
}

export type IndexDocumentResult = {
  ok: boolean
  documentId: string
  chunkCount: number
  indexedAt: string | null
  error: DocumentError | null
}

/**
 * Contrato de recuperación documental.
 * La aplicación depende de esta interfaz, nunca del SDK de un proveedor.
 */
export type DocumentSearchProvider = {
  id: string
  label: string
  status: 'mock' | 'ready' | 'not-implemented'
  capabilities: RetrievalCapability[]
  uploadDocument: (input: UploadDocumentInput) => Promise<UploadDocumentResult>
  indexDocument: (documentId: string) => Promise<IndexDocumentResult>
  search: (query: RetrievalQuery) => Promise<RetrievalResult>
  getDocument: (documentId: string) => Promise<DocumentRecord | null>
  deleteDocument: (documentId: string) => Promise<boolean>
}

export type MockProviderOptions = {
  now?: () => Date
  providerId?: string
}

export type SeedDocumentInput = {
  id: string
  fileName: string
  mimeType: string
  checksum: string
  text: string
  subjectId?: string | null
  sourceType?: SourceType
  metadata?: Partial<DocumentMetadata>
  isDemo?: boolean
  status?: DocumentRecord['status']
}

/**
 * El proveedor mock añade un método extra para rehidratar documentos
 * ya persistidos sin cambiar el contrato genérico.
 */
export type MockDocumentSearchProvider = DocumentSearchProvider & {
  seedDocument: (input: SeedDocumentInput) => Promise<DocumentRecord>
}

function tokenize(value: string): string[] {
  return normalizeSearchText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

function scoreChunk(chunkText: string, queryTokens: string[], queryNormalized: string): number {
  const haystack = normalizeSearchText(chunkText)
  if (queryNormalized.length === 0) return 0
  if (haystack.includes(queryNormalized)) return 1
  if (queryTokens.length === 0) return 0
  let matches = 0
  for (const token of queryTokens) {
    if (haystack.includes(token)) matches += 1
  }
  return matches / queryTokens.length
}

/**
 * Proveedor local. No llama a ninguna red y solo indexa el texto que se le
 * entrega: nunca genera contenido por su cuenta.
 */
export function createMockDocumentSearchProvider(options: MockProviderOptions = {}): MockDocumentSearchProvider {
  const now = options.now ?? (() => new Date())
  const providerId = options.providerId ?? 'mock-document-search'
  const documents = new Map<string, DocumentRecord>()
  const chunks = new Map<string, DocumentChunk[]>()
  const indexes = new Map<string, DocumentIndex>()
  let counter = 0

  function nextId(prefix: string, at: Date): string {
    counter += 1
    return prefix + '-' + String(at.getTime()) + '-' + String(counter)
  }

  return {
    id: providerId,
    label: 'Proveedor documental mock (local)',
    status: 'mock',
    capabilities: retrievalCapabilities,

    uploadDocument: async (input) => {
      const at = now()
      const duplicate = findDuplicateDocument(Array.from(documents.values()), input.checksum)
      if (duplicate) {
        return {
          ok: false,
          documentId: duplicate.id,
          chunkCount: 0,
          error: { code: 'duplicate-document', message: 'Ya existe un documento con el mismo checksum: ' + duplicate.id, at: at.toISOString() },
        }
      }
      if (input.text.trim().length === 0) {
        return {
          ok: false,
          documentId: null,
          chunkCount: 0,
          error: { code: 'invalid-document', message: 'El documento no contiene texto para indexar.', at: at.toISOString() },
        }
      }

      const id = nextId('doc', at)
      const record = createDocumentRecord({
        id,
        fileName: input.fileName,
        mimeType: input.mimeType,
        checksum: input.checksum,
        now: at,
        subjectId: input.subjectId ?? null,
        sourceType: input.sourceType ?? 'manual',
        metadata: input.metadata,
        isDemo: input.isDemo ?? false,
      })
      const planned = planChunks({
        documentId: id,
        versionId: record.versionId,
        text: input.text,
        now: at,
        maxChars: input.maxChars,
        isDemo: input.isDemo ?? false,
        page: input.page ?? null,
        section: input.section ?? null,
      })
      documents.set(id, { ...record, chunkCount: planned.length })
      chunks.set(id, planned)
      return { ok: true, documentId: id, chunkCount: planned.length, error: null }
    },

    indexDocument: async (documentId) => {
      const record = documents.get(documentId)
      const at = now()
      if (!record) {
        return {
          ok: false,
          documentId,
          chunkCount: 0,
          indexedAt: null,
          error: { code: 'invalid-document', message: 'Documento desconocido: ' + documentId, at: at.toISOString() },
        }
      }
      const toProcessing = applyTransition(record, 'processing', at)
      if (!toProcessing.ok) {
        return { ok: false, documentId, chunkCount: record.chunkCount, indexedAt: null, error: { code: 'indexing-error', message: toProcessing.reason, at: at.toISOString() } }
      }
      const toIndexed = applyTransition(toProcessing.record, 'indexed', at)
      if (!toIndexed.ok) {
        return { ok: false, documentId, chunkCount: record.chunkCount, indexedAt: null, error: { code: 'indexing-error', message: toIndexed.reason, at: at.toISOString() } }
      }
      const documentChunks = chunks.get(documentId) ?? []
      const updated: DocumentRecord = {
        ...toIndexed.record,
        chunkCount: documentChunks.length,
        lastIndexedAt: at.toISOString(),
        error: null,
      }
      documents.set(documentId, updated)
      indexes.set(documentId, {
        documentId,
        versionId: updated.versionId,
        chunkIds: documentChunks.map((chunk) => chunk.id),
        indexedAt: at.toISOString(),
        providerId,
      })
      return { ok: true, documentId, chunkCount: documentChunks.length, indexedAt: at.toISOString(), error: null }
    },

    search: async (query) => {
      const at = now()
      const normalized = normalizeSearchText(query.text)
      const tokens = tokenize(query.text)
      const allow = query.documentIds && query.documentIds.length > 0 ? new Set(query.documentIds) : null
      const maxResults = Math.max(1, query.maxResults ?? 5)

      if (normalized.length === 0) {
        return { query: query.text, results: [], providerId, status: 'empty', error: null, generatedAt: at.toISOString(), capabilities: retrievalCapabilities }
      }

      const hits: RetrievalHit[] = []
      for (const record of documents.values()) {
        if (allow && !allow.has(record.id)) continue
        if (query.subjectId && record.subjectId !== query.subjectId) continue
        if (record.status === 'outdated') continue
        for (const chunk of chunks.get(record.id) ?? []) {
          const score = scoreChunk(chunk.text, tokens, normalized)
          if (score <= 0) continue
          hits.push({
            documentId: record.id,
            chunkId: chunk.id,
            text: chunk.text,
            score: Math.round(score * 1000) / 1000,
            citation: citationFromChunk(chunk, record),
            metadata: {
              documentTitle: record.metadata.title,
              versionId: chunk.versionId,
              versionLabel: record.versionLabel,
              page: chunk.page,
              section: chunk.section,
              subjectId: record.subjectId,
              sourceType: record.sourceType,
              chunkIndex: chunk.index,
              isDemo: record.isDemo,
            },
          })
        }
      }

      hits.sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
      const limited = hits.slice(0, maxResults)
      return {
        query: query.text,
        results: limited,
        providerId,
        status: limited.length === 0 ? 'empty' : 'ok',
        error: null,
        generatedAt: at.toISOString(),
        capabilities: retrievalCapabilities,
      }
    },

    seedDocument: async (input) => {
      const at = now()
      const record = createDocumentRecord({
        id: input.id,
        fileName: input.fileName,
        mimeType: input.mimeType,
        checksum: input.checksum,
        now: at,
        subjectId: input.subjectId ?? null,
        sourceType: input.sourceType ?? 'manual',
        metadata: input.metadata,
        isDemo: input.isDemo ?? false,
      })
      const planned = planChunks({
        documentId: input.id,
        versionId: record.versionId,
        text: input.text,
        now: at,
        isDemo: input.isDemo ?? false,
      })
      const status = input.status ?? 'indexed'
      const restored: DocumentRecord = {
        ...record,
        status,
        chunkCount: planned.length,
        lastIndexedAt: status === 'indexed' ? record.createdAt : null,
      }
      documents.set(input.id, restored)
      chunks.set(input.id, planned)
      indexes.set(input.id, {
        documentId: input.id,
        versionId: restored.versionId,
        chunkIds: planned.map((chunk) => chunk.id),
        indexedAt: restored.createdAt,
        providerId,
      })
      return restored
    },

    getDocument: async (documentId) => documents.get(documentId) ?? null,

    deleteDocument: async (documentId) => {
      const existed = documents.delete(documentId)
      chunks.delete(documentId)
      indexes.delete(documentId)
      return existed
    },
  }
}

/**
 * TODO (Fase 5): implementar con Gemini File Search.
 * No importa ningún SDK y no realiza peticiones de red.
 */
export const geminiFileSearchProvider: DocumentSearchProvider = {
  id: 'gemini-file-search',
  label: 'Gemini File Search (no conectado)',
  status: 'not-implemented',
  capabilities: [],
  uploadDocument: async () => ({
    ok: false,
    documentId: null,
    chunkCount: 0,
    error: { code: 'unsupported-format', message: 'Gemini File Search no está conectado en esta fase.', at: new Date(0).toISOString() },
  }),
  indexDocument: async (documentId) => ({
    ok: false,
    documentId,
    chunkCount: 0,
    indexedAt: null,
    error: { code: 'indexing-error', message: 'Gemini File Search no está conectado en esta fase.', at: new Date(0).toISOString() },
  }),
  search: async (query) => ({
    query: query.text,
    results: [],
    providerId: 'gemini-file-search',
    status: 'not-implemented',
    error: 'TODO: implementar Gemini File Search en la fase de conexión.',
    generatedAt: new Date(0).toISOString(),
    capabilities: [],
  }),
  getDocument: async () => null,
  deleteDocument: async () => false,
}

export function describeProviderStatus(provider: DocumentSearchProvider): string {
  if (provider.status === 'mock') return 'Proveedor local mock: sin red y sin IA.'
  if (provider.status === 'not-implemented') return 'Proveedor no conectado todavía.'
  return 'Proveedor listo.'
}

export function retrievalSummary(result: RetrievalResult): string {
  if (result.status === 'empty') return 'Sin fragmentos para la consulta.'
  if (result.status === 'not-implemented') return 'Recuperación no conectada.'
  if (result.status === 'error') return 'Error de recuperación: ' + (result.error ?? 'desconocido')
  return String(result.results.length) + ' fragmentos recuperados.'
}

export function collectCitations(result: RetrievalResult): Citation[] {
  return dedupeCitations(result.results.map((hit) => hit.citation))
}

export function documentStatusLabel(record: DocumentRecord): string {
  return documentStatusLabels[record.status]
}

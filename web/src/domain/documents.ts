import type { CitationRange } from './citations'
import type { SourceType } from './types'

export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed' | 'outdated'

export type DocumentErrorCode =
  | 'unsupported-format'
  | 'invalid-document'
  | 'duplicate-document'
  | 'indexing-error'
  | 'retrieval-error'
  | 'unknown'

export type DocumentError = {
  code: DocumentErrorCode
  message: string
  at: string
}

export const documentErrorLabels: Record<DocumentErrorCode, string> = {
  'unsupported-format': 'Formato no soportado',
  'invalid-document': 'Documento inválido',
  'duplicate-document': 'Documento duplicado',
  'indexing-error': 'Error de indexación',
  'retrieval-error': 'Error de recuperación',
  unknown: 'Error desconocido',
}

/**
 * Metadatos bibliográficos. Todo lo que no se conoce es null:
 * no se inventa autor, edición, año ni editorial.
 */
export type DocumentMetadata = {
  title: string
  author: string | null
  edition: string | null
  year: number | null
  publisher: string | null
  language: string | null
  pages: number | null
  notes: string | null
}

export type DocumentRecord = {
  id: string
  subjectId: string | null
  sourceType: SourceType
  fileName: string
  mimeType: string
  checksum: string
  status: DocumentStatus
  metadata: DocumentMetadata
  versionId: string
  versionLabel: string
  sourceIds: string[]
  chunkCount: number
  lastIndexedAt: string | null
  error: DocumentError | null
  createdAt: string
  updatedAt: string
  isDemo: boolean
}

export type DocumentVersion = {
  id: string
  documentId: string
  label: string
  checksum: string
  createdAt: string
  isDemo: boolean
}

export type DocumentChunk = {
  id: string
  documentId: string
  versionId: string
  index: number
  text: string
  charRange: CitationRange
  page: number | null
  section: string | null
  isDemo: boolean
}

export type DocumentIndex = {
  documentId: string
  versionId: string
  chunkIds: string[]
  indexedAt: string
  providerId: string
}

export const documentStatuses: DocumentStatus[] = ['pending', 'processing', 'indexed', 'failed', 'outdated']

export const documentStatusLabels: Record<DocumentStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  indexed: 'Indexado',
  failed: 'Fallido',
  outdated: 'Desactualizado',
}

const allowedTransitions: Record<DocumentStatus, DocumentStatus[]> = {
  pending: ['processing', 'failed'],
  processing: ['indexed', 'failed'],
  indexed: ['outdated', 'processing'],
  failed: ['pending', 'processing'],
  outdated: ['processing'],
}

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  if (from === to) return true
  return allowedTransitions[from].includes(to)
}

export function isTerminalStatus(status: DocumentStatus): boolean {
  return status === 'indexed' || status === 'failed'
}

export type TransitionResult = { ok: true; record: DocumentRecord } | { ok: false; reason: string }

export function applyTransition(record: DocumentRecord, to: DocumentStatus, now: Date): TransitionResult {
  if (!canTransition(record.status, to)) {
    return { ok: false, reason: 'Transición no permitida: ' + record.status + ' -> ' + to }
  }
  return {
    ok: true,
    record: { ...record, status: to, updatedAt: now.toISOString(), error: to === 'failed' ? record.error : null },
  }
}

export function defaultMetadata(title: string): DocumentMetadata {
  return {
    title,
    author: null,
    edition: null,
    year: null,
    publisher: null,
    language: null,
    pages: null,
    notes: null,
  }
}

export type CreateDocumentInput = {
  id: string
  fileName: string
  mimeType: string
  checksum: string
  now: Date
  subjectId?: string | null
  sourceType?: SourceType
  metadata?: Partial<DocumentMetadata>
  versionId?: string
  versionLabel?: string
  isDemo?: boolean
}

export function createDocumentRecord(input: CreateDocumentInput): DocumentRecord {
  const at = input.now.toISOString()
  const title = input.metadata?.title && input.metadata.title.trim().length > 0 ? input.metadata.title.trim() : input.fileName
  const metadata: DocumentMetadata = {
    ...defaultMetadata(title),
    author: input.metadata?.author ?? null,
    edition: input.metadata?.edition ?? null,
    year: typeof input.metadata?.year === 'number' ? input.metadata.year : null,
    publisher: input.metadata?.publisher ?? null,
    language: input.metadata?.language ?? null,
    pages: typeof input.metadata?.pages === 'number' ? input.metadata.pages : null,
    notes: input.metadata?.notes ?? null,
  }

  return {
    id: input.id,
    subjectId: input.subjectId ?? null,
    sourceType: input.sourceType ?? 'manual',
    fileName: input.fileName,
    mimeType: input.mimeType,
    checksum: input.checksum,
    status: 'pending',
    metadata,
    versionId: input.versionId ?? input.id + '-v1',
    versionLabel: input.versionLabel ?? 'v1',
    sourceIds: [],
    chunkCount: 0,
    lastIndexedAt: null,
    error: null,
    createdAt: at,
    updatedAt: at,
    isDemo: input.isDemo ?? false,
  }
}

export function createDocumentVersion(record: DocumentRecord, now: Date, label: string): DocumentVersion {
  return {
    id: record.id + '-' + label,
    documentId: record.id,
    label,
    checksum: record.checksum,
    createdAt: now.toISOString(),
    isDemo: record.isDemo,
  }
}

export function findDuplicateDocument(records: DocumentRecord[], checksum: string): DocumentRecord | undefined {
  return records.find((record) => record.checksum.length > 0 && record.checksum === checksum)
}

export function validateDocumentRecord(record: DocumentRecord): string[] {
  const issues: string[] = []
  if (record.id.trim().length === 0) issues.push('id vacío')
  if (record.fileName.trim().length === 0) issues.push('fileName vacío')
  if (record.mimeType.trim().length === 0) issues.push('mimeType vacío')
  if (record.metadata.title.trim().length === 0) issues.push('title vacío')
  if (!documentStatuses.includes(record.status)) issues.push('estado desconocido: ' + record.status)
  if (record.chunkCount < 0) issues.push('chunkCount negativo')
  if (record.metadata.year !== null && (record.metadata.year < 1000 || record.metadata.year > 3000)) {
    issues.push('year fuera de rango razonable')
  }
  return issues
}

export type ChunkPlanInput = {
  documentId: string
  versionId: string
  text: string
  now: Date
  maxChars?: number
  isDemo?: boolean
  page?: number | null
  section?: string | null
}

/**
 * Fragmentación determinista: mismos metadatos y mismo texto producen los
 * mismos identificadores, para que las citas sigan siendo válidas tras recargar.
 * No genera texto: solo divide el texto que se le entrega.
 */
export function planChunks(input: ChunkPlanInput): DocumentChunk[] {
  const maxChars = Math.max(80, input.maxChars ?? 400)
  const text = input.text
  if (text.length === 0) return []

  const chunks: DocumentChunk[] = []
  let start = 0
  let index = 0
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length)
    if (end < text.length) {
      const slice = text.slice(start, end)
      const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '))
      if (lastBreak > Math.floor(maxChars * 0.4)) end = start + lastBreak + 1
    }
    const slice = text.slice(start, end)
    chunks.push({
      id: input.documentId + ':' + input.versionId + ':c' + String(index),
      documentId: input.documentId,
      versionId: input.versionId,
      index,
      text: slice,
      charRange: { start, end },
      page: typeof input.page === 'number' ? input.page : null,
      section: input.section ?? null,
      isDemo: input.isDemo ?? false,
    })
    start = end
    index += 1
  }
  return chunks
}

export function documentStatusSummary(records: DocumentRecord[]): Record<DocumentStatus, number> {
  const summary: Record<DocumentStatus, number> = {
    pending: 0,
    processing: 0,
    indexed: 0,
    failed: 0,
    outdated: 0,
  }
  for (const record of records) summary[record.status] += 1
  return summary
}

export function countChunks(chunks: DocumentChunk[]): number {
  return chunks.length
}

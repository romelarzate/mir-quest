import { describe, expect, it } from 'vitest'
import {
  applyTransition,
  canTransition,
  createDocumentRecord,
  createDocumentVersion,
  defaultMetadata,
  documentStatusSummary,
  findDuplicateDocument,
  isTerminalStatus,
  planChunks,
  validateDocumentRecord,
} from './documents'
import type { DocumentRecord } from './documents'

const now = new Date('2026-09-29T09:00:00.000Z')

function record(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  const base = createDocumentRecord({
    id: 'doc-1',
    fileName: 'material.pdf',
    mimeType: 'application/pdf',
    checksum: 'abc123',
    now,
    subjectId: 'cardiologia',
  })
  return { ...base, ...overrides }
}

describe('createDocumentRecord', () => {
  it('crea el documento en estado pendiente', () => {
    const created = record()
    expect(created.status).toBe('pending')
    expect(created.chunkCount).toBe(0)
    expect(created.lastIndexedAt).toBeNull()
    expect(created.error).toBeNull()
  })

  it('no inventa metadatos bibliográficos', () => {
    const created = record()
    expect(created.metadata.author).toBeNull()
    expect(created.metadata.edition).toBeNull()
    expect(created.metadata.year).toBeNull()
    expect(created.metadata.publisher).toBeNull()
    expect(created.metadata.pages).toBeNull()
  })

  it('usa el nombre de archivo como título cuando no hay metadatos', () => {
    expect(record().metadata.title).toBe('material.pdf')
  })

  it('respeta un año solo si se aporta', () => {
    const created = createDocumentRecord({
      id: 'doc-2',
      fileName: 'x.pdf',
      mimeType: 'application/pdf',
      checksum: 'xyz',
      now,
      metadata: { title: 'Manual', year: 2019 },
    })
    expect(created.metadata.year).toBe(2019)
  })

  it('declara metadatos vacíos por defecto', () => {
    const meta = defaultMetadata('Título')
    expect(meta.title).toBe('Título')
    expect(meta.notes).toBeNull()
  })
})

describe('estados del documento', () => {
  it('permite las transiciones previstas', () => {
    expect(canTransition('pending', 'processing')).toBe(true)
    expect(canTransition('processing', 'indexed')).toBe(true)
    expect(canTransition('indexed', 'outdated')).toBe(true)
    expect(canTransition('failed', 'pending')).toBe(true)
  })

  it('rechaza transiciones no permitidas', () => {
    expect(canTransition('pending', 'indexed')).toBe(false)
    expect(canTransition('outdated', 'indexed')).toBe(false)
    const result = applyTransition(record(), 'indexed', now)
    expect(result.ok).toBe(false)
  })

  it('aplica la transición y actualiza la marca de tiempo', () => {
    const result = applyTransition(record(), 'processing', now)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.record.status).toBe('processing')
      expect(result.record.updatedAt).toBe(now.toISOString())
    }
  })

  it('limpia el error al salir de fallido', () => {
    const failed = record({ status: 'failed', error: { code: 'indexing-error', message: 'x', at: now.toISOString() } })
    const result = applyTransition(failed, 'processing', now)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.record.error).toBeNull()
  })

  it('identifica estados terminales', () => {
    expect(isTerminalStatus('indexed')).toBe(true)
    expect(isTerminalStatus('failed')).toBe(true)
    expect(isTerminalStatus('processing')).toBe(false)
  })

  it('resume por estado', () => {
    const summary = documentStatusSummary([record(), record({ id: 'b', status: 'indexed' }), record({ id: 'c', status: 'indexed' })])
    expect(summary.pending).toBe(1)
    expect(summary.indexed).toBe(2)
    expect(summary.failed).toBe(0)
  })
})

describe('planChunks', () => {
  it('divide el texto en fragmentos con rango de caracteres', () => {
    const text = 'a'.repeat(1000)
    const chunks = planChunks({ documentId: 'doc-1', versionId: 'doc-1-v1', text: text, now, maxChars: 200 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].charRange.start).toBe(0)
    expect(chunks[chunks.length - 1].charRange.end).toBe(1000)
  })

  it('genera identificadores deterministas', () => {
    const input = { documentId: 'doc-1', versionId: 'doc-1-v1', text: 'contenido de prueba suficientemente largo', now, maxChars: 20 }
    const first = planChunks(input).map((chunk) => chunk.id)
    const second = planChunks(input).map((chunk) => chunk.id)
    expect(first).toEqual(second)
  })

  it('no devuelve fragmentos sin texto', () => {
    expect(planChunks({ documentId: 'd', versionId: 'v', text: '', now })).toEqual([])
  })

  it('mantiene la página en null cuando no se conoce', () => {
    const chunks = planChunks({ documentId: 'd', versionId: 'v', text: 'texto de prueba', now })
    expect(chunks[0].page).toBeNull()
    expect(chunks[0].section).toBeNull()
  })

  it('conserva la página cuando se aporta', () => {
    const chunks = planChunks({ documentId: 'd', versionId: 'v', text: 'texto de prueba', now, page: 12 })
    expect(chunks[0].page).toBe(12)
  })
})

describe('duplicados y validación', () => {
  it('detecta un documento duplicado por checksum', () => {
    expect(findDuplicateDocument([record()], 'abc123')?.id).toBe('doc-1')
    expect(findDuplicateDocument([record()], 'otro')).toBeUndefined()
    expect(findDuplicateDocument([record({ checksum: '' })], '')).toBeUndefined()
  })

  it('valida un documento correcto', () => {
    expect(validateDocumentRecord(record())).toEqual([])
  })

  it('detecta problemas de validación', () => {
    const broken = record({ id: '', status: 'indexed', chunkCount: -1 })
    const issues = validateDocumentRecord(broken)
    expect(issues.length).toBeGreaterThan(0)
  })

  it('crea versiones ligadas al documento', () => {
    const version = createDocumentVersion(record(), now, 'v2')
    expect(version.documentId).toBe('doc-1')
    expect(version.label).toBe('v2')
    expect(version.id).toBe('doc-1-v2')
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildCitation,
  citationFromChunk,
  citationHasLocation,
  citationKey,
  dedupeCitations,
  finalizeCitation,
  formatCitation,
} from './citations'
import { createDocumentRecord, planChunks } from './documents'

const now = new Date('2026-09-29T09:00:00.000Z')

function baseCitation(overrides = {}) {
  return buildCitation({
    documentId: 'doc-1',
    documentVersionId: 'doc-1-v1',
    chunkId: 'doc-1:doc-1-v1:c0',
    documentTitle: 'Material DEMO',
    ...overrides,
  })
}

describe('buildCitation', () => {
  it('deja en null lo que no se conoce', () => {
    const citation = baseCitation()
    expect(citation.page).toBeNull()
    expect(citation.section).toBeNull()
    expect(citation.range).toBeNull()
  })

  it('no acepta páginas imposibles', () => {
    expect(baseCitation({ page: 0 }).page).toBeNull()
    expect(baseCitation({ page: -3 }).page).toBeNull()
    expect(baseCitation({ page: Number.NaN }).page).toBeNull()
    expect(baseCitation({ page: 7 }).page).toBe(7)
  })

  it('ignora secciones vacías', () => {
    expect(baseCitation({ section: '   ' }).section).toBeNull()
    expect(baseCitation({ section: 'Arritmias' }).section).toBe('Arritmias')
  })

  it('descarta rangos inválidos', () => {
    expect(baseCitation({ range: { start: 10, end: 10 } }).range).toBeNull()
    expect(baseCitation({ range: { start: 5, end: 9 } }).range).toEqual({ start: 5, end: 9 })
  })
})

describe('etiquetas de cita', () => {
  it('indica ausencia de página cuando no hay localización', () => {
    const citation = finalizeCitation(baseCitation())
    expect(citation.label).toContain('sin página')
    expect(citationHasLocation(citation)).toBe(false)
  })

  it('incluye página, sección y rango cuando existen', () => {
    const citation = finalizeCitation(baseCitation({ page: 12, section: 'Arritmias', range: { start: 0, end: 40 } }))
    expect(citation.label).toContain('pág. 12')
    expect(citation.label).toContain('Arritmias')
    expect(citation.label).toContain('car. 0-40')
    expect(citationHasLocation(citation)).toBe(true)
  })

  it('formatea con la etiqueta calculada', () => {
    const citation = finalizeCitation(baseCitation({ page: 3 }))
    expect(formatCitation(citation)).toBe(citation.label)
    expect(formatCitation(baseCitation())).toContain('sin página')
  })
})

describe('trazabilidad de fragmentos', () => {
  it('construye la cita desde un fragmento real', () => {
    const document = createDocumentRecord({
      id: 'doc-9',
      fileName: 'manual.pdf',
      mimeType: 'application/pdf',
      checksum: 'chk',
      now,
      metadata: { title: 'Manual DEMO' },
    })
    const chunks = planChunks({ documentId: 'doc-9', versionId: document.versionId, text: 'texto de prueba', now, page: 4 })
    const citation = citationFromChunk(chunks[0], document)
    expect(citation.documentId).toBe('doc-9')
    expect(citation.chunkId).toBe(chunks[0].id)
    expect(citation.documentTitle).toBe('Manual DEMO')
    expect(citation.page).toBe(4)
    expect(citation.range).toEqual({ start: 0, end: 15 })
  })

  it('elimina citas repetidas', () => {
    const citation = finalizeCitation(baseCitation())
    expect(dedupeCitations([citation, citation]).length).toBe(1)
    expect(dedupeCitations([citation, finalizeCitation(baseCitation({ chunkId: 'otro' }))]).length).toBe(2)
  })

  it('identifica la cita por documento, versión y fragmento', () => {
    const citation = finalizeCitation(baseCitation())
    expect(citationKey(citation)).toBe('doc-1|doc-1-v1|doc-1:doc-1-v1:c0')
  })
})

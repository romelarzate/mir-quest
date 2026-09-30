import { describe, expect, it } from 'vitest'
import {
  collectCitations,
  createMockDocumentSearchProvider,
  geminiFileSearchProvider,
  retrievalSummary,
} from './retrieval'

const now = new Date('2026-09-29T09:00:00.000Z')
const demoText = 'Fragmento DEMO de prueba para indexación local. Contenido sin valor clínico, repetido lo suficiente para permitir la recuperación.'

function provider() {
  return createMockDocumentSearchProvider({ now: () => now })
}

async function uploaded() {
  const mock = provider()
  const upload = await mock.uploadDocument({
    fileName: 'material-demo.pdf',
    mimeType: 'application/pdf',
    checksum: 'chk-1',
    text: demoText,
    subjectId: 'cardiologia',
    isDemo: true,
    maxChars: 60,
  })
  return { mock, upload }
}

describe('proveedor mock', () => {
  it('se declara local y mock', () => {
    const mock = provider()
    expect(mock.status).toBe('mock')
    expect(mock.id).toBe('mock-document-search')
    expect(mock.capabilities.length).toBeGreaterThan(0)
  })

  it('sube un documento y lo fragmenta', async () => {
    const { upload } = await uploaded()
    expect(upload.ok).toBe(true)
    expect(upload.chunkCount).toBeGreaterThan(0)
  })

  it('rechaza texto vacío', async () => {
    const mock = provider()
    const result = await mock.uploadDocument({ fileName: 'x.pdf', mimeType: 'application/pdf', checksum: 'c', text: '   ' })
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('invalid-document')
  })

  it('rechaza un documento duplicado por checksum', async () => {
    const { mock } = await uploaded()
    const again = await mock.uploadDocument({ fileName: 'otro.pdf', mimeType: 'application/pdf', checksum: 'chk-1', text: demoText })
    expect(again.ok).toBe(false)
    expect(again.error?.code).toBe('duplicate-document')
  })

  it('indexa y actualiza el estado del documento', async () => {
    const { mock, upload } = await uploaded()
    const indexed = await mock.indexDocument(String(upload.documentId))
    expect(indexed.ok).toBe(true)
    const document = await mock.getDocument(String(upload.documentId))
    expect(document?.status).toBe('indexed')
    expect(document?.chunkCount).toBe(indexed.chunkCount)
    expect(document?.lastIndexedAt).toBe(now.toISOString())
  })

  it('devuelve error al indexar un documento desconocido', async () => {
    const mock = provider()
    const result = await mock.indexDocument('no-existe')
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('invalid-document')
  })

  it('recupera fragmentos con cita y metadatos', async () => {
    const { mock, upload } = await uploaded()
    await mock.indexDocument(String(upload.documentId))
    const result = await mock.search({ text: 'indexación local' })
    expect(result.status).toBe('ok')
    expect(result.results.length).toBeGreaterThan(0)
    const hit = result.results[0]
    expect(hit.documentId).toBe(upload.documentId)
    expect(hit.chunkId).toContain(':c')
    expect(hit.citation.chunkId).toBe(hit.chunkId)
    expect(hit.metadata.documentTitle).toBe('material-demo.pdf')
    expect(hit.metadata.isDemo).toBe(true)
    expect(hit.score).toBeGreaterThan(0)
  })

  it('no devuelve nada sin coincidencias', async () => {
    const { mock, upload } = await uploaded()
    await mock.indexDocument(String(upload.documentId))
    const result = await mock.search({ text: 'zzzz' })
    expect(result.status).toBe('empty')
    expect(result.results).toEqual([])
  })

  it('devuelve vacío con consulta vacía', async () => {
    const { mock } = await uploaded()
    const result = await mock.search({ text: '   ' })
    expect(result.status).toBe('empty')
  })

  it('respeta el límite de resultados', async () => {
    const { mock, upload } = await uploaded()
    await mock.indexDocument(String(upload.documentId))
    const result = await mock.search({ text: 'para', maxResults: 1 })
    expect(result.results.length).toBeLessThanOrEqual(1)
  })

  it('filtra por asignatura', async () => {
    const { mock, upload } = await uploaded()
    await mock.indexDocument(String(upload.documentId))
    const none = await mock.search({ text: 'indexación', subjectId: 'neumologia' })
    expect(none.results).toEqual([])
  })

  it('filtra por identificadores de documento', async () => {
    const { mock, upload } = await uploaded()
    await mock.indexDocument(String(upload.documentId))
    const limited = await mock.search({ text: 'indexación', documentIds: ['otro-documento'] })
    expect(limited.results).toEqual([])
  })

  it('elimina un documento', async () => {
    const { mock, upload } = await uploaded()
    expect(await mock.deleteDocument(String(upload.documentId))).toBe(true)
    expect(await mock.getDocument(String(upload.documentId))).toBeNull()
    expect(await mock.deleteDocument('no-existe')).toBe(false)
  })

  it('resume el resultado y recoge citas', async () => {
    const { mock, upload } = await uploaded()
    await mock.indexDocument(String(upload.documentId))
    const result = await mock.search({ text: 'indexación' })
    expect(retrievalSummary(result)).toContain('fragmentos recuperados')
    expect(collectCitations(result).length).toBeGreaterThan(0)
  })
})

describe('proveedor Gemini', () => {
  it('existe como marcador no conectado', () => {
    expect(geminiFileSearchProvider.status).toBe('not-implemented')
    expect(geminiFileSearchProvider.capabilities).toEqual([])
  })

  it('no realiza ninguna operación real', async () => {
    const search = await geminiFileSearchProvider.search({ text: 'consulta' })
    expect(search.status).toBe('not-implemented')
    expect(search.results).toEqual([])
    expect(String(search.error)).toContain('TODO')
    const upload = await geminiFileSearchProvider.uploadDocument({ fileName: 'x.pdf', mimeType: 'application/pdf', checksum: 'c', text: 'texto' })
    expect(upload.ok).toBe(false)
    expect(await geminiFileSearchProvider.getDocument('x')).toBeNull()
    expect(await geminiFileSearchProvider.deleteDocument('x')).toBe(false)
  })
})

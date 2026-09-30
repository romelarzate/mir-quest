import { describe, expect, it } from 'vitest'
import { assembleStudyContext, buildStudyContext, contextIsEmpty, contextSourceIds } from './context'
import { createMockDocumentSearchProvider } from './retrieval'
import type { RetrievalResult } from './retrieval'

const now = new Date('2026-09-29T09:00:00.000Z')
const demoText = 'Fragmento DEMO para construir contexto. Contenido sin valor clínico.'

async function seededProvider() {
  const mock = createMockDocumentSearchProvider({ now: () => now })
  const upload = await mock.uploadDocument({
    fileName: 'demo.pdf',
    mimeType: 'application/pdf',
    checksum: 'ctx-1',
    text: demoText,
    subjectId: 'cardiologia',
    isDemo: true,
  })
  await mock.indexDocument(String(upload.documentId))
  return mock
}

function notImplementedResult(): RetrievalResult {
  return {
    query: 'algo',
    results: [],
    providerId: 'gemini-file-search',
    status: 'not-implemented',
    error: 'TODO',
    generatedAt: now.toISOString(),
    capabilities: [],
  }
}

describe('assembleStudyContext', () => {
  it('avisa cuando la recuperación no está conectada', () => {
    const context = assembleStudyContext(notImplementedResult(), { query: 'algo' }, { now })
    expect(contextIsEmpty(context)).toBe(true)
    expect(context.warnings.some((warning) => warning.includes('no está conectada'))).toBe(true)
    expect(context.citations).toEqual([])
    expect(context.text).toBe('')
  })

  it('incluye metadatos de la consulta', () => {
    const context = assembleStudyContext(notImplementedResult(), { query: 'algo', subjectId: 'cardiologia', topicId: 'topic-x' }, { now })
    expect(context.metadata.query).toBe('algo')
    expect(context.metadata.subjectId).toBe('cardiologia')
    expect(context.metadata.topicId).toBe('topic-x')
    expect(context.metadata.providerId).toBe('gemini-file-search')
    expect(context.metadata.hitCount).toBe(0)
  })
})

describe('buildStudyContext', () => {
  it('recupera fragmentos y construye el contexto', async () => {
    const mock = await seededProvider()
    const context = await buildStudyContext(mock, { query: 'contexto', subjectId: 'cardiologia', maxResults: 5 }, { now })
    expect(context.chunks.length).toBeGreaterThan(0)
    expect(context.citations.length).toBeGreaterThan(0)
    expect(context.sources.length).toBe(1)
    expect(context.metadata.status).toBe('ok')
    expect(context.metadata.characters).toBeGreaterThan(0)
  })

  it('incluye la etiqueta de cita en el texto del contexto', async () => {
    const mock = await seededProvider()
    const context = await buildStudyContext(mock, { query: 'contexto' }, { now })
    expect(context.text).toContain('sin página')
  })

  it('avisa de fragmentos DEMO y de citas sin localización', async () => {
    const mock = await seededProvider()
    const context = await buildStudyContext(mock, { query: 'contexto' }, { now })
    expect(context.warnings.some((warning) => warning.includes('DEMO'))).toBe(true)
    expect(context.warnings.some((warning) => warning.includes('página ni sección'))).toBe(true)
  })

  it('avisa cuando no hay fragmentos', async () => {
    const mock = await seededProvider()
    const context = await buildStudyContext(mock, { query: 'zzzz' }, { now })
    expect(contextIsEmpty(context)).toBe(true)
    expect(context.warnings.some((warning) => warning.includes('Sin fragmentos'))).toBe(true)
  })

  it('recorta el texto al máximo de caracteres', async () => {
    const mock = await seededProvider()
    const context = await buildStudyContext(mock, { query: 'contexto' }, { now, maxChars: 20 })
    expect(context.metadata.characters).toBeLessThanOrEqual(20)
  })

  it('propaga los identificadores de fuente de los documentos', async () => {
    const mock = await seededProvider()
    const context = await buildStudyContext(mock, { query: 'contexto' }, { now, sourceIdsByDocument: {} })
    expect(contextSourceIds(context)).toEqual([])
  })
})

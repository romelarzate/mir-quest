import { describe, expect, it } from 'vitest'
import { assembleStudyContext, buildStudyContext } from './context'
import type { StudyContext } from './context'
import {
  describeProvenance,
  generatorStatusLabel,
  generators,
  generationNotConnectedMessage,
  mockAtlasGenerator,
  mockFlashcardGenerator,
  mockQuestionGenerator,
  mockSummaryGenerator,
  provenanceFromContext,
  provenanceIsEmpty,
  provenanceIsTraceable,
} from './generation'
import { createMockDocumentSearchProvider } from './retrieval'

const now = new Date('2026-09-29T09:00:00.000Z')

async function context(): Promise<StudyContext> {
  const mock = createMockDocumentSearchProvider({ now: () => now })
  const upload = await mock.uploadDocument({
    fileName: 'demo.pdf',
    mimeType: 'application/pdf',
    checksum: 'gen-1',
    text: 'Fragmento DEMO para procedencia. Contenido sin valor clínico.',
    subjectId: 'cardiologia',
    isDemo: true,
  })
  await mock.indexDocument(String(upload.documentId))
  return buildStudyContext(mock, { query: 'procedencia' }, { now })
}

describe('procedencia', () => {
  it('extrae documentos, fragmentos y citas del contexto', async () => {
    const ctx = await context()
    const provenance = provenanceFromContext(ctx)
    expect(provenance.documentIds.length).toBe(1)
    expect(provenance.chunkIds.length).toBe(ctx.chunks.length)
    expect(provenance.citations.length).toBe(ctx.citations.length)
  })

  it('considera vacía la procedencia sin fragmentos', () => {
    const empty = { sourceIds: [], documentIds: [], chunkIds: [], citations: [] }
    expect(provenanceIsEmpty(empty)).toBe(true)
  })

  it('verifica que toda cita sale de un fragmento recuperado', async () => {
    const ctx = await context()
    expect(provenanceIsTraceable(provenanceFromContext(ctx))).toBe(true)
  })

  it('detecta una cita que no pertenece al contexto', async () => {
    const ctx = await context()
    const provenance = provenanceFromContext(ctx)
    const tampered = {
      ...provenance,
      citations: [...provenance.citations, { ...provenance.citations[0], chunkId: 'inventado' }],
    }
    expect(provenanceIsTraceable(tampered)).toBe(false)
  })

  it('describe la procedencia en texto', async () => {
    const ctx = await context()
    expect(describeProvenance(provenanceFromContext(ctx))).toContain('documentos')
  })
})

describe('generadores mock', () => {
  it('no producen contenido clínico', async () => {
    const ctx = await context()
    const summary = mockSummaryGenerator.generate({ context: ctx })
    expect(summary.text).toBe('')
    expect(summary.bullets).toEqual([])
    expect(summary.status).toBe('mock')

    const questions = mockQuestionGenerator.generate({ context: ctx, count: 2 })
    expect(questions.length).toBe(2)
    expect(questions.every((question) => question.stem === '')).toBe(true)
    expect(questions.every((question) => question.options.length === 0)).toBe(true)
    expect(questions.every((question) => question.correctOptionIndex === null)).toBe(true)

    const cards = mockFlashcardGenerator.generate({ context: ctx, count: 3 })
    expect(cards.length).toBe(3)
    expect(cards.every((card) => card.front === '' && card.back === '')).toBe(true)

    const atlas = mockAtlasGenerator.generate({ context: ctx })
    expect(atlas.text).toBe('')
  })

  it('conservan la procedencia en cada resultado', async () => {
    const ctx = await context()
    const summary = mockSummaryGenerator.generate({ context: ctx })
    expect(summary.provenance.chunkIds.length).toBeGreaterThan(0)
    expect(provenanceIsTraceable(summary.provenance)).toBe(true)

    const question = mockQuestionGenerator.generate({ context: ctx, count: 1 })[0]
    expect(question.provenance.documentIds.length).toBe(1)
    expect(provenanceIsTraceable(question.provenance)).toBe(true)

    const card = mockFlashcardGenerator.generate({ context: ctx, count: 1 })[0]
    expect(card.provenance.chunkIds.length).toBeGreaterThan(0)
  })

  it('avisan de que la IA no está conectada', async () => {
    const ctx = await context()
    const result = mockSummaryGenerator.generate({ context: ctx })
    expect(result.warnings).toContain(generationNotConnectedMessage)
  })

  it('avisan cuando no hay contexto recuperado', () => {
    const empty = assembleStudyContext(
      { query: 'x', results: [], providerId: 'mock', status: 'empty', error: null, generatedAt: now.toISOString(), capabilities: [] },
      { query: 'x' },
      { now },
    )
    const result = mockSummaryGenerator.generate({ context: empty })
    expect(result.warnings.some((warning) => warning.includes('No hay fragmentos'))).toBe(true)
  })

  it('aplica un mínimo de una unidad por defecto', async () => {
    const ctx = await context()
    expect(mockQuestionGenerator.generate({ context: ctx }).length).toBe(1)
    expect(mockFlashcardGenerator.generate({ context: ctx }).length).toBe(1)
  })

  it('expone el catálogo de generadores', () => {
    expect(generators.summary.status).toBe('mock')
    expect(generators.atlas.requiresAi).toBe(true)
    expect(generatorStatusLabel('mock')).toContain('IA no conectada')
  })
})

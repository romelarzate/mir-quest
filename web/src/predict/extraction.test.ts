import { describe, expect, it } from 'vitest'
import {
  confidenceThreshold,
  createExtractionResult,
  createQuarantineEntry,
  isUsableInAggregates,
  quarantineRules,
  reviewQuarantineEntry,
  summarizeExtraction,
  usableQuestionIds,
  validateExtractionResult,
  violatesQuarantineIsolation,
} from './extraction'

const now = new Date('2026-09-29T09:00:00.000Z')

const documented = {
  questionId: 'hq-1',
  rawText: 'Enunciado extraído de prueba.',
  now,
  confidence: 0.95,
  sourceDocumentId: 'doc-1',
  page: 12,
  hasStem: true,
  hasOptions: true,
  hasAnswer: true,
}

describe('decisión de extracción', () => {
  it('acepta una extracción completa y confiable', () => {
    const result = createExtractionResult(documented)
    expect(result.validationStatus).toBe('accepted')
    expect(result.validationErrors).toEqual([])
    expect(validateExtractionResult(result).ok).toBe(true)
  })

  it('pone en cuarentena lo dudoso sin descartarlo', () => {
    const lowConfidence = createExtractionResult({ ...documented, confidence: 0.4 })
    expect(lowConfidence.validationStatus).toBe('quarantined')
    expect(lowConfidence.validationErrors[0].code).toBe('low-confidence')

    const ambiguous = createExtractionResult({ ...documented, classificationAmbiguous: true })
    expect(ambiguous.validationStatus).toBe('quarantined')
    expect(ambiguous.validationErrors[0].code).toBe('ambiguous-classification')
  })

  it('rechaza lo que no se puede reconstruir', () => {
    expect(createExtractionResult({ ...documented, hasStem: false }).validationStatus).toBe('rejected')
    expect(createExtractionResult({ ...documented, hasOptions: false }).validationStatus).toBe('rejected')
    expect(createExtractionResult({ ...documented, hasAnswer: false }).validationStatus).toBe('rejected')
  })

  it('rechaza texto vacío y páginas ilegibles', () => {
    expect(createExtractionResult({ ...documented, rawText: '   ' }).validationStatus).toBe('rejected')
    const unreadable = createExtractionResult({ ...documented, page: 0 })
    expect(unreadable.validationStatus).toBe('quarantined')
    expect(unreadable.validationErrors.some((error) => error.code === 'unreadable-page')).toBe(true)
  })

  it('usa el umbral declarado', () => {
    expect(confidenceThreshold).toBe(0.8)
  })
})

describe('cuarentena', () => {
  it('no crea cuarentena para lo aceptado', () => {
    const accepted = createExtractionResult(documented)
    expect(createQuarantineEntry(accepted, now, 'q-1')).toBeNull()
  })

  it('conserva el material original para revisión', () => {
    const dudoso = createExtractionResult({ ...documented, confidence: 0.3 })
    const entry = createQuarantineEntry(dudoso, now, 'q-1')
    expect(entry).not.toBeNull()
    expect(entry?.rawText).toBe(dudoso.rawText)
    expect(entry?.sourceDocumentId).toBe('doc-1')
    expect(entry?.page).toBe(12)
    expect(entry?.reviewStatus).toBe('pending')
    expect(entry?.reason).toContain('low-confidence')
  })

  it('registra quién aprueba y cuándo', () => {
    const dudoso = createExtractionResult({ ...documented, confidence: 0.3 })
    const entry = createQuarantineEntry(dudoso, now, 'q-1')
    const approved = reviewQuarantineEntry(entry!, 'approved', 'revisor@demo', now)
    expect(approved.reviewStatus).toBe('approved')
    expect(approved.reviewedBy).toBe('revisor@demo')
    expect(approved.reviewedAt).toBe(now.toISOString())
  })
})

describe('aislamiento de cuarentena', () => {
  const results = [
    createExtractionResult(documented),
    createExtractionResult({ ...documented, questionId: 'hq-2', confidence: 0.2 }),
    createExtractionResult({ ...documented, questionId: 'hq-3', hasAnswer: false }),
  ]

  it('solo lo aceptado alimenta agregados', () => {
    expect(isUsableInAggregates('accepted')).toBe(true)
    expect(isUsableInAggregates('quarantined')).toBe(false)
    expect(isUsableInAggregates('rejected')).toBe(false)
    expect(usableQuestionIds(results)).toEqual(['hq-1'])
  })

  it('detecta un uso indebido de preguntas no aceptadas', () => {
    expect(violatesQuarantineIsolation(results, ['hq-1'])).toEqual([])
    expect(violatesQuarantineIsolation(results, ['hq-1', 'hq-2'])).toEqual(['hq-2'])
    expect(violatesQuarantineIsolation(results, ['hq-3'])).toEqual(['hq-3'])
  })

  it('resume por estado', () => {
    expect(summarizeExtraction(results)).toEqual({ accepted: 1, quarantined: 1, rejected: 1 })
  })

  it('documenta las reglas de cuarentena', () => {
    expect(quarantineRules.length).toBe(4)
    expect(quarantineRules.some((rule) => rule.includes('features'))).toBe(true)
  })
})

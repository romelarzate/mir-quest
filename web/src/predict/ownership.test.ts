import { describe, expect, it } from 'vitest'
import {
  assertWriteAllowed,
  canRead,
  canWrite,
  checkWrite,
  knowledgeCanWriteStudyEntities,
  ownerOf,
  ownershipCatalog,
  ownershipRules,
} from './ownership'

describe('ownership de datos', () => {
  it('el estudio posee el progreso del usuario', () => {
    for (const entity of ['StudyState', 'Attempt', 'ErrorEntry', 'Flashcard', 'SRS', 'XP', 'streak', 'ExamAttempt', 'userSettings']) {
      expect(ownerOf(entity)).toBe('study')
    }
  })

  it('el conocimiento posee el material histórico y los resultados', () => {
    for (const entity of ['HistoricalExam', 'HistoricalQuestion', 'SourceDocument', 'DocumentChunk', 'CurriculumMapping', 'Classification', 'QuestionFeatures', 'TopicFeatures', 'HistoricalExamDistribution', 'PredictionResult', 'PredictionFeature', 'Backtest', 'ModelVersion', 'DatasetVersion']) {
      expect(ownerOf(entity)).toBe('knowledge')
    }
  })

  it('cada dominio escribe solo lo suyo', () => {
    expect(canWrite('Flashcard', 'study')).toBe(true)
    expect(canWrite('Flashcard', 'knowledge')).toBe(false)
    expect(canWrite('PredictionResult', 'knowledge')).toBe(true)
    expect(canWrite('PredictionResult', 'study')).toBe(false)
  })

  it('ningún dominio escribe sobre entidades ajenas', () => {
    expect(knowledgeCanWriteStudyEntities()).toEqual([])
    const decision = checkWrite('SRS', 'knowledge')
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('study')
  })

  it('lanza al intentar escribir donde no se puede', () => {
    expect(() => assertWriteAllowed('Flashcard', 'knowledge')).toThrow()
    expect(() => assertWriteAllowed('Backtest', 'study')).toThrow()
    expect(() => assertWriteAllowed('Backtest', 'knowledge')).not.toThrow()
  })

  it('rechaza entidades desconocidas', () => {
    expect(ownerOf('EntidadInexistente')).toBeNull()
    expect(checkWrite('EntidadInexistente', 'study').allowed).toBe(false)
  })

  it('permite leer a cada dominio lo suyo', () => {
    expect(canRead('StudyState', 'study')).toBe(true)
    expect(canRead('HistoricalQuestion', 'knowledge')).toBe(true)
  })

  it('documenta las reglas y cubre las dos listas', () => {
    expect(ownershipCatalog.length).toBe(24)
    expect(ownershipRules.length).toBeGreaterThan(0)
  })
})

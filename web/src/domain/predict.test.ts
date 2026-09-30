import { describe, expect, it } from 'vitest'
import {
  emptyPredictionResult,
  explainPrediction,
  predictionFeatureCatalog,
  predictionWarnings,
  summarizePredictionAvailability,
  unavailablePredictionEngine,
} from './predict'

const now = new Date('2026-09-29T09:00:00.000Z')

describe('catálogo de variables', () => {
  it('declara las variables previstas para el motor futuro', () => {
    const keys = predictionFeatureCatalog.map((feature) => feature.key)
    expect(keys).toContain('questionFrequency')
    expect(keys).toContain('recency')
    expect(keys).toContain('semanticSimilarity')
    expect(keys).toContain('appearanceIntervals')
  })

  it('no inventa valores ni pesos', () => {
    expect(predictionFeatureCatalog.every((feature) => feature.value === null)).toBe(true)
    expect(predictionFeatureCatalog.every((feature) => feature.weight === null)).toBe(true)
    expect(predictionFeatureCatalog.every((feature) => feature.contribution === null)).toBe(true)
    expect(predictionFeatureCatalog.every((feature) => feature.available === false)).toBe(true)
  })
})

describe('unavailablePredictionEngine', () => {
  it('devuelve estado no implementado', () => {
    const result = unavailablePredictionEngine.predict({ historicalQuestions: [] }, now)
    expect(result.status).toBe('not-implemented')
    expect(unavailablePredictionEngine.status).toBe('not-implemented')
  })

  it('nunca devuelve una puntuación numérica', () => {
    const result = unavailablePredictionEngine.predict({ questionId: 'q-1', historicalQuestions: [] }, now)
    expect(result.score.value).toBeNull()
    expect(result.score.calibrated).toBe(false)
    expect(typeof result.score.value).not.toBe('number')
  })

  it('conserva los identificadores consultados', () => {
    const result = unavailablePredictionEngine.predict({ questionId: 'q-1', topicId: 't-1', subjectId: 'cardiologia', historicalQuestions: [] }, now)
    expect(result.questionId).toBe('q-1')
    expect(result.topicId).toBe('t-1')
    expect(result.subjectId).toBe('cardiologia')
  })

  it('incluye advertencias explícitas', () => {
    const result = unavailablePredictionEngine.predict({ historicalQuestions: [] }, now)
    expect(result.warnings.length).toBeGreaterThan(predictionWarnings.length - 1)
  })

  it('marca todas las variables como pendientes', () => {
    const result = unavailablePredictionEngine.predict({ historicalQuestions: [] }, now)
    const summary = summarizePredictionAvailability(result)
    expect(summary.pending).toBe(summary.total)
    expect(summary.available).toBe(0)
  })
})

describe('explainPrediction', () => {
  it('explica por qué no hay resultado', () => {
    const result = emptyPredictionResult({ historicalQuestions: [] }, now, 'test-engine')
    const lines = explainPrediction(result)
    expect(lines[0]).toContain('not-implemented')
    expect(lines.some((line) => line.includes('pendientes de datos'))).toBe(true)
    expect(lines.some((line) => line.includes('Frecuencia histórica'))).toBe(true)
  })
})

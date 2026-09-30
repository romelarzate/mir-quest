import { describe, expect, it } from 'vitest'
import {
  attachEvidence,
  calibrationStatusLabels,
  canPresentAsProbability,
  createPredictionResult,
  describePrediction,
  fromLocalPredictionShape,
  notCalibratedWarning,
  predictionRules,
  predictionVersionSummary,
  validatePrediction,
} from './prediction'
import { createVersionBundle } from './versioning'

const versions = createVersionBundle({
  datasetVersion: 'dataset-demo-1',
  taxonomyVersion: 'taxonomy-demo-1',
  featureVersion: 'feature-demo-1',
  simulationVersion: 'simulation-demo-1',
})

describe('calibratedProbability', () => {
  it('es null mientras no hay calibración, aunque se aporte un valor', () => {
    const result = createPredictionResult({
      predictionId: 'p-1',
      targetType: 'topic',
      targetId: 'topic-1',
      versions,
      generatedAt: '2026-09-29T09:00:00.000Z',
      score: 0.42,
      calibratedProbability: 0.42,
    })
    expect(result.calibrationStatus).toBe('not_calibrated')
    expect(result.calibratedProbability).toBeNull()
    expect(result.score).toBe(0.42)
  })

  it('nunca se presenta un score como probabilidad', () => {
    const result = createPredictionResult({
      predictionId: 'p-1',
      targetType: 'topic',
      targetId: 'topic-1',
      versions,
      generatedAt: '2026-09-29T09:00:00.000Z',
      score: 0.9,
    })
    expect(canPresentAsProbability(result)).toBe(false)
    expect(describePrediction(result)).toContain('sin probabilidad calibrada')
    expect(result.warnings).toContain(notCalibratedWarning)
  })

  it('solo con modelo y calibración se admite probabilidad', () => {
    const calibratedVersions = createVersionBundle({ ...versions, modelVersion: 'model-demo-1' })
    const result = createPredictionResult({
      predictionId: 'p-2',
      targetType: 'question',
      targetId: 'hq-1',
      versions: calibratedVersions,
      generatedAt: '2026-09-29T09:00:00.000Z',
      calibratedProbability: 0.31,
      calibrationStatus: 'calibrated',
    })
    expect(canPresentAsProbability(result)).toBe(true)
    expect(result.calibratedProbability).toBe(0.31)
    expect(validatePrediction(result).ok).toBe(true)
  })

  it('etiqueta los estados de calibración', () => {
    expect(calibrationStatusLabels.not_calibrated).toBe('Sin calibrar')
  })
})

describe('evidencia', () => {
  it('adjunta evidencia sin duplicar', () => {
    const base = createPredictionResult({ predictionId: 'p-1', targetType: 'topic', targetId: 't1', versions, generatedAt: '2026-09-29T09:00:00.000Z' })
    const evidence = [{ documentId: 'doc-1', chunkId: 'c1', page: 3, section: null, quote: null, sourceId: null }]
    const once = attachEvidence(base, evidence)
    const twice = attachEvidence(once, evidence)
    expect(once.evidence.length).toBe(1)
    expect(twice.evidence.length).toBe(1)
  })

  it('valida la evidencia adjunta', () => {
    const base = createPredictionResult({ predictionId: 'p-1', targetType: 'topic', targetId: 't1', versions, generatedAt: '2026-09-29T09:00:00.000Z' })
    const withBadEvidence = attachEvidence(base, [{ documentId: '', chunkId: 'c1', page: null, section: null, quote: null, sourceId: null }])
    expect(validatePrediction(withBadEvidence).ok).toBe(false)
  })
})

describe('adaptador desde el marcador local', () => {
  it('mapea el objetivo según el nivel disponible', () => {
    const local = {
      questionId: 'hq-1',
      topicId: 'topic-1',
      subjectId: 'cardiologia',
      score: null,
      generatedAt: '2026-09-29T09:00:00.000Z',
      warnings: ['aviso local'],
      features: [{ key: 'frequency', label: 'Frecuencia', value: null, weight: null, contribution: null, available: false, rationale: 'x' }],
    }
    const questionResult = fromLocalPredictionShape(local, versions, 'p-1')
    expect(questionResult.targetType).toBe('question')
    expect(questionResult.targetId).toBe('hq-1')
    expect(questionResult.calibratedProbability).toBeNull()
    expect(questionResult.warnings).toContain('aviso local')

    const topicResult = fromLocalPredictionShape({ ...local, questionId: null }, versions, 'p-2')
    expect(topicResult.targetType).toBe('topic')

    const subjectResult = fromLocalPredictionShape({ ...local, questionId: null, topicId: null }, versions, 'p-3')
    expect(subjectResult.targetType).toBe('subject')
    expect(subjectResult.targetId).toBe('cardiologia')
  })

  it('resuelve un objetivo desconocido sin romper', () => {
    const local = { questionId: null, topicId: null, subjectId: null, score: null, generatedAt: 'x', warnings: [], features: [] }
    const result = fromLocalPredictionShape(local, versions, 'p-4')
    expect(result.targetId).toBe('desconocido')
  })
})

describe('trazabilidad de versiones', () => {
  it('registra las cuatro versiones del resultado', () => {
    const result = createPredictionResult({ predictionId: 'p-1', targetType: 'topic', targetId: 't1', versions, generatedAt: '2026-09-29T09:00:00.000Z' })
    expect(result.datasetVersion).toBe('dataset-demo-1')
    expect(result.taxonomyVersion).toBe('taxonomy-demo-1')
    expect(result.featureVersion).toBe('feature-demo-1')
    expect(result.modelVersion).toBeNull()
    expect(predictionVersionSummary(result)).toContain('dataset=dataset-demo-1')
  })

  it('avisa si falta la versión de modelo', () => {
    const result = createPredictionResult({ predictionId: 'p-1', targetType: 'topic', targetId: 't1', versions, generatedAt: 'x' })
    expect(result.warnings.some((warning) => warning.indexOf('modelo') !== -1)).toBe(true)
  })

  it('documenta las reglas de predicción', () => {
    expect(predictionRules.length).toBe(5)
  })
})

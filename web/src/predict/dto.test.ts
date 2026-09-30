import { describe, expect, it } from 'vitest'
import {
  validateDatasetMetadataDTO,
  validateHistoricalExamDTO,
  validateHistoricalQuestionDTO,
  validateModelMetadataDTO,
  validatePredictionEvidenceDTO,
  validatePredictionFeatureDTO,
  validatePredictionResultDTO,
  validateSimulationRequestDTO,
  validateSimulationResultDTO,
} from './dto'
import type { HistoricalQuestionDTO, PredictionResultDTO, SimulationResultDTO } from './dto'
import { createVersionBundle } from './versioning'

const versions = createVersionBundle({
  datasetVersion: 'dataset-demo-1',
  taxonomyVersion: 'taxonomy-demo-1',
  featureVersion: 'feature-demo-1',
  simulationVersion: 'simulation-demo-1',
})

describe('HistoricalQuestionDTO', () => {
  const base: HistoricalQuestionDTO = {
    questionId: 'hq-1',
    examId: 'exam-2019',
    year: 2019,
    subjectId: 'cardiologia',
    topicId: 'topic-cardio-arritmias',
    subtopicId: null,
    clinicalDomainIds: ['clinical-domain-01'],
    stem: null,
    sourceDocumentId: null,
    page: null,
    classificationConfidence: null,
    validationStatus: 'accepted',
    versions,
  }

  it('acepta un DTO válido', () => {
    expect(validateHistoricalQuestionDTO(base).ok).toBe(true)
  })

  it('exige identificador y examen de origen', () => {
    expect(validateHistoricalQuestionDTO({ ...base, questionId: '' }).ok).toBe(false)
    expect(validateHistoricalQuestionDTO({ ...base, examId: '  ' }).ok).toBe(false)
  })

  it('rechaza estados y páginas inválidas', () => {
    expect(validateHistoricalQuestionDTO({ ...base, validationStatus: 'raro' as never }).ok).toBe(false)
    expect(validateHistoricalQuestionDTO({ ...base, page: 0 }).ok).toBe(false)
    expect(validateHistoricalQuestionDTO({ ...base, year: 12 }).ok).toBe(false)
  })

  it('acota la confianza de clasificación', () => {
    expect(validateHistoricalQuestionDTO({ ...base, classificationConfidence: 1.5 }).ok).toBe(false)
    expect(validateHistoricalQuestionDTO({ ...base, classificationConfidence: 0.9 }).ok).toBe(true)
  })
})

describe('HistoricalExamDTO', () => {
  it('valida etiqueta y número de preguntas', () => {
    expect(validateHistoricalExamDTO({ examId: 'e1', year: 2019, label: 'MIR 2019', questionCount: 0, sourceDocumentIds: [], versions }).ok).toBe(true)
    expect(validateHistoricalExamDTO({ examId: 'e1', year: 2019, label: '', questionCount: 3, sourceDocumentIds: [], versions }).ok).toBe(false)
    expect(validateHistoricalExamDTO({ examId: 'e1', year: 2019, label: 'x', questionCount: -1, sourceDocumentIds: [], versions }).ok).toBe(false)
  })
})

describe('PredictionFeatureDTO', () => {
  it('impide valores en variables no disponibles', () => {
    expect(validatePredictionFeatureDTO({ key: 'frequency', label: 'Frecuencia', value: null, weight: null, contribution: null, available: false, rationale: 'x' }).ok).toBe(true)
    expect(validatePredictionFeatureDTO({ key: 'frequency', label: 'Frecuencia', value: 3, weight: null, contribution: null, available: false, rationale: 'x' }).ok).toBe(false)
  })
})

describe('PredictionResultDTO', () => {
  const result: PredictionResultDTO = {
    predictionId: 'p-1',
    targetType: 'topic',
    targetId: 'topic-cardio-arritmias',
    score: null,
    calibratedProbability: null,
    calibrationStatus: 'not_calibrated',
    features: [],
    evidence: [],
    datasetVersion: 'dataset-demo-1',
    taxonomyVersion: 'taxonomy-demo-1',
    featureVersion: 'feature-demo-1',
    modelVersion: null,
    generatedAt: '2026-09-29T09:00:00.000Z',
    warnings: [],
  }

  it('acepta un resultado sin calibrar', () => {
    expect(validatePredictionResultDTO(result).ok).toBe(true)
  })

  it('exige probabilidad null si no hay calibración', () => {
    expect(validatePredictionResultDTO({ ...result, calibratedProbability: 0.7 }).ok).toBe(false)
  })

  it('acota la probabilidad calibrada a 0 y 1', () => {
    expect(validatePredictionResultDTO({ ...result, calibrationStatus: 'calibrated', modelVersion: 'model-1', calibratedProbability: 1.4 }).ok).toBe(false)
    expect(validatePredictionResultDTO({ ...result, calibrationStatus: 'calibrated', modelVersion: 'model-1', calibratedProbability: 0.4 }).ok).toBe(true)
  })

  it('exige versión de modelo si está calibrada', () => {
    expect(validatePredictionResultDTO({ ...result, calibrationStatus: 'calibrated', calibratedProbability: 0.4 }).ok).toBe(false)
  })

  it('valida features y evidencias anidadas', () => {
    const broken = { ...result, features: [{ key: 'frequency', label: 'F', value: 2, weight: null, contribution: null, available: false, rationale: 'x' }] }
    expect(validatePredictionResultDTO(broken).ok).toBe(false)
  })
})

describe('PredictionEvidenceDTO', () => {
  it('exige documento y fragmento', () => {
    expect(validatePredictionEvidenceDTO({ documentId: 'd1', chunkId: 'c1', page: null, section: null, quote: null, sourceId: null }).ok).toBe(true)
    expect(validatePredictionEvidenceDTO({ documentId: '', chunkId: 'c1', page: null, section: null, quote: null, sourceId: null }).ok).toBe(false)
    expect(validatePredictionEvidenceDTO({ documentId: 'd1', chunkId: '', page: null, section: null, quote: null, sourceId: null }).ok).toBe(false)
  })
})

describe('SimulationDTO', () => {
  const request = {
    requestId: 'sim-1',
    seed: 'semilla-1',
    questionCount: 5,
    subjectIds: [],
    topicIds: [],
    clinicalDomainIds: [],
    versions,
    requestedAt: '2026-09-29T09:00:00.000Z',
  }

  it('exige semilla y cantidad positiva', () => {
    expect(validateSimulationRequestDTO(request).ok).toBe(true)
    expect(validateSimulationRequestDTO({ ...request, seed: '' }).ok).toBe(false)
    expect(validateSimulationRequestDTO({ ...request, questionCount: 0 }).ok).toBe(false)
  })

  it('coherenta manifiesto y resultado', () => {
    const result: SimulationResultDTO = {
      simulationId: 'sim-1',
      questionIds: ['a', 'b'],
      status: 'planned',
      warnings: [],
      manifest: {
        simulationId: 'sim-1',
        seed: 'semilla-1',
        datasetVersion: 'dataset-demo-1',
        taxonomyVersion: 'taxonomy-demo-1',
        featureVersion: 'feature-demo-1',
        modelVersion: null,
        simulationVersion: 'simulation-demo-1',
        generatedAt: '2026-09-29T09:00:00.000Z',
        questionIds: ['a', 'b'],
        hash: 'abc',
        hashAlgorithm: 'sha-256',
        secondaryHash: null,
      },
    }
    expect(validateSimulationResultDTO(result).ok).toBe(true)
    expect(validateSimulationResultDTO({ ...result, questionIds: ['a'] }).ok).toBe(false)
    expect(validateSimulationResultDTO({ ...result, manifest: { ...result.manifest, simulationId: 'otro' } }).ok).toBe(false)
    expect(validateSimulationResultDTO({ ...result, manifest: { ...result.manifest, hashAlgorithm: 'md5' } }).ok).toBe(false)
  })
})

describe('metadatos', () => {
  it('valida dataset y modelo', () => {
    expect(validateDatasetMetadataDTO({ datasetVersion: 'd1', label: 'demo', createdAt: 'x', examCount: 0, questionCount: 10, acceptedQuestionCount: 8, quarantinedQuestionCount: 2, sourceDocumentCount: 0, hash: 'h', isDemo: true }).ok).toBe(true)
    expect(validateDatasetMetadataDTO({ datasetVersion: 'd1', label: 'demo', createdAt: 'x', examCount: 0, questionCount: 5, acceptedQuestionCount: 8, quarantinedQuestionCount: 2, sourceDocumentCount: 0, hash: 'h', isDemo: true }).ok).toBe(false)
    expect(validateModelMetadataDTO({ modelVersion: 'm1', label: 'demo', kind: 'none', calibrated: true, createdAt: 'x', notes: '' }).ok).toBe(false)
    expect(validateModelMetadataDTO({ modelVersion: 'm1', label: 'demo', kind: 'statistical', calibrated: false, createdAt: 'x', notes: '' }).ok).toBe(true)
  })
})

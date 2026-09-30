/**
 * DTO de integración entre MIR Quest (estudio) y Predict (conocimiento).
 *
 * Reglas:
 * - Independientes de SQLite y de cualquier motor de base de datos.
 * - Serializables a JSON.
 * - Se exponen a React, nunca los modelos internos del motor.
 */

import type { VersionBundle } from './versioning'

export type DtoIssue = { field: string; message: string }

export type DtoValidation = { ok: boolean; issues: DtoIssue[] }

function ok(): DtoValidation {
  return { ok: true, issues: [] }
}

function fail(field: string, message: string): DtoValidation {
  return { ok: false, issues: [{ field, message }] }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export type HistoricalQuestionDTO = {
  questionId: string
  examId: string
  year: number | null
  subjectId: string | null
  topicId: string | null
  subtopicId: string | null
  clinicalDomainIds: string[]
  stem: string | null
  sourceDocumentId: string | null
  page: number | null
  classificationConfidence: number | null
  validationStatus: 'accepted' | 'quarantined' | 'rejected'
  versions: VersionBundle
}

export function validateHistoricalQuestionDTO(dto: HistoricalQuestionDTO): DtoValidation {
  if (!isNonEmptyString(dto.questionId)) return fail('questionId', 'Identificador obligatorio.')
  if (!isNonEmptyString(dto.examId)) return fail('examId', 'Examen de origen obligatorio.')
  if (!['accepted', 'quarantined', 'rejected'].includes(dto.validationStatus)) {
    return fail('validationStatus', 'Estado de validación desconocido.')
  }
  if (dto.year !== null && (dto.year < 1900 || dto.year > 3000)) return fail('year', 'Año fuera de rango razonable.')
  if (dto.page !== null && dto.page <= 0) return fail('page', 'La página debe ser positiva o null.')
  if (dto.classificationConfidence !== null && (dto.classificationConfidence < 0 || dto.classificationConfidence > 1)) {
    return fail('classificationConfidence', 'La confianza debe estar entre 0 y 1.')
  }
  return ok()
}

export type HistoricalExamDTO = {
  examId: string
  year: number | null
  label: string
  questionCount: number
  sourceDocumentIds: string[]
  versions: VersionBundle
}

export function validateHistoricalExamDTO(dto: HistoricalExamDTO): DtoValidation {
  if (!isNonEmptyString(dto.examId)) return fail('examId', 'Identificador obligatorio.')
  if (!isNonEmptyString(dto.label)) return fail('label', 'Etiqueta obligatoria.')
  if (dto.questionCount < 0) return fail('questionCount', 'El número de preguntas no puede ser negativo.')
  return ok()
}

export type PredictionFeatureDTO = {
  key: string
  label: string
  value: number | null
  weight: number | null
  contribution: number | null
  available: boolean
  rationale: string
}

export function validatePredictionFeatureDTO(dto: PredictionFeatureDTO): DtoValidation {
  if (!isNonEmptyString(dto.key)) return fail('key', 'Clave obligatoria.')
  if (!dto.available && (dto.value !== null || dto.weight !== null || dto.contribution !== null)) {
    return fail('available', 'Una variable no disponible no puede traer valores.')
  }
  return ok()
}

export type PredictionEvidenceDTO = {
  documentId: string
  chunkId: string
  page: number | null
  section: string | null
  quote: string | null
  sourceId: string | null
}

export function validatePredictionEvidenceDTO(dto: PredictionEvidenceDTO): DtoValidation {
  if (!isNonEmptyString(dto.documentId)) return fail('documentId', 'Documento obligatorio en la evidencia.')
  if (!isNonEmptyString(dto.chunkId)) return fail('chunkId', 'Fragmento obligatorio en la evidencia.')
  if (dto.page !== null && dto.page <= 0) return fail('page', 'La página debe ser positiva o null.')
  return ok()
}

export type CalibrationStatus = 'not_calibrated' | 'calibrated'

export type PredictionTargetType = 'question' | 'topic' | 'subject' | 'clinical-domain'

export type PredictionResultDTO = {
  predictionId: string
  targetType: PredictionTargetType
  targetId: string
  score: number | null
  calibratedProbability: number | null
  calibrationStatus: CalibrationStatus
  features: PredictionFeatureDTO[]
  evidence: PredictionEvidenceDTO[]
  datasetVersion: string | null
  taxonomyVersion: string
  featureVersion: string
  modelVersion: string | null
  generatedAt: string
  warnings: string[]
}

export function validatePredictionResultDTO(dto: PredictionResultDTO): DtoValidation {
  if (!isNonEmptyString(dto.predictionId)) return fail('predictionId', 'Identificador obligatorio.')
  if (!isNonEmptyString(dto.targetId)) return fail('targetId', 'Objetivo obligatorio.')
  if (dto.calibrationStatus !== 'calibrated' && dto.calibratedProbability !== null) {
    return fail('calibratedProbability', 'Sin calibración la probabilidad debe ser null.')
  }
  if (dto.calibratedProbability !== null && (dto.calibratedProbability < 0 || dto.calibratedProbability > 1)) {
    return fail('calibratedProbability', 'La probabilidad calibrada debe estar entre 0 y 1.')
  }
  if (dto.calibrationStatus === 'calibrated' && dto.modelVersion === null) {
    return fail('modelVersion', 'Una predicción calibrada exige versión de modelo.')
  }
  for (const feature of dto.features) {
    const featureValidation = validatePredictionFeatureDTO(feature)
    if (!featureValidation.ok) return featureValidation
  }
  for (const evidence of dto.evidence) {
    const evidenceValidation = validatePredictionEvidenceDTO(evidence)
    if (!evidenceValidation.ok) return evidenceValidation
  }
  return ok()
}

export type SimulationRequestDTO = {
  requestId: string
  seed: string
  questionCount: number
  subjectIds: string[]
  topicIds: string[]
  clinicalDomainIds: string[]
  versions: VersionBundle
  requestedAt: string
}

export function validateSimulationRequestDTO(dto: SimulationRequestDTO): DtoValidation {
  if (!isNonEmptyString(dto.requestId)) return fail('requestId', 'Identificador obligatorio.')
  if (!isNonEmptyString(dto.seed)) return fail('seed', 'La semilla es obligatoria para poder reproducir.')
  if (dto.questionCount <= 0) return fail('questionCount', 'Debe pedirse al menos una pregunta.')
  return ok()
}

export type SimulationManifestDTO = {
  simulationId: string
  seed: string
  datasetVersion: string
  taxonomyVersion: string
  featureVersion: string
  modelVersion: string | null
  simulationVersion: string
  generatedAt: string
  questionIds: string[]
  hash: string
  hashAlgorithm: string
  secondaryHash: string | null
}

export type SimulationResultDTO = {
  simulationId: string
  manifest: SimulationManifestDTO
  questionIds: string[]
  status: 'not-implemented' | 'planned'
  warnings: string[]
}

export function validateSimulationResultDTO(dto: SimulationResultDTO): DtoValidation {
  if (!isNonEmptyString(dto.simulationId)) return fail('simulationId', 'Identificador obligatorio.')
  if (dto.manifest.simulationId !== dto.simulationId) return fail('manifest.simulationId', 'El manifiesto no coincide con la simulación.')
  if (dto.manifest.questionIds.length !== dto.questionIds.length) {
    return fail('questionIds', 'El manifiesto y el resultado no describen el mismo conjunto.')
  }
  if (dto.manifest.hashAlgorithm !== 'sha-256') return fail('hashAlgorithm', 'El hash principal debe ser sha-256.')
  return ok()
}

export type DatasetMetadataDTO = {
  datasetVersion: string
  label: string
  createdAt: string
  examCount: number
  questionCount: number
  acceptedQuestionCount: number
  quarantinedQuestionCount: number
  sourceDocumentCount: number
  hash: string
  isDemo: boolean
}

export function validateDatasetMetadataDTO(dto: DatasetMetadataDTO): DtoValidation {
  if (!isNonEmptyString(dto.datasetVersion)) return fail('datasetVersion', 'Versión obligatoria.')
  if (dto.acceptedQuestionCount + dto.quarantinedQuestionCount > dto.questionCount) {
    return fail('questionCount', 'Las cuentas por estado superan el total.')
  }
  return ok()
}

export type ModelMetadataDTO = {
  modelVersion: string
  label: string
  kind: 'statistical' | 'ml' | 'hybrid' | 'none'
  calibrated: boolean
  createdAt: string
  notes: string
}

export function validateModelMetadataDTO(dto: ModelMetadataDTO): DtoValidation {
  if (!isNonEmptyString(dto.modelVersion)) return fail('modelVersion', 'Versión obligatoria.')
  if (dto.kind === 'none' && dto.calibrated) return fail('calibrated', 'Un modelo inexistente no puede estar calibrado.')
  return ok()
}

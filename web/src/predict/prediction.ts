import type { PredictionEvidenceDTO, PredictionFeatureDTO, PredictionResultDTO, PredictionTargetType } from './dto'
import { validatePredictionResultDTO } from './dto'
import type { VersionBundle } from './versioning'
import { describeVersionBundle } from './versioning'

export const calibrationStatusLabels: Record<PredictionResultDTO['calibrationStatus'], string> = {
  not_calibrated: 'Sin calibrar',
  calibrated: 'Calibrada',
}

export const notCalibratedWarning =
  'Resultado sin calibración: no se puede presentar como probabilidad.'

export type CreatePredictionInput = {
  predictionId: string
  targetType: PredictionTargetType
  targetId: string
  versions: VersionBundle
  generatedAt: string
  features?: PredictionFeatureDTO[]
  evidence?: PredictionEvidenceDTO[]
  score?: number | null
  calibratedProbability?: number | null
  calibrationStatus?: PredictionResultDTO['calibrationStatus']
}

/**
 * Construye un resultado de predicción con la invariante clave:
 * sin calibración, la probabilidad calibrada es null.
 */
export function createPredictionResult(input: CreatePredictionInput): PredictionResultDTO {
  const calibrationStatus = input.calibrationStatus ?? 'not_calibrated'
  const warnings: string[] = []
  if (calibrationStatus !== 'calibrated') warnings.push(notCalibratedWarning)
  if (input.versions.modelVersion === null) warnings.push('Sin versión de modelo registrada.')

  return {
    predictionId: input.predictionId,
    targetType: input.targetType,
    targetId: input.targetId,
    score: input.score ?? null,
    calibratedProbability: calibrationStatus === 'calibrated' ? input.calibratedProbability ?? null : null,
    calibrationStatus,
    features: input.features ?? [],
    evidence: input.evidence ?? [],
    datasetVersion: input.versions.datasetVersion,
    taxonomyVersion: input.versions.taxonomyVersion,
    featureVersion: input.versions.featureVersion,
    modelVersion: input.versions.modelVersion,
    generatedAt: input.generatedAt,
    warnings,
  }
}

/** Un score nunca se presenta como probabilidad mientras no haya calibración. */
export function canPresentAsProbability(result: PredictionResultDTO): boolean {
  return result.calibrationStatus === 'calibrated' && result.calibratedProbability !== null
}

export function describePrediction(result: PredictionResultDTO): string {
  const parts = [
    'Objetivo ' + result.targetType + ':' + result.targetId,
    'estado ' + result.calibrationStatus,
  ]
  if (canPresentAsProbability(result)) {
    parts.push('probabilidad calibrada ' + String(result.calibratedProbability))
  } else {
    parts.push('sin probabilidad calibrada')
  }
  parts.push('variables disponibles ' + String(result.features.filter((feature) => feature.available).length) + '/' + String(result.features.length))
  return parts.join(' · ')
}

export function attachEvidence(result: PredictionResultDTO, evidence: PredictionEvidenceDTO[]): PredictionResultDTO {
  const seen = new Set(result.evidence.map((item) => item.documentId + '|' + item.chunkId))
  const merged = result.evidence.slice()
  for (const item of evidence) {
    const key = item.documentId + '|' + item.chunkId
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return { ...result, evidence: merged }
}

/**
 * Adapta el marcador local de MIR Quest al DTO de integración.
 * Se acepta una forma estructural para no acoplar capas.
 */
export function fromLocalPredictionShape(
  local: {
    questionId: string | null
    topicId: string | null
    subjectId: string | null
    score: number | null
    generatedAt: string
    warnings: string[]
    features: Array<{ key: string; label: string; value: number | null; weight: number | null; contribution: number | null; available: boolean; rationale: string }>
  },
  versions: VersionBundle,
  predictionId: string,
): PredictionResultDTO {
  const targetType: PredictionTargetType = local.questionId !== null ? 'question' : local.topicId !== null ? 'topic' : 'subject'
  const targetId = local.questionId ?? local.topicId ?? local.subjectId ?? 'desconocido'
  const result = createPredictionResult({
    predictionId,
    targetType,
    targetId,
    versions,
    generatedAt: local.generatedAt,
    features: local.features.map((feature) => ({ ...feature })),
    score: local.score,
  })
  return { ...result, warnings: Array.from(new Set([...result.warnings, ...local.warnings])) }
}

export function validatePrediction(result: PredictionResultDTO): { ok: boolean; issues: string[] } {
  const validation = validatePredictionResultDTO(result)
  return { ok: validation.ok, issues: validation.issues.map((issue) => issue.field + ': ' + issue.message) }
}

export function predictionVersionSummary(result: PredictionResultDTO): string {
  return describeVersionBundle({
    datasetVersion: result.datasetVersion ?? 'dataset-unspecified',
    taxonomyVersion: result.taxonomyVersion,
    featureVersion: result.featureVersion,
    modelVersion: result.modelVersion,
    simulationVersion: 'no-aplica',
  })
}

export const predictionRules: string[] = [
  'calibratedProbability puede ser null y lo es mientras no haya calibración validada.',
  'Mientras no exista calibración, calibrationStatus es not_calibrated.',
  'Nunca se muestra un score como probabilidad.',
  'Toda predicción registra versiones de dataset, taxonomía, features y modelo.',
  'Toda predicción presenta la evidencia documental que la respalda.',
]

import type { DtoValidation } from './dto'

export type ValidationStatus = 'accepted' | 'quarantined' | 'rejected'

export const validationStatusLabels: Record<ValidationStatus, string> = {
  accepted: 'Aceptada',
  quarantined: 'En cuarentena',
  rejected: 'Rechazada',
}

export type ExtractionErrorCode =
  | 'low-confidence'
  | 'missing-stem'
  | 'missing-options'
  | 'missing-answer'
  | 'unreadable-page'
  | 'ambiguous-classification'
  | 'empty-text'
  | 'unknown'

export type ExtractionValidationError = {
  code: ExtractionErrorCode
  message: string
  field: string | null
}

export type ExtractionResult = {
  questionId: string
  confidence: number | null
  validationStatus: ValidationStatus
  validationErrors: ExtractionValidationError[]
  sourceDocumentId: string | null
  page: number | null
  rawText: string
  extractedAt: string
  isDemo: boolean
}

export type QuarantineReviewStatus = 'pending' | 'approved' | 'rejected'

export type QuarantineQuestion = {
  quarantineId: string
  questionId: string
  rawText: string
  sourceDocumentId: string | null
  page: number | null
  reason: string
  extraction: ExtractionResult
  createdAt: string
  reviewStatus: QuarantineReviewStatus
  reviewedBy: string | null
  reviewedAt: string | null
  isDemo: boolean
}

export const confidenceThreshold = 0.8

export type ExtractionInput = {
  questionId: string
  rawText: string
  now: Date
  confidence?: number | null
  sourceDocumentId?: string | null
  page?: number | null
  hasStem?: boolean
  hasOptions?: boolean
  hasAnswer?: boolean
  classificationAmbiguous?: boolean
  isDemo?: boolean
}

/**
 * Determina si una extracción se acepta, se pone en cuarentena o se rechaza.
 * Nunca decide con datos médicos: solo con la calidad de la extracción.
 */
export function createExtractionResult(input: ExtractionInput): ExtractionResult {
  const errors: ExtractionValidationError[] = []

  if (input.hasStem === false) errors.push({ code: 'missing-stem', message: 'Falta el enunciado.', field: 'stem' })
  if (input.hasOptions === false) errors.push({ code: 'missing-options', message: 'Faltan las opciones.', field: 'options' })
  if (input.hasAnswer === false) errors.push({ code: 'missing-answer', message: 'Falta la respuesta correcta.', field: 'answer' })
  if (input.confidence !== null && input.confidence !== undefined && input.confidence < confidenceThreshold) {
    errors.push({ code: 'low-confidence', message: 'Confianza por debajo del umbral.', field: 'confidence' })
  }
  if (input.page !== null && input.page !== undefined && input.page <= 0) {
    errors.push({ code: 'unreadable-page', message: 'Página no legible.', field: 'page' })
  }
  if (input.classificationAmbiguous === true) {
    errors.push({ code: 'ambiguous-classification', message: 'Clasificación ambigua.', field: 'clinicalDomainIds' })
  }
  if (input.rawText.trim().length === 0) {
    errors.push({ code: 'empty-text', message: 'Texto extraído vacío: no hay material que revisar.', field: 'rawText' })
  }

  const blocking: ExtractionErrorCode[] = ['missing-stem', 'missing-options', 'missing-answer', 'empty-text']
  const hasBlocking = errors.some((error) => blocking.includes(error.code))
  const validationStatus: ValidationStatus = hasBlocking ? 'rejected' : errors.length > 0 ? 'quarantined' : 'accepted'

  return {
    questionId: input.questionId,
    confidence: input.confidence ?? null,
    validationStatus,
    validationErrors: errors,
    sourceDocumentId: input.sourceDocumentId ?? null,
    page: input.page ?? null,
    rawText: input.rawText,
    extractedAt: input.now.toISOString(),
    isDemo: input.isDemo ?? false,
  }
}

export function createQuarantineEntry(
  result: ExtractionResult,
  now: Date,
  quarantineId: string,
): QuarantineQuestion | null {
  if (result.validationStatus === 'accepted') return null
  return {
    quarantineId,
    questionId: result.questionId,
    rawText: result.rawText,
    sourceDocumentId: result.sourceDocumentId,
    page: result.page,
    reason:
      result.validationErrors.length > 0
        ? result.validationErrors.map((error) => error.code).join(', ')
        : 'motivo desconocido',
    extraction: result,
    createdAt: now.toISOString(),
    reviewStatus: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    isDemo: result.isDemo,
  }
}

export function reviewQuarantineEntry(
  entry: QuarantineQuestion,
  decision: 'approved' | 'rejected',
  reviewer: string,
  now: Date,
): QuarantineQuestion {
  return {
    ...entry,
    reviewStatus: decision,
    reviewedBy: reviewer,
    reviewedAt: now.toISOString(),
  }
}

/**
 * Aislamiento: solo las extracciones aceptadas pueden alimentar estadísticas,
 * features, predicciones y simulacros.
 */
export function isUsableInAggregates(status: ValidationStatus): boolean {
  return status === 'accepted'
}

export function usableQuestionIds(results: ExtractionResult[]): string[] {
  return results.filter((result) => isUsableInAggregates(result.validationStatus)).map((result) => result.questionId)
}

export function violatesQuarantineIsolation(
  results: ExtractionResult[],
  usedQuestionIds: string[],
): string[] {
  const blocked = new Set(
    results
      .filter((result) => result.validationStatus !== 'accepted')
      .map((result) => result.questionId),
  )
  return usedQuestionIds.filter((id) => blocked.has(id))
}

export function summarizeExtraction(results: ExtractionResult[]): Record<ValidationStatus, number> {
  const summary: Record<ValidationStatus, number> = { accepted: 0, quarantined: 0, rejected: 0 }
  for (const result of results) summary[result.validationStatus] += 1
  return summary
}

export function validateExtractionResult(result: ExtractionResult): DtoValidation {
  const issues: string[] = []
  if (result.questionId.trim().length === 0) issues.push('questionId vacío')
  if (result.validationStatus === 'accepted' && result.validationErrors.length > 0) {
    issues.push('Una extracción aceptada no puede tener errores')
  }
  if (result.confidence !== null && (result.confidence < 0 || result.confidence > 1)) issues.push('confidence fuera de rango')
  return { ok: issues.length === 0, issues: issues.map((message) => ({ field: 'extraction', message })) }
}

export const quarantineRules: string[] = [
  'Una pregunta en cuarentena conserva el material original para revisión.',
  'Ninguna pregunta en cuarentena entra en estadísticas, features, predicciones ni simulacros.',
  'Solo la aprobación explícita de una persona la habilita.',
  'Una extracción con enunciado, opciones, respuesta o texto ausentes se rechaza: no hay material que revisar.',
]

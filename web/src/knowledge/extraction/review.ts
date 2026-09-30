import type { ExtractionRun, ExtractionStatus } from './types'

export type ReviewDecision = 'approve' | 'quarantine' | 'reject'

export type ReviewItem = {
  index: number
  questionNumber: number | null
  page: number
  text: string
  options: Array<{ label: string; text: string }>
  detectedAnswer: string | null
  confidence: number | null
  errors: string[]
  extractionStatus: ExtractionStatus
  decision: ReviewDecision | null
  reviewedBy: string | null
  reviewedAt: string | null
  notes: string | null
}

export const reviewRules: string[] = [
  'La revision es humana: nada se aprueba automaticamente.',
  'Cada decision registra quien la tomo y cuando.',
  'Una pregunta sin revisar mantiene el estado que le dio el extractor.',
  'Aprobar no borra los errores detectados: quedan como traza.',
]

export function createReviewQueue(run: ExtractionRun): ReviewItem[] {
  return run.questions.map((question, index) => ({
    index,
    questionNumber: question.questionNumber,
    page: question.page,
    text: question.rawText,
    options: question.options.map((option) => ({ label: option.label, text: option.text })),
    detectedAnswer: question.detectedAnswer,
    confidence: question.confidence,
    errors: question.validationErrors.map((error) => error.code + ': ' + error.message),
    extractionStatus: question.validationStatus,
    decision: null,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  }))
}

export function statusForDecision(decision: ReviewDecision): ExtractionStatus {
  if (decision === 'approve') return 'accepted'
  if (decision === 'quarantine') return 'quarantined'
  return 'rejected'
}

export function applyDecision(
  items: ReviewItem[],
  index: number,
  decision: ReviewDecision,
  reviewer: string,
  now: Date,
  notes: string | null = null,
): ReviewItem[] {
  return items.map((item) =>
    item.index === index
      ? { ...item, decision, reviewedBy: reviewer, reviewedAt: now.toISOString(), notes }
      : item,
  )
}

export function decideAll(
  items: ReviewItem[],
  decision: ReviewDecision,
  reviewer: string,
  now: Date,
): ReviewItem[] {
  return items.map((item) => ({
    ...item,
    decision,
    reviewedBy: reviewer,
    reviewedAt: now.toISOString(),
  }))
}

export function isReviewed(item: ReviewItem): boolean {
  return item.decision !== null && item.reviewedBy !== null && item.reviewedAt !== null
}

export function reviewSummary(items: ReviewItem[]): {
  total: number
  pending: number
  approved: number
  quarantined: number
  rejected: number
} {
  return {
    total: items.length,
    pending: items.filter((item) => !isReviewed(item)).length,
    approved: items.filter((item) => item.decision === 'approve').length,
    quarantined: items.filter((item) => item.decision === 'quarantine').length,
    rejected: items.filter((item) => item.decision === 'reject').length,
  }
}

export function applyDecisionsToRun(run: ExtractionRun, items: ReviewItem[]): ExtractionRun {
  return {
    ...run,
    questions: run.questions.map((question, index) => {
      const item = items.find((candidate) => candidate.index === index)
      if (!item || item.decision === null) return question
      return { ...question, validationStatus: statusForDecision(item.decision) }
    }),
  }
}

export function serializeReviewQueue(items: ReviewItem[]): string {
  return JSON.stringify({ summary: reviewSummary(items), items }, null, 2)
}

export function describeReviewItem(item: ReviewItem): string {
  return [
    '#' + String(item.questionNumber === null ? 'sin-numero' : item.questionNumber),
    'pag. ' + String(item.page),
    item.extractionStatus,
    item.confidence === null ? 'confianza no determinable' : 'confianza ' + String(item.confidence),
    String(item.options.length) + ' opciones',
    item.detectedAnswer === null ? 'sin respuesta' : 'respuesta ' + item.detectedAnswer,
    item.errors.length > 0 ? String(item.errors.length) + ' errores' : 'sin errores',
  ].join(' · ')
}

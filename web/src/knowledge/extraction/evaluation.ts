import type { ExtractionRun } from './types'

export type EvaluationField = 'questionNumber' | 'stem' | 'options' | 'answer' | 'page' | 'status'

export const evaluationFields: EvaluationField[] = [
  'questionNumber',
  'stem',
  'options',
  'answer',
  'page',
  'status',
]

export type ExtractionEvaluation = {
  questionId: string
  field: EvaluationField
  expected: string | null
  actual: string | null
  match: boolean | null
  reviewer: string | null
}

export const evaluationRules: string[] = [
  'El ground truth lo rellena una persona; no se genera automaticamente.',
  'match es null mientras expected sea null.',
  'No se llama precision del extractor: es acuerdo con la referencia humana.',
  'Sin filas evaluadas no se calcula ningun porcentaje.',
]

export function evaluationQuestionId(run: ExtractionRun, index: number): string {
  const question = run.questions[index]
  if (!question) return 'q-' + String(index)
  const number = question.questionNumber === null ? 'sin-numero' : String(question.questionNumber)
  return [run.document.id, String(question.page), number].join(':')
}

function actualValue(run: ExtractionRun, index: number, field: EvaluationField): string | null {
  const question = run.questions[index]
  if (!question) return null
  if (field === 'questionNumber') return question.questionNumber === null ? null : String(question.questionNumber)
  if (field === 'stem') return question.rawText
  if (field === 'options') return question.options.map((option) => option.label + ':' + option.text).join(' | ')
  if (field === 'answer') return question.detectedAnswer
  if (field === 'page') return String(question.page)
  return question.validationStatus
}

export function createEvaluationTemplate(run: ExtractionRun): ExtractionEvaluation[] {
  const rows: ExtractionEvaluation[] = []
  run.questions.forEach((_question, index) => {
    for (const field of evaluationFields) {
      rows.push({
        questionId: evaluationQuestionId(run, index),
        field,
        expected: null,
        actual: actualValue(run, index, field),
        match: null,
        reviewer: null,
      })
    }
  })
  return rows
}

export function setExpectation(
  rows: ExtractionEvaluation[],
  questionId: string,
  field: EvaluationField,
  expected: string,
  reviewer: string,
): ExtractionEvaluation[] {
  return rows.map((row) =>
    row.questionId === questionId && row.field === field
      ? { ...row, expected, match: row.actual === expected, reviewer }
      : row,
  )
}

export type FieldAgreement = {
  field: EvaluationField
  evaluated: number
  matches: number
  pending: number
  agreement: number | null
}

export function computeFieldAgreement(rows: ExtractionEvaluation[]): FieldAgreement[] {
  return evaluationFields.map((field) => {
    const fieldRows = rows.filter((row) => row.field === field)
    const decided = fieldRows.filter((row) => row.expected !== null)
    const matches = decided.filter((row) => row.match === true).length
    return {
      field,
      evaluated: decided.length,
      matches,
      pending: fieldRows.length - decided.length,
      agreement: decided.length === 0 ? null : Math.round((matches / decided.length) * 1000) / 1000,
    }
  })
}

export function evaluationSummary(rows: ExtractionEvaluation[]): {
  rows: number
  decided: number
  pending: number
  matches: number
} {
  return {
    rows: rows.length,
    decided: rows.filter((row) => row.expected !== null).length,
    pending: rows.filter((row) => row.expected === null).length,
    matches: rows.filter((row) => row.match === true).length,
  }
}

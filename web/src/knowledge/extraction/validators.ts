import type {
  ExtractedOption,
  ExtractionConsequence,
  ExtractionErrorCode,
  ExtractionSeverity,
  ExtractionStatus,
  ExtractionValidationError,
} from './types'

export const validationThresholds = {
  minChars: 40,
  maxChars: 4000,
  anomalousRatioWarn: 0.05,
  anomalousRatioFatal: 0.3,
  maxSequenceGap: 0,
}

export const validatorCatalog: Array<{
  code: ExtractionErrorCode
  description: string
  consequence: ExtractionConsequence
}> = [
  { code: 'empty-question', description: 'pregunta vacía', consequence: 'fatal' },
  { code: 'truncated-question', description: 'pregunta truncada', consequence: 'quarantine' },
  { code: 'missing-options', description: 'opciones faltantes', consequence: 'quarantine' },
  { code: 'duplicate-options', description: 'opciones duplicadas', consequence: 'quarantine' },
  { code: 'invalid-question-number', description: 'número de pregunta inválido', consequence: 'quarantine' },
  { code: 'sequence-mismatch', description: 'secuencia incorrecta', consequence: 'quarantine' },
  { code: 'missing-answer', description: 'respuesta inexistente', consequence: 'quarantine' },
  { code: 'answer-out-of-range', description: 'respuesta fuera de A-E', consequence: 'quarantine' },
  { code: 'text-too-short', description: 'texto sospechosamente corto', consequence: 'quarantine' },
  { code: 'text-too-long', description: 'texto sospechosamente largo', consequence: 'quarantine' },
  { code: 'page-without-questions', description: 'página sin preguntas detectadas', consequence: 'quarantine' },
  { code: 'multiple-questions-mixed', description: 'múltiples preguntas mezcladas', consequence: 'quarantine' },
  { code: 'possible-column-loss', description: 'posible pérdida de columnas', consequence: 'quarantine' },
  { code: 'anomalous-characters', description: 'caracteres anómalos', consequence: 'quarantine' },
  { code: 'table-layout-unsupported', description: 'maquetación en tabla no soportada', consequence: 'quarantine' },
  { code: 'image-dependent-question', description: 'pregunta que depende de una imagen', consequence: 'quarantine' },
]

export const validatorRules: string[] = [
  'Una pregunta con problemas nunca entra como aceptada.',
  'Solo se rechaza cuando no existe material utilizable: texto vacío o ilegible.',
  'Si hay rawText pero no es confiable, se conserva en cuarentena.',
  'Todos los errores se registran, aunque el resultado acabe aceptado.',
]

function build(
  code: ExtractionErrorCode,
  severity: ExtractionSeverity,
  consequence: ExtractionConsequence,
  message: string,
  questionNumber: number | null,
  page: number | null,
): ExtractionValidationError {
  return { code, severity, consequence, message, questionNumber, page }
}

export function isUsableMaterial(rawText: string, anomalousCharacterRatio: number | null): boolean {
  if (rawText.trim().length === 0) return false
  if (anomalousCharacterRatio !== null && anomalousCharacterRatio >= validationThresholds.anomalousRatioFatal) return false
  return true
}

export type QuestionValidationInput = {
  page: number
  rawText: string
  questionNumber: number | null
  options: ExtractedOption[]
  detectedAnswer: string | null
  previousNumber: number | null
  mixedMarkers: boolean
  splitAcrossPages: boolean
  endsCleanly: boolean
  interleavedOptions: boolean
  hasTableMarkers: boolean
  imageDependent: boolean
  anomalousCharacterRatio: number | null
}

function duplicatedOptionTexts(options: ExtractedOption[]): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const option of options) {
    const key = option.text.trim().toLowerCase()
    if (seen.has(key)) duplicates.push(option.label)
    seen.add(key)
  }
  return duplicates
}

export function validateQuestion(input: QuestionValidationInput): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = []
  const number = input.questionNumber
  const page = input.page
  const trimmed = input.rawText.trim()

  if (trimmed.length === 0) {
    errors.push(build('empty-question', 'error', 'fatal', 'La pregunta no contiene texto.', number, page))
    return errors
  }

  if (number === null || number <= 0) {
    errors.push(build('invalid-question-number', 'error', 'quarantine', 'Sin número de pregunta válido.', number, page))
  } else if (input.previousNumber !== null && number !== input.previousNumber + 1) {
    errors.push(
      build(
        'sequence-mismatch',
        'warning',
        'quarantine',
        'Se esperaba la pregunta ' + String(input.previousNumber + 1) + ' y llegó la ' + String(number) + '.',
        number,
        page,
      ),
    )
  }

  if (!input.endsCleanly && !input.splitAcrossPages) {
    errors.push(build('truncated-question', 'error', 'quarantine', 'El bloque termina sin cierre reconocible.', number, page))
  }

  if (input.options.length < 2) {
    errors.push(build('missing-options', 'error', 'quarantine', 'Menos de dos opciones detectadas.', number, page))
  }

  const duplicates = duplicatedOptionTexts(input.options)
  if (duplicates.length > 0) {
    errors.push(
      build('duplicate-options', 'warning', 'quarantine', 'Opciones repetidas: ' + duplicates.join(', '), number, page),
    )
  }

  if (input.detectedAnswer === null) {
    errors.push(build('missing-answer', 'error', 'quarantine', 'No se detectó respuesta correcta.', number, page))
  } else if (!['A', 'B', 'C', 'D', 'E'].includes(input.detectedAnswer.toUpperCase())) {
    errors.push(
      build('answer-out-of-range', 'error', 'quarantine', 'Respuesta fuera de A-E: ' + input.detectedAnswer, number, page),
    )
  }

  if (trimmed.length < validationThresholds.minChars) {
    errors.push(build('text-too-short', 'warning', 'quarantine', 'Texto por debajo de ' + String(validationThresholds.minChars) + ' caracteres.', number, page))
  }
  if (trimmed.length > validationThresholds.maxChars) {
    errors.push(build('text-too-long', 'warning', 'quarantine', 'Texto por encima de ' + String(validationThresholds.maxChars) + ' caracteres.', number, page))
  }

  if (input.mixedMarkers) {
    errors.push(build('multiple-questions-mixed', 'error', 'quarantine', 'El bloque contiene más de un marcador de pregunta.', number, page))
  }
  if (input.interleavedOptions) {
    errors.push(build('possible-column-loss', 'error', 'quarantine', 'Etiquetas de opción intercaladas: posible mezcla de columnas.', number, page))
  }
  if (input.hasTableMarkers) {
    errors.push(build('table-layout-unsupported', 'warning', 'quarantine', 'Se detectaron marcadores de tabla.', number, page))
  }
  if (input.imageDependent) {
    errors.push(build('image-dependent-question', 'warning', 'quarantine', 'La pregunta parece depender de una imagen.', number, page))
  }
  if (input.anomalousCharacterRatio !== null) {
    if (input.anomalousCharacterRatio >= validationThresholds.anomalousRatioFatal) {
      errors.push(
        build(
          'anomalous-characters',
          'error',
          'fatal',
          'Proporción de caracteres anómalos ' + String(input.anomalousCharacterRatio) + ': material no utilizable.',
          number,
          page,
        ),
      )
    } else if (input.anomalousCharacterRatio >= validationThresholds.anomalousRatioWarn) {
      errors.push(
        build(
          'anomalous-characters',
          'warning',
          'quarantine',
          'Caracteres anómalos presentes: ' + String(input.anomalousCharacterRatio),
          number,
          page,
        ),
      )
    }
  }

  return errors
}

export function decideStatus(
  errors: ExtractionValidationError[],
  input: { rawText: string; anomalousCharacterRatio: number | null },
): ExtractionStatus {
  const usable = isUsableMaterial(input.rawText, input.anomalousCharacterRatio)
  const hasFatal = errors.some((error) => error.consequence === 'fatal')
  if (hasFatal && !usable) return 'rejected'
  if (errors.length > 0) return 'quarantined'
  return 'accepted'
}

export function pageLevelErrors(input: {
  page: number
  questionsOnPage: number
  declaredColumns: number | null
  providedColumnTexts: number
  declaredPages: number | null
}): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = []
  if (input.questionsOnPage === 0) {
    errors.push(build('page-without-questions', 'warning', 'quarantine', 'La página no produjo ninguna pregunta.', null, input.page))
  }
  if (input.declaredColumns !== null && input.declaredColumns > 1 && input.providedColumnTexts < input.declaredColumns) {
    errors.push(
      build(
        'possible-column-loss',
        'error',
        'quarantine',
        'La página declara ' + String(input.declaredColumns) + ' columnas y solo se recibieron ' + String(input.providedColumnTexts) + ' flujos de texto.',
        null,
        input.page,
      ),
    )
  }
  return errors
}

export function summarizeErrors(errors: ExtractionValidationError[]): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const error of errors) summary[error.code] = (summary[error.code] ?? 0) + 1
  return summary
}

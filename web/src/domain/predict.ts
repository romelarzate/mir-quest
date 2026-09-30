/**
 * Contratos para el futuro motor Predict MIR.
 *
 * Esta fase NO calcula probabilidades. Todas las puntuaciones se devuelven
 * como null y el estado es siempre 'not-implemented' hasta que exista un
 * motor real con datos históricos verificados.
 */

export type PredictionStatus = 'not-implemented' | 'ready'

export type HistoricalQuestion = {
  questionId: string
  examVersionId: string
  year: number | null
  subjectId: string
  topicId: string | null
  subtopicId: string | null
  sourceIds: string[]
  similarityGroupId: string | null
  isDemo: boolean
}

export type QuestionFrequency = {
  questionId: string
  appearances: number
  examVersionIds: string[]
  years: number[]
  firstYear: number | null
  lastYear: number | null
}

export type TopicFrequency = {
  topicId: string
  subjectId: string
  questionCount: number
  appearanceCount: number
  shareOfSubject: number | null
}

export type RecencyWeight = {
  year: number
  weight: number | null
  rationale: string
}

export type SimilarityMethod = 'none' | 'lexical' | 'embedding'

export type QuestionSimilarity = {
  sourceQuestionId: string
  targetQuestionId: string
  score: number | null
  method: SimilarityMethod
  rationale: string
}

export type PredictionFeatureKey =
  | 'questionFrequency'
  | 'topicFrequency'
  | 'recency'
  | 'subjectDistribution'
  | 'topicDistribution'
  | 'recurrence'
  | 'trendShift'
  | 'semanticSimilarity'
  | 'examVersionCoverage'
  | 'appearanceIntervals'

export type PredictionFeature = {
  key: PredictionFeatureKey
  label: string
  value: number | null
  weight: number | null
  contribution: number | null
  available: boolean
  rationale: string
}

export type PredictionScore = {
  value: number | null
  scale: 'probability' | 'index'
  calibrated: boolean
  explanation: string
}

export type PredictionResult = {
  questionId: string | null
  topicId: string | null
  subjectId: string | null
  score: PredictionScore
  features: PredictionFeature[]
  status: PredictionStatus
  generatedAt: string
  warnings: string[]
}

export type PredictionRequest = {
  questionId?: string | null
  topicId?: string | null
  subjectId?: string | null
  examVersionIds?: string[]
  historicalQuestions: HistoricalQuestion[]
}

export type PredictionEngine = {
  id: string
  label: string
  status: PredictionStatus
  predict: (request: PredictionRequest, now: Date) => PredictionResult
}

export const predictionFeatureCatalog: PredictionFeature[] = [
  { key: 'questionFrequency', label: 'Frecuencia histórica de la pregunta', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere un corpus histórico verificado.' },
  { key: 'topicFrequency', label: 'Frecuencia del tema', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere conteos por convocatoria.' },
  { key: 'recency', label: 'Recencia', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere años reales por pregunta.' },
  { key: 'subjectDistribution', label: 'Distribución por asignatura', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere el reparto oficial por asignatura.' },
  { key: 'topicDistribution', label: 'Distribución por tema', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere el reparto oficial por tema.' },
  { key: 'recurrence', label: 'Recurrencia', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere series de apariciones por pregunta.' },
  { key: 'trendShift', label: 'Cambio de tendencia', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere al menos tres convocatorias comparables.' },
  { key: 'semanticSimilarity', label: 'Similitud semántica', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere un modelo de embeddings autorizado.' },
  { key: 'examVersionCoverage', label: 'Cobertura de versiones de examen', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere versiones de examen cargadas y validadas.' },
  { key: 'appearanceIntervals', label: 'Intervalos entre apariciones', value: null, weight: null, contribution: null, available: false, rationale: 'Requiere historial de apariciones con año fiable.' },
]

export const predictionWarnings = [
  'Motor estadístico no implementado en esta fase.',
  'No se generan probabilidades ni índices numéricos.',
  'No se atribuye procedencia histórica a contenido DEMO.',
]

export function emptyPredictionResult(
  request: PredictionRequest,
  now: Date,
  engineId: string,
): PredictionResult {
  return {
    questionId: request.questionId ?? null,
    topicId: request.topicId ?? null,
    subjectId: request.subjectId ?? null,
    score: {
      value: null,
      scale: 'index',
      calibrated: false,
      explanation: 'Sin cálculo: el motor Predict MIR todavía no está implementado.',
    },
    features: predictionFeatureCatalog.map((feature) => ({ ...feature })),
    status: 'not-implemented',
    generatedAt: now.toISOString(),
    warnings: [...predictionWarnings, 'Motor consultado: ' + engineId],
  }
}

/** Motor marcador. Existe para fijar el contrato, no para calcular nada. */
export const unavailablePredictionEngine: PredictionEngine = {
  id: 'predict-mir-placeholder',
  label: 'Predict MIR (motor estadístico próximamente)',
  status: 'not-implemented',
  predict: (request, now) => emptyPredictionResult(request, now, 'predict-mir-placeholder'),
}

export function explainPrediction(result: PredictionResult): string[] {
  const lines: string[] = []
  lines.push('Estado del motor: ' + result.status)
  lines.push(result.score.explanation)
  const missing = result.features.filter((feature) => !feature.available)
  lines.push('Variables pendientes de datos: ' + String(missing.length) + ' de ' + String(result.features.length) + '.')
  for (const feature of missing) {
    lines.push('- ' + feature.label + ': ' + feature.rationale)
  }
  return lines
}

export function summarizePredictionAvailability(result: PredictionResult): {
  total: number
  available: number
  pending: number
} {
  const available = result.features.filter((feature) => feature.available).length
  return { total: result.features.length, available, pending: result.features.length - available }
}

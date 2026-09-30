export type FeatureAvailability = 'demo' | 'unavailable' | 'ready'

export const featureKeys = ['frequency', 'recency', 'intensity', 'recurrence', 'trend', 'similarity'] as const
export type FeatureKey = (typeof featureKeys)[number]

export const featureLabels: Record<FeatureKey, string> = {
  frequency: 'Frecuencia',
  recency: 'Recencia',
  intensity: 'Intensidad',
  recurrence: 'Recurrencia',
  trend: 'Tendencia',
  similarity: 'Similitud',
}

export type FeatureValue = number | null

export type FeatureCell = {
  key: FeatureKey
  value: FeatureValue
  sampleSize: number | null
  available: boolean
  rationale: string
}

function emptyCells(availability: FeatureAvailability): FeatureCell[] {
  return featureKeys.map((key) => ({
    key,
    value: null,
    sampleSize: null,
    available: false,
    rationale:
      availability === 'demo'
        ? 'Variable DEMO sin valor histórico real.'
        : 'Pendiente de dataset histórico verificado.',
  }))
}

export type QuestionFeatures = {
  questionId: string
  availability: FeatureAvailability
  featureVersion: string
  datasetVersion: string | null
  computedAt: string | null
  cells: FeatureCell[]
  isDemo: boolean
}

export type TopicFeatures = {
  topicId: string
  subjectId: string
  clinicalDomainIds: string[]
  availability: FeatureAvailability
  featureVersion: string
  datasetVersion: string | null
  computedAt: string | null
  cells: FeatureCell[]
  isDemo: boolean
}

export function emptyQuestionFeatures(input: {
  questionId: string
  featureVersion: string
  datasetVersion?: string | null
  availability?: FeatureAvailability
  isDemo?: boolean
}): QuestionFeatures {
  const availability = input.availability ?? 'demo'
  return {
    questionId: input.questionId,
    availability,
    featureVersion: input.featureVersion,
    datasetVersion: input.datasetVersion ?? null,
    computedAt: null,
    cells: emptyCells(availability),
    isDemo: input.isDemo ?? true,
  }
}

export function emptyTopicFeatures(input: {
  topicId: string
  subjectId: string
  clinicalDomainIds?: string[]
  featureVersion: string
  datasetVersion?: string | null
  availability?: FeatureAvailability
  isDemo?: boolean
}): TopicFeatures {
  const availability = input.availability ?? 'demo'
  return {
    topicId: input.topicId,
    subjectId: input.subjectId,
    clinicalDomainIds: input.clinicalDomainIds ?? [],
    availability,
    featureVersion: input.featureVersion,
    datasetVersion: input.datasetVersion ?? null,
    computedAt: null,
    cells: emptyCells(availability),
    isDemo: input.isDemo ?? true,
  }
}

/**
 * Verdadero cuando la estructura existe pero no hay ningún valor real:
 * exactamente el estado permitido en esta fase.
 */
export function hasNoRealValues(features: QuestionFeatures | TopicFeatures): boolean {
  return features.availability !== 'ready' && features.cells.every((cell) => cell.value === null)
}

export function describeFeatureAvailability(features: QuestionFeatures | TopicFeatures): string {
  const available = features.cells.filter((cell) => cell.available).length
  if (features.availability === 'ready') return String(available) + ' de ' + String(features.cells.length) + ' variables con valor.'
  if (features.availability === 'demo') return 'Estructura DEMO: sin valores históricos.'
  return 'Sin dataset histórico: todas las variables pendientes.'
}

export function featureMatrix(features: QuestionFeatures[]): Record<FeatureKey, number | null>[] {
  return features.map((item) => {
    const row = {} as Record<FeatureKey, number | null>
    for (const key of featureKeys) {
      const cell = item.cells.find((candidate) => candidate.key === key)
      row[key] = cell ? cell.value : null
    }
    return row
  })
}

export function validateFeatureCells(features: QuestionFeatures | TopicFeatures): { ok: boolean; issues: string[] } {
  const issues: string[] = []
  if (features.cells.length !== featureKeys.length) issues.push('Faltan variables obligatorias.')
  for (const cell of features.cells) {
    if (!cell.available && cell.value !== null) issues.push('La variable ' + cell.key + ' no está disponible y trae valor.')
  }
  if (features.availability === 'ready' && features.computedAt === null) {
    issues.push('Una matriz lista exige fecha de cálculo.')
  }
  return { ok: issues.length === 0, issues }
}

export const featureStoreRules: string[] = [
  'El contrato de features existe desde ahora; los valores históricos reales no se calculan en esta fase.',
  'Toda variable DEMO o pendiente vale null y declara por qué.',
  'Ninguna matriz de features puede construirse con preguntas en cuarentena.',
]

import type { ExtractionQuality, ExtractedOption, QualityComponentKey } from './types'

/** Pesos documentados del cálculo de la confianza global. */
export const qualityWeights: Record<Exclude<QualityComponentKey, 'overallConfidence'>, number> = {
  textCompleteness: 0.15,
  questionBoundaryConfidence: 0.2,
  optionCompleteness: 0.25,
  answerKeyConfidence: 0.25,
  layoutConfidence: 0.15,
}

export const qualityDocumentation: string[] = [
  'textCompleteness = líneas no vacías / líneas totales del bloque. Mide si el bloque llegó entero, no si el contenido es correcto.',
  'questionBoundaryConfidence: 1.0 con marcador numerado y cierre limpio; 0.75 si la pregunta se unió entre páginas; 0.5 si el bloque termina sin terminador; 0.25 si hay marcadores mezclados; null si no hay ningún marcador.',
  'optionCompleteness = opciones detectadas / opciones esperadas. Las esperadas salen del examen declarado si existe; si no, del mayor índice de etiqueta contiguo. null si no se puede determinar ninguna referencia.',
  'answerKeyConfidence: 1.0 con patrón explícito (respuesta correcta: X); 0.7 con paréntesis o marca suelta; 0.0 si no aparece respuesta. No es null porque la ausencia sí es determinable.',
  'layoutConfidence: parte de 1.0 y resta penalizaciones por columnas, etiquetas intercaladas, tablas, dependencia de imagen y geometría desconocida; se acota a [0,1]. null si la página no aporta ni geometría ni texto.',
  'overallConfidence = media ponderada de los componentes disponibles, renormalizada sobre los presentes. Es null si no hay ningún componente disponible.',
  'Un componente que no se puede determinar queda en null y se registra en missingComponents.',
]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000))
}

export function computeTextCompleteness(blockText: string): number | null {
  if (blockText.trim().length === 0) return null
  const lines = blockText.split(String.fromCharCode(10)).map((line) => line.trim())
  if (lines.length === 0) return null
  const nonEmpty = lines.filter((line) => line.length > 0).length
  return clamp01(nonEmpty / lines.length)
}

export function computeBoundaryConfidence(input: {
  hasMarker: boolean
  splitAcrossPages: boolean
  endsCleanly: boolean
  mixedMarkers: boolean
}): number | null {
  if (!input.hasMarker) return null
  if (input.mixedMarkers) return 0.25
  if (input.splitAcrossPages) return 0.75
  return input.endsCleanly ? 1 : 0.5
}

export function computeOptionCompleteness(input: {
  options: ExtractedOption[]
  declaredOptionsPerQuestion: number | null
}): number | null {
  if (input.options.length === 0) return 0
  if (input.declaredOptionsPerQuestion !== null && input.declaredOptionsPerQuestion > 0) {
    return clamp01(input.options.length / input.declaredOptionsPerQuestion)
  }
  const codes = input.options.map((option) => option.label.toUpperCase().charCodeAt(0))
  const expected = Math.max(0, Math.max.apply(null, codes) - 64)
  if (expected <= 0) return null
  return clamp01(input.options.length / expected)
}

export type AnswerDetectionKind = 'explicit' | 'parenthetical' | 'bare' | 'none'

export function computeAnswerKeyConfidence(kind: AnswerDetectionKind): number {
  if (kind === 'explicit') return 1
  if (kind === 'parenthetical') return 0.7
  if (kind === 'bare') return 0.7
  return 0
}

export function computeLayoutConfidence(input: {
  hasGeometry: boolean
  hasText: boolean
  declaredColumns: number | null
  interleavedOptions: boolean
  hasTableMarkers: boolean
  imageDependent: boolean
}): number | null {
  if (!input.hasGeometry && !input.hasText) return null
  let value = 1
  if (!input.hasGeometry) value -= 0.2
  if (input.declaredColumns !== null && input.declaredColumns > 1) value -= 0.2
  if (input.interleavedOptions) value -= 0.4
  if (input.hasTableMarkers) value -= 0.5
  if (input.imageDependent) value -= 0.6
  return clamp01(value)
}

export function computeOverallConfidence(components: {
  textCompleteness: number | null
  questionBoundaryConfidence: number | null
  optionCompleteness: number | null
  answerKeyConfidence: number | null
  layoutConfidence: number | null
}): { overall: number | null; missing: QualityComponentKey[]; weightedSum: number; totalWeight: number } {
  const entries: Array<{ key: Exclude<QualityComponentKey, 'overallConfidence'>; value: number | null }> = [
    { key: 'textCompleteness', value: components.textCompleteness },
    { key: 'questionBoundaryConfidence', value: components.questionBoundaryConfidence },
    { key: 'optionCompleteness', value: components.optionCompleteness },
    { key: 'answerKeyConfidence', value: components.answerKeyConfidence },
    { key: 'layoutConfidence', value: components.layoutConfidence },
  ]

  const missing: QualityComponentKey[] = []
  let weightedSum = 0
  let totalWeight = 0

  for (const item of entries) {
    if (item.value === null) {
      missing.push(item.key)
      continue
    }
    const weight = qualityWeights[item.key]
    weightedSum += item.value * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return { overall: null, missing, weightedSum: 0, totalWeight: 0 }
  return { overall: clamp01(weightedSum / totalWeight), missing, weightedSum, totalWeight }
}

export function buildExtractionQuality(input: {
  textCompleteness: number | null
  questionBoundaryConfidence: number | null
  optionCompleteness: number | null
  answerKeyConfidence: number | null
  layoutConfidence: number | null
  notes: string[]
}): ExtractionQuality {
  const overall = computeOverallConfidence({
    textCompleteness: input.textCompleteness,
    questionBoundaryConfidence: input.questionBoundaryConfidence,
    optionCompleteness: input.optionCompleteness,
    answerKeyConfidence: input.answerKeyConfidence,
    layoutConfidence: input.layoutConfidence,
  })

  return {
    textCompleteness: input.textCompleteness,
    questionBoundaryConfidence: input.questionBoundaryConfidence,
    optionCompleteness: input.optionCompleteness,
    answerKeyConfidence: input.answerKeyConfidence,
    layoutConfidence: input.layoutConfidence,
    overallConfidence: overall.overall,
    missingComponents: overall.missing,
    notes: input.notes,
  }
}

export function describeQuality(quality: ExtractionQuality): string {
  if (quality.overallConfidence === null) return 'Confianza global no determinable.'
  const parts = ['global ' + String(quality.overallConfidence)]
  if (quality.missingComponents.length > 0) parts.push('pendientes: ' + quality.missingComponents.join(', '))
  return parts.join(' · ')
}

export function qualityBucket(quality: ExtractionQuality): string {
  if (quality.overallConfidence === null) return 'no-determinable'
  const value = quality.overallConfidence
  if (value < 0.2) return '0.0-0.2'
  if (value < 0.4) return '0.2-0.4'
  if (value < 0.6) return '0.4-0.6'
  if (value < 0.8) return '0.6-0.8'
  return '0.8-1.0'
}

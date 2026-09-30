import type { PredictionTargetType } from './dto'

export type BacktestMetricKey = 'precisionAtK' | 'recallAtK' | 'brierScore' | 'logLoss' | 'calibrationError'

export const backtestMetricKeys: BacktestMetricKey[] = [
  'precisionAtK',
  'recallAtK',
  'brierScore',
  'logLoss',
  'calibrationError',
]

export const backtestMetricLabels: Record<BacktestMetricKey, string> = {
  precisionAtK: 'Precisión en K',
  recallAtK: 'Sensibilidad en K',
  brierScore: 'Brier score',
  logLoss: 'Log loss',
  calibrationError: 'Error de calibración',
}

export type BacktestMetric = {
  key: BacktestMetricKey
  value: number | null
  k: number | null
  available: boolean
  rationale: string
}

export type BacktestPrediction = {
  targetType: PredictionTargetType
  targetId: string
  score: number | null
  calibratedProbability: number | null
  rank: number | null
  actualOutcome: boolean | null
}

export type TrainingWindow = {
  fromYear: number | null
  toYear: number | null
}

export type BacktestFold = {
  foldId: string
  trainingWindow: TrainingWindow
  targetYear: number | null
  questionCount: number
  predictions: BacktestPrediction[]
  metrics: BacktestMetric[]
}

export type BacktestRun = {
  backtestId: string
  datasetVersion: string | null
  featureVersion: string
  modelVersion: string | null
  createdAt: string
  k: number
  folds: BacktestFold[]
  status: 'planned' | 'not-implemented'
  warnings: string[]
}

export function emptyBacktestMetrics(reason: string): BacktestMetric[] {
  return backtestMetricKeys.map((key) => ({
    key,
    value: null,
    k: key === 'precisionAtK' || key === 'recallAtK' ? null : null,
    available: false,
    rationale: reason,
  }))
}

/**
 * Contrato de backtest sin ejecución: en esta fase no se calculan métricas
 * ni se tocan datos reales.
 */
export function createPlannedBacktestRun(input: {
  backtestId: string
  createdAt: string
  k: number
  datasetVersion?: string | null
  featureVersion: string
  modelVersion?: string | null
  folds?: BacktestFold[]
}): BacktestRun {
  return {
    backtestId: input.backtestId,
    datasetVersion: input.datasetVersion ?? null,
    featureVersion: input.featureVersion,
    modelVersion: input.modelVersion ?? null,
    createdAt: input.createdAt,
    k: input.k,
    folds: input.folds ?? [],
    status: 'planned',
    warnings: [
      'Backtest planificado: no se ejecuta sobre datos reales en esta fase.',
      'No hay métricas calculadas.',
    ],
  }
}

export function createBacktestFold(input: {
  foldId: string
  trainingWindow: TrainingWindow
  targetYear: number | null
  questionCount: number
  predictions?: BacktestPrediction[]
  reason: string
}): BacktestFold {
  return {
    foldId: input.foldId,
    trainingWindow: input.trainingWindow,
    targetYear: input.targetYear,
    questionCount: input.questionCount,
    predictions: input.predictions ?? [],
    metrics: emptyBacktestMetrics(input.reason),
  }
}

export function validateBacktestRun(run: BacktestRun): { ok: boolean; issues: string[] } {
  const issues: string[] = []
  if (run.backtestId.trim().length === 0) issues.push('backtestId vacío')
  if (run.k <= 0) issues.push('K debe ser positivo')
  if (run.folds.some((fold) => fold.trainingWindow.fromYear !== null && fold.targetYear !== null && fold.trainingWindow.fromYear > fold.targetYear)) {
    issues.push('La ventana de entrenamiento no puede empezar después del año objetivo')
  }
  for (const fold of run.folds) {
    for (const metric of fold.metrics) {
      if (!metric.available && metric.value !== null) issues.push('Métrica ' + metric.key + ' no disponible con valor')
    }
  }
  if (run.status === 'planned' && run.folds.some((fold) => fold.metrics.some((metric) => metric.available))) {
    issues.push('Un backtest planificado no puede traer métricas disponibles')
  }
  return { ok: issues.length === 0, issues }
}

export function backtestSummary(run: BacktestRun): string {
  return (
    run.backtestId +
    ' · estado ' +
    run.status +
    ' · ' +
    String(run.folds.length) +
    ' folds · K=' +
    String(run.k) +
    ' · dataset ' +
    (run.datasetVersion ?? 'sin dataset')
  )
}

export const backtestRules: string[] = [
  'El contrato de backtest existe desde ahora; las métricas no se calculan todavía.',
  'Toda métrica no calculada vale null y explica por qué.',
  'Ningún backtest puede ejecutarse sobre datos reales hasta que el dataset esté verificado.',
  'Sin calibración validada no se reportan probabilidades, solo scores.',
]

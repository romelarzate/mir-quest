import { describe, expect, it } from 'vitest'
import {
  backtestMetricKeys,
  backtestRules,
  backtestSummary,
  createBacktestFold,
  createPlannedBacktestRun,
  emptyBacktestMetrics,
  validateBacktestRun,
} from './backtest'

const now = '2026-09-29T09:00:00.000Z'

describe('métricas de backtest', () => {
  it('declara las cinco métricas previstas sin valores', () => {
    const metrics = emptyBacktestMetrics('sin ejecución')
    expect(metrics.length).toBe(5)
    expect(metrics.map((metric) => metric.key)).toEqual([...backtestMetricKeys])
    expect(metrics.every((metric) => metric.value === null)).toBe(true)
    expect(metrics.every((metric) => metric.available === false)).toBe(true)
  })
})

describe('folds', () => {
  it('crea un fold con ventana de entrenamiento y año objetivo', () => {
    const fold = createBacktestFold({ foldId: 'fold-1', trainingWindow: { fromYear: 2010, toYear: 2018 }, targetYear: 2019, questionCount: 200, reason: 'sin dataset' })
    expect(fold.foldId).toBe('fold-1')
    expect(fold.targetYear).toBe(2019)
    expect(fold.predictions).toEqual([])
    expect(fold.metrics.every((metric) => metric.value === null)).toBe(true)
  })
})

describe('BacktestRun', () => {
  it('se crea planificado, sin métricas y con avisos', () => {
    const run = createPlannedBacktestRun({ backtestId: 'bt-1', createdAt: now, k: 20, featureVersion: 'feature-demo-1' })
    expect(run.status).toBe('planned')
    expect(run.folds).toEqual([])
    expect(run.warnings.length).toBeGreaterThan(0)
    expect(validateBacktestRun(run).ok).toBe(true)
  })

  it('acepta folds coherentes', () => {
    const fold = createBacktestFold({ foldId: 'fold-1', trainingWindow: { fromYear: 2010, toYear: 2018 }, targetYear: 2019, questionCount: 200, reason: 'sin dataset' })
    const run = createPlannedBacktestRun({ backtestId: 'bt-1', createdAt: now, k: 20, featureVersion: 'feature-demo-1', folds: [fold] })
    expect(validateBacktestRun(run).ok).toBe(true)
    expect(backtestSummary(run)).toContain('K=20')
    expect(backtestSummary(run)).toContain('sin dataset')
  })

  it('rechaza métricas disponibles en un backtest planificado', () => {
    const fold = createBacktestFold({ foldId: 'fold-1', trainingWindow: { fromYear: 2010, toYear: 2018 }, targetYear: 2019, questionCount: 200, reason: 'sin dataset' })
    const tamperedFold = { ...fold, metrics: fold.metrics.map((metric, index) => (index === 0 ? { ...metric, value: 0.5, available: true } : metric)) }
    const run = createPlannedBacktestRun({ backtestId: 'bt-1', createdAt: now, k: 20, featureVersion: 'feature-demo-1', folds: [tamperedFold] })
    const validation = validateBacktestRun(run)
    expect(validation.ok).toBe(false)
    expect(validation.issues.some((issue) => issue.indexOf('planificado') !== -1)).toBe(true)
  })

  it('rechaza una ventana de entrenamiento posterior al año objetivo', () => {
    const fold = createBacktestFold({ foldId: 'fold-1', trainingWindow: { fromYear: 2020, toYear: 2021 }, targetYear: 2019, questionCount: 10, reason: 'x' })
    const run = createPlannedBacktestRun({ backtestId: 'bt-1', createdAt: now, k: 20, featureVersion: 'feature-demo-1', folds: [fold] })
    expect(validateBacktestRun(run).ok).toBe(false)
  })

  it('rechaza K no positivo y identificador vacío', () => {
    const badK = createPlannedBacktestRun({ backtestId: 'bt-1', createdAt: now, k: 0, featureVersion: 'feature-demo-1' })
    expect(validateBacktestRun(badK).ok).toBe(false)
    const badId = createPlannedBacktestRun({ backtestId: '  ', createdAt: now, k: 5, featureVersion: 'feature-demo-1' })
    expect(validateBacktestRun(badId).ok).toBe(false)
  })

  it('documenta las reglas de backtest', () => {
    expect(backtestRules.length).toBe(4)
  })
})

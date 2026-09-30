import { describe, expect, it } from 'vitest'
import { createMockServices, notConnectedMessage, serviceCatalog, serviceRules } from './services'

const now = '2026-09-29T09:00:00.000Z'

describe('catálogo de servicios', () => {
  it('declara los siete servicios del motor', () => {
    expect(serviceCatalog.length).toBe(7)
    expect(serviceCatalog.map((service) => service.name)).toEqual([
      'HistoricalDataService',
      'ExtractionService',
      'ClassificationService',
      'FeatureService',
      'PredictionService',
      'BacktestService',
      'SimulationService',
    ])
  })

  it('declara dependencias en cadena', () => {
    const feature = serviceCatalog.find((service) => service.name === 'FeatureService')
    expect(feature?.dependsOn).toEqual(['ClassificationService'])
    const simulation = serviceCatalog.find((service) => service.name === 'SimulationService')
    expect(simulation?.dependsOn.length).toBe(2)
  })

  it('todos los servicios están en modo mock', () => {
    expect(serviceCatalog.every((service) => service.status === 'mock')).toBe(true)
  })
})

describe('implementaciones mock', () => {
  it('no devuelven datos inventados', async () => {
    const services = createMockServices(now)
    expect(await services.historicalData.listExams()).toEqual([])
    expect(await services.historicalData.getExam('e1')).toBeNull()
    expect(await services.historicalData.listQuestions()).toEqual([])
    expect(await services.extraction.extract({ questionId: 'hq-1', rawText: 'texto' })).toBeNull()
    expect(await services.extraction.listQuarantine()).toEqual([])
    expect(await services.features.questionFeatures(['hq-1'])).toEqual([])
    expect(await services.prediction.predict({ targetType: 'topic', targetId: 't1' })).toBeNull()
  })

  it('la clasificación mock no inventa dominios', async () => {
    const services = createMockServices(now)
    const result = await services.classification.classify('hq-1')
    expect(result.clinicalDomainIds).toEqual([])
    expect(result.confidence).toBeNull()
    expect(result.ambiguous).toBe(true)
  })

  it('el backtest mock devuelve un plan sin métricas', async () => {
    const services = createMockServices(now)
    const run = await services.backtest.plan({ backtestId: 'bt-1', k: 20 })
    expect(run.status).toBe('planned')
    expect(run.folds).toEqual([])
    expect(run.warnings).toContain(notConnectedMessage)
  })

  it('la simulación mock no selecciona preguntas', async () => {
    const services = createMockServices(now)
    const result = await services.simulation.plan({
      requestId: 'sim-1',
      seed: 's1',
      questionCount: 5,
      subjectIds: [],
      topicIds: [],
      clinicalDomainIds: [],
      versions: { datasetVersion: 'd1', taxonomyVersion: 't1', featureVersion: 'f1', modelVersion: null, simulationVersion: 'sim1' },
      requestedAt: now,
    }, [])
    expect(result.questionIds).toEqual([])
    expect(result.manifest.hashAlgorithm).toBe('sha-256')
    expect(result.warnings).toContain(notConnectedMessage)
  })

  it('documenta que ningún servicio depende de React', () => {
    expect(serviceRules.some((rule) => rule.indexOf('React') !== -1)).toBe(true)
  })
})

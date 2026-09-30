import { describe, expect, it } from 'vitest'
import { apiBasePath, apiEndpointCount, apiEndpoints, apiRules, findEndpoint, mockHandlers, notImplementedStatus } from './api'

describe('catálogo de endpoints', () => {
  it('declara los ocho endpoints conceptuales', () => {
    expect(apiEndpointCount()).toBe(8)
    expect(apiEndpoints.length).toBe(8)
  })

  it('todos cuelgan de /api/v1/predict y exigen autenticación', () => {
    expect(apiBasePath).toBe('/api/v1/predict')
    expect(apiEndpoints.every((endpoint) => endpoint.path.indexOf('/api/v1/predict') === 0)).toBe(true)
    expect(apiEndpoints.every((endpoint) => endpoint.authRequired)).toBe(true)
  })

  it('busca endpoints por método y ruta', () => {
    expect(findEndpoint('POST', '/api/v1/predict/simulations')?.status).toBe('mock')
    expect(findEndpoint('GET', '/api/v1/predict/datasets')?.responseDto).toBe('DatasetMetadataDTO[]')
    expect(findEndpoint('GET', '/api/v1/predict/inexistente')).toBeUndefined()
  })
})

describe('handlers mock', () => {
  it('devuelven 501 sin cuerpo inventado', () => {
    const summary = mockHandlers.predictSummary()
    expect(summary.status).toBe(notImplementedStatus)
    expect(summary.body).toBeNull()
    expect(summary.warnings.length).toBeGreaterThan(0)
    expect(mockHandlers.predictTopics().status).toBe(501)
    expect(mockHandlers.listDatasets().status).toBe(501)
    expect(mockHandlers.listModels().status).toBe(501)
    expect(mockHandlers.listBacktests().status).toBe(501)
    expect(mockHandlers.getSimulation('sim-1').status).toBe(501)
  })

  it('la creación de simulación avisa y no ejecuta nada', () => {
    const response = mockHandlers.createSimulation({
      requestId: 'sim-1',
      seed: 'semilla-x',
      questionCount: 5,
      subjectIds: [],
      topicIds: [],
      clinicalDomainIds: [],
      versions: { datasetVersion: 'd1', taxonomyVersion: 't1', featureVersion: 'f1', modelVersion: null, simulationVersion: 's1' },
      requestedAt: '2026-09-29T09:00:00.000Z',
    })
    expect(response.status).toBe(501)
    expect(response.body).toBeNull()
    expect(response.warnings.join(' ')).toContain('semilla-x')
  })

  it('el detalle de tema tampoco inventa datos', () => {
    expect(mockHandlers.predictTopicDetail('topic-1').status).toBe(501)
    expect(mockHandlers.predictTopicResult(null).status).toBe(501)
  })

  it('documenta las reglas de la API', () => {
    expect(apiRules.length).toBe(4)
  })
})

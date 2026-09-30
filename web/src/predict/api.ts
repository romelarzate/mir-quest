import type { PredictionResultDTO, SimulationRequestDTO, SimulationResultDTO, DatasetMetadataDTO, ModelMetadataDTO } from './dto'
import type { BacktestRun } from './backtest'

export type HttpMethod = 'GET' | 'POST'

export type ApiEndpointStatus = 'planned' | 'mock'

export type ApiEndpoint = {
  method: HttpMethod
  path: string
  description: string
  responseDto: string
  status: ApiEndpointStatus
  authRequired: boolean
}

export const apiBasePath = '/api/v1/predict'

export const apiEndpoints: ApiEndpoint[] = [
  { method: 'GET', path: '/api/v1/predict/summary', description: 'Resumen agregado de predicciones', responseDto: 'PredictionSummaryDTO', status: 'planned', authRequired: true },
  { method: 'GET', path: '/api/v1/predict/topics', description: 'Lista de temas con score', responseDto: 'TopicPredictionListDTO', status: 'planned', authRequired: true },
  { method: 'GET', path: '/api/v1/predict/topics/:id', description: 'Detalle de predicción de un tema', responseDto: 'PredictionResultDTO', status: 'planned', authRequired: true },
  { method: 'POST', path: '/api/v1/predict/simulations', description: 'Crea una simulación reproducible', responseDto: 'SimulationResultDTO', status: 'mock', authRequired: true },
  { method: 'GET', path: '/api/v1/predict/simulations/:id', description: 'Recupera una simulación por identificador', responseDto: 'SimulationResultDTO', status: 'planned', authRequired: true },
  { method: 'GET', path: '/api/v1/predict/datasets', description: 'Lista versiones de dataset', responseDto: 'DatasetMetadataDTO[]', status: 'planned', authRequired: true },
  { method: 'GET', path: '/api/v1/predict/models', description: 'Lista versiones de modelo', responseDto: 'ModelMetadataDTO[]', status: 'planned', authRequired: true },
  { method: 'GET', path: '/api/v1/predict/backtests', description: 'Lista ejecuciones de backtest', responseDto: 'BacktestRun[]', status: 'planned', authRequired: true },
]

export function findEndpoint(method: HttpMethod, path: string): ApiEndpoint | undefined {
  return apiEndpoints.find((endpoint) => endpoint.method === method && endpoint.path === path)
}

export type ApiResponse<T> = {
  status: number
  body: T | null
  warnings: string[]
}

export const notImplementedStatus = 501

function notImplemented(warnings: string[]): ApiResponse<never> {
  return { status: notImplementedStatus, body: null, warnings }
}

/**
 * Handlers mock/locales. No hay servidor de producción: devuelven 501 con aviso
 * explícito en lugar de datos inventados.
 */
export const mockHandlers = {
  predictSummary: (): ApiResponse<never> => notImplemented(['Predicción no implementada: no hay handler real.']),
  predictTopics: (): ApiResponse<never> => notImplemented(['Sin temas predictivos: el motor no está conectado.']),
  predictTopicDetail: (topicId: string): ApiResponse<never> => notImplemented(['Sin detalle de predicción para ' + topicId + '.']),
  createSimulation: (request: SimulationRequestDTO): ApiResponse<SimulationResultDTO | never> => ({
    status: notImplementedStatus,
    body: null,
    warnings: ['Simulación no ejecutada. Semilla recibida: ' + request.seed + '. Handler local únicamente.'],
  }),
  getSimulation: (simulationId: string): ApiResponse<SimulationResultDTO | never> => notImplemented(['Simulación ' + simulationId + ' no disponible.']),
  listDatasets: (): ApiResponse<DatasetMetadataDTO[] | never> => notImplemented(['No hay datasets cargados.']),
  listModels: (): ApiResponse<ModelMetadataDTO[] | never> => notImplemented(['No hay modelos registrados.']),
  listBacktests: (): ApiResponse<BacktestRun[] | never> => notImplemented(['No hay backtests ejecutados.']),
  predictTopicResult: (result: PredictionResultDTO | null): ApiResponse<PredictionResultDTO | never> =>
    result === null ? notImplemented(['Sin resultado de predicción.']) : { status: 200, body: result, warnings: result.warnings },
}

export function apiEndpointCount(): number {
  return apiEndpoints.length
}

export const apiRules: string[] = [
  'Contrato de endpoints definido; no se implementa servidor de producción.',
  'Los handlers existentes son mock/locales y devuelven 501 con aviso explícito.',
  'Ningún endpoint devuelve datos inventados.',
  'React nunca accede directamente a la base de datos del motor.',
]

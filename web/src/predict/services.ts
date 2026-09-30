import type { HistoricalExamDTO, HistoricalQuestionDTO, PredictionResultDTO, SimulationRequestDTO, SimulationResultDTO } from './dto'
import type { ExtractionResult, QuarantineQuestion } from './extraction'
import type { QuestionFeatures, TopicFeatures } from './features'
import type { BacktestRun } from './backtest'
import type { CandidateQuestion } from './reproducibility'

export type ServiceStatus = 'mock' | 'not-implemented' | 'ready'

export type HistoricalQuestionFilter = {
  year?: number | null
  subjectId?: string | null
  topicId?: string | null
  clinicalDomainId?: string | null
  includeQuarantined?: boolean
}

export type HistoricalDataService = {
  id: string
  label: string
  status: ServiceStatus
  listExams: () => Promise<HistoricalExamDTO[]>
  getExam: (examId: string) => Promise<HistoricalExamDTO | null>
  listQuestions: (filter?: HistoricalQuestionFilter) => Promise<HistoricalQuestionDTO[]>
}

export type ExtractionService = {
  id: string
  label: string
  status: ServiceStatus
  extract: (input: { questionId: string; rawText: string }) => Promise<ExtractionResult | null>
  listQuarantine: () => Promise<QuarantineQuestion[]>
}

export type ClassificationResult = {
  questionId: string
  clinicalDomainIds: string[]
  confidence: number | null
  ambiguous: boolean
}

export type ClassificationService = {
  id: string
  label: string
  status: ServiceStatus
  classify: (questionId: string) => Promise<ClassificationResult>
}

export type FeatureService = {
  id: string
  label: string
  status: ServiceStatus
  questionFeatures: (questionIds: string[]) => Promise<QuestionFeatures[]>
  topicFeatures: (topicIds: string[]) => Promise<TopicFeatures[]>
}

export type PredictionService = {
  id: string
  label: string
  status: ServiceStatus
  predict: (input: { targetType: 'question' | 'topic' | 'subject' | 'clinical-domain'; targetId: string }) => Promise<PredictionResultDTO | null>
}

export type BacktestService = {
  id: string
  label: string
  status: ServiceStatus
  plan: (input: { backtestId: string; k: number }) => Promise<BacktestRun>
}

export type SimulationService = {
  id: string
  label: string
  status: ServiceStatus
  plan: (request: SimulationRequestDTO, candidates: CandidateQuestion[]) => Promise<SimulationResultDTO>
}

export const notConnectedMessage = 'Servicio no conectado: contrato definido, sin datos reales.'

/** Implementaciones mock: no calculan, no leen bases de datos y no llaman a la red. */
export function createMockServices(generatedAt: string) {
  const historicalData: HistoricalDataService = {
    id: 'historical-data-mock',
    label: 'Datos históricos (mock)',
    status: 'mock',
    listExams: async () => [],
    getExam: async () => null,
    listQuestions: async () => [],
  }

  const extraction: ExtractionService = {
    id: 'extraction-mock',
    label: 'Extracción (mock)',
    status: 'mock',
    extract: async () => null,
    listQuarantine: async () => [],
  }

  const classification: ClassificationService = {
    id: 'classification-mock',
    label: 'Clasificación (mock)',
    status: 'mock',
    classify: async (questionId) => ({ questionId, clinicalDomainIds: [], confidence: null, ambiguous: true }),
  }

  const features: FeatureService = {
    id: 'feature-mock',
    label: 'Features (mock)',
    status: 'mock',
    questionFeatures: async () => [],
    topicFeatures: async () => [],
  }

  const prediction: PredictionService = {
    id: 'prediction-mock',
    label: 'Predicción (mock)',
    status: 'mock',
    predict: async () => null,
  }

  const backtest: BacktestService = {
    id: 'backtest-mock',
    label: 'Backtest (mock)',
    status: 'mock',
    plan: async (input) => ({
      backtestId: input.backtestId,
      datasetVersion: null,
      featureVersion: 'feature-unspecified',
      modelVersion: null,
      createdAt: generatedAt,
      k: input.k,
      folds: [],
      status: 'planned',
      warnings: [notConnectedMessage],
    }),
  }

  const simulation: SimulationService = {
    id: 'simulation-mock',
    label: 'Simulación (mock)',
    status: 'mock',
    plan: async (request) => ({
      simulationId: request.requestId,
      questionIds: [],
      status: 'planned',
      warnings: [notConnectedMessage],
      manifest: {
        simulationId: request.requestId,
        seed: request.seed,
        datasetVersion: request.versions.datasetVersion,
        taxonomyVersion: request.versions.taxonomyVersion,
        featureVersion: request.versions.featureVersion,
        modelVersion: request.versions.modelVersion,
        simulationVersion: request.versions.simulationVersion,
        generatedAt: request.requestedAt,
        questionIds: [],
        hash: 'sin-calcular',
        hashAlgorithm: 'sha-256',
        secondaryHash: null,
      },
    }),
  }

  return { historicalData, extraction, classification, features, prediction, backtest, simulation }
}

export type ServiceDescriptor = {
  name: string
  id: string
  status: ServiceStatus
  dependsOn: string[]
}

export const serviceCatalog: ServiceDescriptor[] = [
  { name: 'HistoricalDataService', id: 'historical-data-mock', status: 'mock', dependsOn: [] },
  { name: 'ExtractionService', id: 'extraction-mock', status: 'mock', dependsOn: ['HistoricalDataService'] },
  { name: 'ClassificationService', id: 'classification-mock', status: 'mock', dependsOn: ['ExtractionService'] },
  { name: 'FeatureService', id: 'feature-mock', status: 'mock', dependsOn: ['ClassificationService'] },
  { name: 'PredictionService', id: 'prediction-mock', status: 'mock', dependsOn: ['FeatureService'] },
  { name: 'BacktestService', id: 'backtest-mock', status: 'mock', dependsOn: ['PredictionService'] },
  { name: 'SimulationService', id: 'simulation-mock', status: 'mock', dependsOn: ['PredictionService', 'FeatureService'] },
]

export const serviceRules: string[] = [
  'Ninguna interfaz de servicio depende de React.',
  'Los servicios son la única puerta hacia los datos del motor de conocimiento.',
  'Los mocks no calculan, no leen bases de datos y no hacen peticiones de red.',
  'La predicción depende de features, y las features de la clasificación, que depende de la extracción.',
]

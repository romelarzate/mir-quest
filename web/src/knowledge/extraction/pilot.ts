import { qualityBucket } from './quality'
import { createSyntheticTextSource, createTextLayerExtractionService } from './pdfExtractionService'
import type { ExtractionFixture } from './fixtures'
import { summarizeErrors } from './validators'
import type { ExtractionRun, ExtractionStatus } from './types'

export type PilotDescriptor = {
  file: string
  sizeBytes: number
  pages: number
  sha256: string
  title: string
  documentId: string
  versionId: string
  sourceId: string
}

export function describePilotDocument(fixture: ExtractionFixture): PilotDescriptor {
  return {
    file: fixture.document.fileName,
    sizeBytes: fixture.document.sizeBytes,
    pages: fixture.pages.length,
    sha256: fixture.document.sha256,
    title: fixture.document.title,
    documentId: fixture.document.id,
    versionId: fixture.version.id,
    sourceId: 'synthetic-text-source',
  }
}

export function describePilotSelection(fixture: ExtractionFixture): string[] {
  const descriptor = describePilotDocument(fixture)
  return [
    'Archivo: ' + descriptor.file,
    'Tamano: ' + String(descriptor.sizeBytes) + ' bytes',
    'Paginas: ' + String(descriptor.pages),
    'SHA-256: ' + descriptor.sha256,
    'Documento: ' + descriptor.documentId,
    'Version: ' + descriptor.versionId,
    'Opciones declaradas por pregunta: ' + String(fixture.document.declaredOptionsPerQuestion),
  ]
}

export type PilotTotals = {
  totalPages: number
  pagesWithQuestions: number
  questionsDetected: number
  accepted: number
  quarantined: number
  rejected: number
  duplicateCandidates: number
}

export type PilotMetrics = {
  extractionAcceptanceRate: number
  quarantineRate: number
  rejectionRate: number
  optionDetectionRate: number
  answerDetectionRate: number
  sequenceIntegrityRate: number
}

export const metricsDisclaimer =
  'Son tasas de resultado del pipeline sobre un examen sintetico, no precision del extractor: todavia no existe ground truth humano.'

export type PilotQuestionSummary = {
  index: number
  questionNumber: number | null
  page: number
  status: ExtractionStatus
  confidence: number | null
  qualityBucket: string
  optionCount: number
  detectedAnswer: string | null
  duplicateCandidate: boolean
  splitAcrossPages: boolean
  errorCodes: string[]
  textPreview: string
}

export type PilotReport = {
  generatedAt: string
  document: PilotDescriptor
  totals: PilotTotals
  validationErrors: Record<string, number>
  qualityDistribution: Record<string, number>
  metrics: PilotMetrics
  metricsDisclaimer: string
  questions: PilotQuestionSummary[]
  pageErrors: Array<{ code: string; page: number | null; message: string }>
  selection: string[]
}

function rate(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 1000
}

export function computePilotTotals(run: ExtractionRun): PilotTotals {
  return {
    totalPages: run.pages,
    pagesWithQuestions: run.pagesWithQuestions.length,
    questionsDetected: run.questions.length,
    accepted: run.questions.filter((question) => question.validationStatus === 'accepted').length,
    quarantined: run.questions.filter((question) => question.validationStatus === 'quarantined').length,
    rejected: run.questions.filter((question) => question.validationStatus === 'rejected').length,
    duplicateCandidates: run.questions.filter((question) => question.duplicateCandidate).length,
  }
}

export function computePilotMetrics(run: ExtractionRun): PilotMetrics {
  const totals = computePilotTotals(run)
  const withOptions = run.questions.filter((question) => question.options.length >= 2).length
  const withAnswer = run.questions.filter((question) => question.detectedAnswer !== null).length
  const sequenceErrors = run.questions.filter((question) =>
    question.validationErrors.some((error) => error.code === 'sequence-mismatch'),
  ).length
  const sequenceBase = Math.max(1, totals.questionsDetected - 1)
  return {
    extractionAcceptanceRate: rate(totals.accepted, totals.questionsDetected),
    quarantineRate: rate(totals.quarantined, totals.questionsDetected),
    rejectionRate: rate(totals.rejected, totals.questionsDetected),
    optionDetectionRate: rate(withOptions, totals.questionsDetected),
    answerDetectionRate: rate(withAnswer, totals.questionsDetected),
    sequenceIntegrityRate: Math.round((1 - Math.min(1, sequenceErrors / sequenceBase)) * 1000) / 1000,
  }
}

export function buildPilotReport(fixture: ExtractionFixture, run: ExtractionRun, now: Date): PilotReport {
  const qualityDistribution: Record<string, number> = {}
  for (const question of run.questions) {
    const bucket = qualityBucket(question.quality)
    qualityDistribution[bucket] = (qualityDistribution[bucket] ?? 0) + 1
  }

  return {
    generatedAt: now.toISOString(),
    document: describePilotDocument(fixture),
    totals: computePilotTotals(run),
    validationErrors: summarizeErrors(
      run.questions.flatMap((question) => question.validationErrors).concat(run.pageErrors),
    ),
    qualityDistribution,
    metrics: computePilotMetrics(run),
    metricsDisclaimer,
    questions: run.questions.map((question, index) => ({
      index,
      questionNumber: question.questionNumber,
      page: question.page,
      status: question.validationStatus,
      confidence: question.confidence,
      qualityBucket: qualityBucket(question.quality),
      optionCount: question.options.length,
      detectedAnswer: question.detectedAnswer,
      duplicateCandidate: question.duplicateCandidate,
      splitAcrossPages: question.splitAcrossPages,
      errorCodes: question.validationErrors.map((error) => error.code),
      textPreview: question.rawText.slice(0, 120),
    })),
    pageErrors: run.pageErrors.map((error) => ({ code: error.code, page: error.page, message: error.message })),
    selection: describePilotSelection(fixture),
  }
}

export async function runPilot(
  fixture: ExtractionFixture,
  options: { now?: Date } = {},
): Promise<{ descriptor: PilotDescriptor; run: ExtractionRun; report: PilotReport }> {
  const now = options.now ?? new Date()
  const service = createTextLayerExtractionService()
  const source = createSyntheticTextSource(fixture.pages)
  const run = await service.extract({ document: fixture.document, version: fixture.version, source })
  return { descriptor: describePilotDocument(fixture), run, report: buildPilotReport(fixture, run, now) }
}

export const pilotRules: string[] = [
  'El piloto procesa un unico examen y no escala automaticamente.',
  'Antes de extraer se declaran archivo, tamano, paginas y hash SHA-256.',
  'Ninguna metrica se presenta como precision del extractor sin ground truth.',
  'Los fixtures son sinteticos: no representan PDFs ni examenes MIR reales.',
]

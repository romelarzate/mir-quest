import { markdownGeneratorVersion, markdownNormalizerVersion } from '../artifacts'
import { buildCanonicalFromPages, findLostSourceText } from '../fromSource'
import { validateCanonicalDocument } from '../documentValidators'
import { createMarkdownTextSource } from '../markdownSource'
import { normalizeForComparison } from '../normalize'
import type { CanonicalDocument } from '../types'
import { richDocumentToPages } from '../pdf/bridge'
import type { PdfLimits, PdfTextSegment, RealPdfAdapter, RichPdfDocument, RichPdfPage } from '../pdf/types'
import { createTextLayerExtractionService } from '../../extraction/pdfExtractionService'
import type { DocumentVersionRef, ExtractionRun, PdfPage, SourceDocumentRef } from '../../extraction/types'
import { sha256, stableStringify } from '../../ids'

const nl = String.fromCharCode(10)
const comma = ', '

export type ValidationSourceKind = 'real-pdf' | 'synthetic-fixture'

export type ValidationVersions = { pdfjs: string; documentSkill: string; normalizer: string; extractor: string }

export const extractorVersion = 'text-layer-extractor-v1'

export const validationRules: string[] = [
  'Sin PDF real autorizado no se ejecuta la validacion real: no se inventa ni se descarga material.',
  'El timestamp es provenance del experimento y nunca entra en el hash de contenido.',
  'Las metricas de esta fase son descriptivas: no son precision, exactitud, accuracy, recall ni F1.',
  'La guarda por lineas no demuestra preservacion semantica: la limitacion se declara siempre.',
  'El orden de lectura se clasifica, no se corrige.',
  'Ninguna estructura dudosa se elimina: se conserva con su provenance.',
  'El ground truth humano se registra separado del resultado automatico.',
]

export const forbiddenMetricNames: string[] = ['precision', 'accuracy', 'recall', 'f1', 'exactitud']

export type ValidationSnapshot = {
  fileName: string
  sizeBytes: number
  sha256: string
  pageCount: number
  processedAt: string
  sourceKind: ValidationSourceKind
  versions: ValidationVersions
  contentHash: string
}

export type SnapshotHashInput = {
  sizeBytes: number
  sha256: string
  pageCount: number
  sourceKind: ValidationSourceKind
  versions: ValidationVersions
}

export function snapshotContentHash(input: SnapshotHashInput): string {
  return sha256(stableStringify(input))
}

export function createValidationSnapshot(input: SnapshotHashInput & { fileName: string; processedAt: string }): ValidationSnapshot {
  const hashInput: SnapshotHashInput = {
    sizeBytes: input.sizeBytes,
    sha256: input.sha256,
    pageCount: input.pageCount,
    sourceKind: input.sourceKind,
    versions: input.versions,
  }
  return {
    fileName: input.fileName,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256,
    pageCount: input.pageCount,
    processedAt: input.processedAt,
    sourceKind: input.sourceKind,
    versions: input.versions,
    contentHash: snapshotContentHash(hashInput),
  }
}

export function defaultVersions(pdfjsVersion: string): ValidationVersions {
  return { pdfjs: pdfjsVersion, documentSkill: markdownGeneratorVersion, normalizer: markdownNormalizerVersion, extractor: extractorVersion }
}

export type DescriptiveMetrics = {
  pagesProcessed: number
  emptyPages: number
  markdownBlocks: number
  sourceCharacters: number
  markdownCharacters: number
  questionsDetected: number
  questionsAccepted: number
  questionsQuarantined: number
  questionsRejected: number
  documentAnomalies: number
  multiColumnPages: number
  pagesWithImages: number
  tableCandidates: number
}

export function computeDescriptiveMetrics(input: {
  richPages: RichPdfPage[]
  pages: PdfPage[]
  document: CanonicalDocument
  anomalies: number
  run: ExtractionRun
}): DescriptiveMetrics {
  return {
    pagesProcessed: input.richPages.length,
    emptyPages: input.richPages.filter((page) => !page.hasText).length,
    markdownBlocks: input.document.blocks.length,
    sourceCharacters: input.pages.reduce((total, page) => total + page.text.length, 0),
    markdownCharacters: input.document.markdown.length,
    questionsDetected: input.run.questions.length,
    questionsAccepted: input.run.questions.filter((question) => question.validationStatus === 'accepted').length,
    questionsQuarantined: input.run.questions.filter((question) => question.validationStatus === 'quarantined').length,
    questionsRejected: input.run.questions.filter((question) => question.validationStatus === 'rejected').length,
    documentAnomalies: input.anomalies,
    multiColumnPages: input.richPages.filter((page) => page.columns.detected !== null && page.columns.detected > 1).length,
    pagesWithImages: input.richPages.filter((page) => page.images.length > 0).length,
    tableCandidates: input.richPages.reduce((total, page) => total + page.tables.length, 0),
  }
}

export function metricNamesAreDescriptive(metrics: DescriptiveMetrics): boolean {
  return Object.keys(metrics)
    .map((key) => key.toLowerCase())
    .every((key) => forbiddenMetricNames.every((forbidden) => key.indexOf(forbidden) === -1))
}

export type LossAnalysis = {
  preservedLines: number
  unlocatedLines: string[]
  affectedPages: number[]
  affectedBlocks: string[]
  possibleReordering: string[]
  duplicatedLines: string[]
  structuralBlocks: { uninterpreted: number; figure: number; tableRow: number }
  linesOnlyComparison: boolean
  limitationNotes: string[]
}

export function analyzeInformationLoss(pages: PdfPage[], document: CanonicalDocument): LossAnalysis {
  const unlocated = findLostSourceText(pages, document)
  const pageLines = new Map<number, Set<string>>()
  for (const page of pages) pageLines.set(page.pageNumber, new Set(normalizeForComparison(page.text).split(nl)))

  const markdownLines = normalizeForComparison(document.markdown)
    .split(nl)
    .filter((line) => line.length > 0)
  const counts = new Map<string, number>()
  for (const line of markdownLines) counts.set(line, (counts.get(line) ?? 0) + 1)

  const affectedBlocks: string[] = []
  const affectedPages = new Set<number>()
  const possibleReordering: string[] = []
  let previousPage = 0
  for (const block of document.blocks) {
    if (block.page < previousPage) possibleReordering.push(block.blockId)
    previousPage = block.page
    if (block.kind === 'page-break') continue
    const lines = pageLines.get(block.page)
    if (lines === undefined) continue
    const source = normalizeForComparison(block.sourceText)
    if (source.length > 0 && !lines.has(source)) {
      affectedBlocks.push(block.blockId)
      affectedPages.add(block.page)
    }
  }

  const notes: string[] = [
    'La comparacion por lineas no demuestra preservacion semantica: solo ausencia de perdida literal detectable.',
    'Un fragmento puede estar presente y aun asi haberse reordenado o descontextualizado.',
    'Los bloques no interpretados conservan su texto, pero su estructura original no se valida.',
  ]
  notes.push(unlocated.length === 0
    ? 'findLostSourceText devuelve lista vacia: es condicion necesaria, no suficiente.'
    : 'Hay ' + String(unlocated.length) + ' linea(s) no localizadas: revisar antes de concluir nada.')

  return {
    preservedLines: markdownLines.length,
    unlocatedLines: unlocated,
    affectedPages: Array.from(affectedPages).sort((a, b) => a - b),
    affectedBlocks,
    possibleReordering,
    duplicatedLines: Array.from(counts.entries()).filter((entry) => entry[1] > 1).map((entry) => entry[0]),
    structuralBlocks: {
      uninterpreted: document.blocks.filter((block) => block.kind === 'uninterpreted').length,
      figure: document.blocks.filter((block) => block.kind === 'figure').length,
      tableRow: document.blocks.filter((block) => block.kind === 'table-row').length,
    },
    linesOnlyComparison: true,
    limitationNotes: notes,
  }
}

export type ReadingOrderStatus = 'verified' | 'uncertain' | 'problematic'

export type PageReadingOrderAssessment = {
  page: number
  status: ReadingOrderStatus
  reasons: string[]
  columnsDetected: number | null
  images: number
  tableCandidates: number
}

export function assessReadingOrder(page: RichPdfPage, segments: PdfTextSegment[]): PageReadingOrderAssessment {
  const reasons: string[] = []
  const columns = page.columns.detected
  const images = page.images.length
  const tables = page.tables.length
  if (!page.hasText) reasons.push('pagina sin texto')
  if (columns !== null && columns > 1) reasons.push('varias columnas detectadas por heuristica')
  if (images > 0) reasons.push('contiene imagenes cuya geometria no se interpreta')
  if (tables > 0) reasons.push('contiene candidatos a tabla')

  const ys = segments.map((segment) => segment.y).filter((value): value is number => value !== null)
  let backwards = 0
  for (let index = 1; index < ys.length; index += 1) {
    if (ys[index] > ys[index - 1] + 1) backwards += 1
  }
  if (backwards >= 2) reasons.push('las coordenadas Y retroceden: el orden del flujo no coincide con el visual')

  const status: ReadingOrderStatus = backwards >= 2 ? 'problematic' : reasons.length > 0 ? 'uncertain' : 'verified'
  if (status === 'verified') reasons.push('una columna, sin imagenes ni tablas y coordenadas Y monotonas')
  return { page: page.pageNumber, status, reasons, columnsDetected: columns, images, tableCandidates: tables }
}

export type HumanReviewRecord = {
  sourceDocumentId: string
  page: number
  sourceText: string
  expectedStructure: string | null
  expectedQuestionNumber: number | null
  expectedOptions: string[] | null
  expectedAnswer: string | null
  expectedPageStart: number | null
  expectedPageEnd: number | null
  reviewer: string | null
  reviewedAt: string | null
}

export function createHumanReviewRecords(input: { sourceDocumentId: string; pages: PdfPage[] }): HumanReviewRecord[] {
  const records: HumanReviewRecord[] = []
  for (const page of input.pages) {
    for (const rawLine of page.text.split(nl)) {
      const line = rawLine.trim()
      if (line.length === 0) continue
      records.push({
        sourceDocumentId: input.sourceDocumentId,
        page: page.pageNumber,
        sourceText: line,
        expectedStructure: null,
        expectedQuestionNumber: null,
        expectedOptions: null,
        expectedAnswer: null,
        expectedPageStart: null,
        expectedPageEnd: null,
        reviewer: null,
        reviewedAt: null,
      })
    }
  }
  return records
}

export function humanReviewIsEmpty(records: HumanReviewRecord[]): boolean {
  return records.every((record) =>
    record.expectedStructure === null &&
    record.expectedQuestionNumber === null &&
    record.expectedOptions === null &&
    record.expectedAnswer === null &&
    record.reviewer === null,
  )
}

export type QuarantineRecord = {
  questionNumber: number | null
  page: number
  sourceDocumentId: string
  markdownArtifactId: string
  originalText: string
  errorCodes: string[]
  confidence: number | null
  provenance: { documentId: string; documentVersionId: string; page: number; blockIds: string[] }
}

export function collectQuarantine(input: { run: ExtractionRun; document: CanonicalDocument }): QuarantineRecord[] {
  return input.run.questions
    .filter((question) => question.validationStatus !== 'accepted')
    .map((question) => ({
      questionNumber: question.questionNumber,
      page: question.page,
      sourceDocumentId: question.sourceDocumentId,
      markdownArtifactId: input.document.markdownArtifactId,
      originalText: question.rawText,
      errorCodes: question.validationErrors.map((error) => error.code),
      confidence: question.confidence,
      provenance: {
        documentId: question.sourceDocumentId,
        documentVersionId: question.documentVersionId,
        page: question.page,
        blockIds: input.document.blocks.filter((block) => block.page === question.page).map((block) => block.blockId),
      },
    }))
}

export type ValidationStage = { stage: string; ok: boolean; summary: string }

export type ValidationRun = {
  sourceKind: ValidationSourceKind
  snapshot: ValidationSnapshot
  rich: RichPdfDocument
  document: CanonicalDocument
  documentValidation: ReturnType<typeof validateCanonicalDocument>
  extraction: ExtractionRun
  metrics: DescriptiveMetrics
  loss: LossAnalysis
  readingOrder: PageReadingOrderAssessment[]
  quarantine: QuarantineRecord[]
  humanReview: HumanReviewRecord[]
  stages: ValidationStage[]
  warnings: string[]
}

export function documentIdForPdf(rich: RichPdfDocument): string {
  return 'pdfdoc_' + rich.sha256.slice(0, 20)
}

export async function runValidation(input: {
  adapter: RealPdfAdapter
  filePath: string
  sourceKind: ValidationSourceKind
  processedAt: string
  versions?: Partial<ValidationVersions>
  limits?: Partial<PdfLimits>
}): Promise<ValidationRun> {
  const stages: ValidationStage[] = []
  const warnings: string[] = []

  const rich = await input.adapter.inspect({ filePath: input.filePath, limits: input.limits })
  stages.push({ stage: 'adapter', ok: true, summary: String(rich.pageCount) + ' paginas leidas' })

  const pages = richDocumentToPages(rich)
  const documentId = documentIdForPdf(rich)
  const documentRef: SourceDocumentRef = {
    id: documentId,
    fileName: rich.fileName,
    title: rich.fileName,
    sizeBytes: rich.sizeBytes,
    sha256: rich.sha256,
    declaredPages: rich.pageCount,
    declaredOptionsPerQuestion: null,
  }
  const versionRef: DocumentVersionRef = { id: documentId + '-v1', documentId, versionLabel: 'v1', sha256: rich.sha256 }

  const built = buildCanonicalFromPages(pages, { document: documentRef, version: versionRef, createdAt: input.processedAt })
  stages.push({ stage: 'skill', ok: true, summary: String(built.document.blocks.length) + ' bloques' })

  const documentValidation = validateCanonicalDocument(built.document)
  stages.push({
    stage: 'document-validation',
    ok: documentValidation.ok,
    summary: String(documentValidation.errorCount) + ' errores y ' + String(documentValidation.warningCount) + ' avisos',
  })

  const extraction = await createTextLayerExtractionService().extract({
    document: documentRef,
    version: versionRef,
    source: createMarkdownTextSource(built.document),
  })
  stages.push({ stage: 'extraction', ok: true, summary: String(extraction.questions.length) + ' preguntas detectadas' })

  const metrics = computeDescriptiveMetrics({
    richPages: rich.pages,
    pages,
    document: built.document,
    anomalies: documentValidation.issues.length,
    run: extraction,
  })
  if (!metricNamesAreDescriptive(metrics)) warnings.push('Hay un nombre de metrica no descriptivo.')

  const loss = analyzeInformationLoss(pages, built.document)
  if (loss.unlocatedLines.length > 0) warnings.push('Lineas no localizadas: ' + String(loss.unlocatedLines.length))

  const readingOrder = rich.pages.map((page) => assessReadingOrder(page, page.textSegments))
  const problematic = readingOrder.filter((entry) => entry.status === 'problematic').length
  if (problematic > 0) warnings.push('Paginas con orden problematico: ' + String(problematic))

  const versions: ValidationVersions = { ...defaultVersions(rich.library.version), ...(input.versions ?? {}) }
  const snapshot = createValidationSnapshot({
    fileName: rich.fileName,
    sizeBytes: rich.sizeBytes,
    sha256: rich.sha256,
    pageCount: rich.pageCount,
    processedAt: input.processedAt,
    sourceKind: input.sourceKind,
    versions,
  })
  if (input.sourceKind !== 'real-pdf') {
    warnings.push('Dry-run: la fuente no es un PDF real autorizado, no constituye validacion real.')
  }

  return {
    sourceKind: input.sourceKind,
    snapshot,
    rich,
    document: built.document,
    documentValidation,
    extraction,
    metrics,
    loss,
    readingOrder,
    quarantine: collectQuarantine({ run: extraction, document: built.document }),
    humanReview: createHumanReviewRecords({ sourceDocumentId: documentId, pages }),
    stages,
    warnings,
  }
}

export function describeValidationRun(run: ValidationRun): string {
  return [
    run.snapshot.fileName,
    'fuente ' + run.sourceKind,
    String(run.metrics.pagesProcessed) + ' paginas',
    String(run.metrics.questionsDetected) + ' preguntas',
    'pdfjs ' + run.snapshot.versions.pdfjs,
    'skill ' + run.snapshot.versions.documentSkill,
  ].join(comma)
}

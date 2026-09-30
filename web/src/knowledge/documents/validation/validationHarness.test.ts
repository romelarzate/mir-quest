import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPdfjsAdapter } from '../pdf/pdfjsAdapter'
import type { RichPdfPage } from '../pdf/types'
import { buildCanonicalFromPages } from '../fromSource'
import { createTextLayerExtractionService } from '../../extraction/pdfExtractionService'
import type { PdfPage } from '../../extraction/types'
import {
  analyzeInformationLoss,
  assessReadingOrder,
  collectQuarantine,
  createHumanReviewRecords,
  createValidationSnapshot,
  defaultVersions,
  describeValidationRun,
  humanReviewIsEmpty,
  metricNamesAreDescriptive,
  runValidation,
  snapshotContentHash,
  validationRules,
  forbiddenMetricNames,
} from './harness'
import type { DescriptiveMetrics } from './harness'

const fixtureDir = join(process.cwd(), 'src', 'knowledge', 'documents', 'pdf', '__fixtures__')
const docsDir = join(process.cwd(), '..', 'docs')
const processedAt = '2026-09-30T00:00:00.000Z'

const versions = defaultVersions('6.3.289')

describe('snapshot de validacion', () => {
  it('el hash de contenido ignora nombre y fecha de procesamiento', () => {
    const base = { sizeBytes: 1000, sha256: 'a'.repeat(64), pageCount: 3, sourceKind: 'real-pdf' as const, versions }
    const first = createValidationSnapshot({ ...base, fileName: 'a.pdf', processedAt: '2026-01-01T00:00:00.000Z' })
    const second = createValidationSnapshot({ ...base, fileName: 'b.pdf', processedAt: '2027-06-06T06:06:06.000Z' })
    expect(first.contentHash).toBe(second.contentHash)
    expect(first.processedAt).not.toBe(second.processedAt)
    expect(snapshotContentHash(base)).toBe(first.contentHash)
  })

  it('registra las cuatro versiones y el tipo de fuente', () => {
    const snapshot = createValidationSnapshot({
      fileName: 'x.pdf',
      sizeBytes: 10,
      sha256: 'b'.repeat(64),
      pageCount: 1,
      processedAt,
      sourceKind: 'synthetic-fixture',
      versions,
    })
    expect(snapshot.versions.pdfjs).toBe('6.3.289')
    expect(snapshot.versions.extractor).toBe('text-layer-extractor-v1')
    expect(snapshot.versions.normalizer.length).toBeGreaterThan(0)
    expect(snapshot.versions.documentSkill.length).toBeGreaterThan(0)
    expect(snapshot.sourceKind).toBe('synthetic-fixture')
    expect(validationRules.length).toBe(7)
  })
})

describe('metricas descriptivas', () => {
  it('ningun nombre admite precision, accuracy, recall ni F1', () => {
    const metrics = {
      pagesProcessed: 2, emptyPages: 0, markdownBlocks: 5, sourceCharacters: 100, markdownCharacters: 120,
      questionsDetected: 1, questionsAccepted: 1, questionsQuarantined: 0, questionsRejected: 0,
      documentAnomalies: 0, multiColumnPages: 0, pagesWithImages: 0, tableCandidates: 0,
    }
    expect(metricNamesAreDescriptive(metrics)).toBe(true)
    const bad = { ...metrics, extractionPrecision: 1 } as unknown as DescriptiveMetrics
    expect(metricNamesAreDescriptive(bad)).toBe(false)
    expect(forbiddenMetricNames).toContain('recall')
    expect(forbiddenMetricNames).toContain('f1')
  })
})

describe('analisis de perdida', () => {
  it('detecta duplicados y reordenamientos sin afirmar preservacion semantica', () => {
    const pages: PdfPage[] = [{ pageNumber: 1, text: 'uno' + String.fromCharCode(10) + 'dos', width: 1, height: 1, declaredColumns: 1, columnTexts: null, hasImages: false }]
    const built = buildCanonicalFromPages(pages, {
      document: { id: 'd', fileName: 'd.pdf', title: 'd', sizeBytes: 1, sha256: 'c'.repeat(64), declaredPages: 1, declaredOptionsPerQuestion: 4 },
      version: { id: 'v', documentId: 'd', versionLabel: 'v1', sha256: 'c'.repeat(64) },
      createdAt: processedAt,
    })
    const loss = analyzeInformationLoss(pages, built.document)
    expect(loss.linesOnlyComparison).toBe(true)
    expect(loss.limitationNotes.length).toBeGreaterThanOrEqual(4)
    expect(loss.limitationNotes.some((note) => note.indexOf('no suficiente') !== -1)).toBe(true)
    expect(loss.limitationNotes.some((note) => note.indexOf('semantica') !== -1)).toBe(true)
    expect(loss.structuralBlocks.uninterpreted).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(loss.affectedBlocks)).toBe(true)
    expect(Array.isArray(loss.possibleReordering)).toBe(true)
    expect(Array.isArray(loss.duplicatedLines)).toBe(true)
  })

  it('detecta reordenamiento cuando un bloque retrocede de pagina', () => {
    const pages: PdfPage[] = [
      { pageNumber: 1, text: 'primera', width: 1, height: 1, declaredColumns: 1, columnTexts: null, hasImages: false },
      { pageNumber: 2, text: 'segunda', width: 1, height: 1, declaredColumns: 1, columnTexts: null, hasImages: false },
    ]
    const built = buildCanonicalFromPages(pages, {
      document: { id: 'd2', fileName: 'd2.pdf', title: 'd2', sizeBytes: 1, sha256: 'd'.repeat(64), declaredPages: 2, declaredOptionsPerQuestion: 4 },
      version: { id: 'v2', documentId: 'd2', versionLabel: 'v1', sha256: 'd'.repeat(64) },
      createdAt: processedAt,
    })
    const reordered = { ...built.document, blocks: [built.document.blocks[1], built.document.blocks[0], ...built.document.blocks.slice(2)] }
    const loss = analyzeInformationLoss(pages, reordered)
    expect(loss.possibleReordering.length).toBeGreaterThan(0)
  })
})

describe('orden de lectura', () => {
  function richPage(overrides: Partial<RichPdfPage>): RichPdfPage {
    return {
      pageNumber: 1, width: 595, height: 842, text: 'x', textSegments: [], images: [], tables: [],
      columns: { detected: 1, method: 'x-cluster', confidence: null, note: '' },
      readingOrder: { order: 'content-stream', confidence: null, note: '' },
      sourceOffsetsAvailable: false, hasText: true,
      ...overrides,
    }
  }

  it('clasifica pagina de una columna como verificada', () => {
    const assessment = assessReadingOrder(richPage({}), [
      { segmentId: 's1', pageNumber: 1, text: 'a', x: 50, y: 700, width: 10, height: 10, hasEol: false },
      { segmentId: 's2', pageNumber: 1, text: 'b', x: 50, y: 680, width: 10, height: 10, hasEol: false },
    ])
    expect(assessment.status).toBe('verified')
  })

  it('marca incertidumbre con columnas, imagenes o tablas', () => {
    const columns = assessReadingOrder(richPage({ columns: { detected: 2, method: 'x-cluster', confidence: null, note: '' } }), [])
    expect(columns.status).toBe('uncertain')
    expect(columns.reasons.some((reason) => reason.indexOf('columnas') !== -1)).toBe(true)
    const images = assessReadingOrder(richPage({ images: [{ imageId: 'i1', page: 1, boundingBox: null, confidence: null, source: 'operator-list', note: '' }] }), [])
    expect(images.status).toBe('uncertain')
    const tables = assessReadingOrder(richPage({ tables: [{ candidateId: 't1', page: 1, boundingBox: null, rowCount: 2, columnCount: 3, confidence: null, text: [], note: '' }] }), [])
    expect(tables.status).toBe('uncertain')
  })

  it('marca problematico cuando las coordenadas Y retroceden', () => {
    const assessment = assessReadingOrder(richPage({}), [
      { segmentId: 's1', pageNumber: 1, text: 'a', x: 50, y: 700, width: 10, height: 10, hasEol: false },
      { segmentId: 's2', pageNumber: 1, text: 'b', x: 320, y: 720, width: 10, height: 10, hasEol: false },
      { segmentId: 's3', pageNumber: 1, text: 'c', x: 50, y: 690, width: 10, height: 10, hasEol: false },
      { segmentId: 's4', pageNumber: 1, text: 'd', x: 320, y: 700, width: 10, height: 10, hasEol: false },
    ])
    expect(assessment.status).toBe('problematic')
    expect(assessment.reasons.some((reason) => reason.indexOf('retroceden') !== -1)).toBe(true)
  })
})

describe('ground truth humano', () => {
  it('la plantilla nace vacia y separada del resultado automatico', () => {
    const pages: PdfPage[] = [{ pageNumber: 1, text: 'linea uno' + String.fromCharCode(10) + 'linea dos', width: 1, height: 1, declaredColumns: 1, columnTexts: null, hasImages: false }]
    const records = createHumanReviewRecords({ sourceDocumentId: 'doc-x', pages })
    expect(records.length).toBe(2)
    expect(records[0].sourceText).toBe('linea uno')
    expect(records[0].expectedStructure).toBeNull()
    expect(records[0].expectedQuestionNumber).toBeNull()
    expect(records[0].expectedOptions).toBeNull()
    expect(records[0].expectedAnswer).toBeNull()
    expect(records[0].reviewer).toBeNull()
    expect(records[0].reviewedAt).toBeNull()
    expect(humanReviewIsEmpty(records)).toBe(true)
  })
})

describe('cuarentena', () => {
  it('conserva texto, pagina, error, confianza y provenance', async () => {
    const pages: PdfPage[] = [{ pageNumber: 1, text: 'texto suelto sin numero de pregunta', width: 1, height: 1, declaredColumns: 1, columnTexts: null, hasImages: false }]
    const built = buildCanonicalFromPages(pages, {
      document: { id: 'doc-q', fileName: 'q.pdf', title: 'q', sizeBytes: 1, sha256: 'e'.repeat(64), declaredPages: 1, declaredOptionsPerQuestion: 4 },
      version: { id: 'vq', documentId: 'doc-q', versionLabel: 'v1', sha256: 'e'.repeat(64) },
      createdAt: processedAt,
    })
    const run = await createTextLayerExtractionService().extract({
      document: { id: 'doc-q', fileName: 'q.pdf', title: 'q', sizeBytes: 1, sha256: 'e'.repeat(64), declaredPages: 1, declaredOptionsPerQuestion: 4 },
      version: { id: 'vq', documentId: 'doc-q', versionLabel: 'v1', sha256: 'e'.repeat(64) },
      source: { id: 's', label: 's', status: 'synthetic', loadPages: async () => pages },
    })
    const records = collectQuarantine({ run, document: built.document })
    expect(records.length).toBeGreaterThan(0)
    expect(records[0].originalText.length).toBeGreaterThan(0)
    expect(records[0].markdownArtifactId).toBe(built.document.markdownArtifactId)
    expect(records[0].errorCodes.length).toBeGreaterThan(0)
    expect(records[0].provenance.page).toBe(records[0].page)
    expect(records[0].provenance.blockIds.length).toBeGreaterThan(0)
  })
})

describe('dry-run del arnes (no es validacion de PDF real)', () => {
  it('ejecuta el pipeline completo sobre un fixture sintetico y lo marca como tal', async () => {
    const adapter = createPdfjsAdapter()
    const run = await runValidation({
      adapter,
      filePath: join(fixtureDir, 'multi-page.pdf'),
      sourceKind: 'synthetic-fixture',
      processedAt,
    })
    expect(run.sourceKind).toBe('synthetic-fixture')
    expect(run.stages.length).toBe(4)
    expect(run.stages.map((stage) => stage.stage)).toEqual(['adapter', 'skill', 'document-validation', 'extraction'])
    expect(run.metrics.pagesProcessed).toBe(3)
    expect(run.metrics.sourceCharacters).toBeGreaterThan(50)
    expect(run.metrics.questionsDetected).toBeGreaterThanOrEqual(1)
    expect(metricNamesAreDescriptive(run.metrics)).toBe(true)
    expect(run.warnings.some((warning) => warning.indexOf('Dry-run') !== -1)).toBe(true)
    expect(run.snapshot.sourceKind).toBe('synthetic-fixture')
    expect(run.snapshot.pageCount).toBe(3)
    expect(run.snapshot.sha256.length).toBe(64)
    expect(run.humanReview.length).toBeGreaterThan(0)
    expect(humanReviewIsEmpty(run.humanReview)).toBe(true)
    expect(describeValidationRun(run)).toContain('multi-page.pdf')
    expect(run.readingOrder.length).toBe(3)

    mkdirSync(docsDir, { recursive: true })
    writeFileSync(
      join(docsDir, 'real-pdf-validation-dry-run.json'),
      JSON.stringify({
        label: 'DRY-RUN del arnes sobre fixture sintetico: NO es validacion de un PDF real',
        sourceKind: run.sourceKind,
        snapshot: run.snapshot,
        metrics: run.metrics,
        loss: run.loss,
        readingOrder: run.readingOrder,
        quarantineCount: run.quarantine.length,
        humanReviewRecords: run.humanReview.length,
        stages: run.stages,
        warnings: run.warnings,
      }, null, 2),
      'utf8',
    )
  })
})

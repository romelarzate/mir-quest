import { detectOptionLabel, newline, parsePage, type ParsedSegment } from './textExtractor'
import {
  buildExtractionQuality,
  computeAnswerKeyConfidence,
  computeBoundaryConfidence,
  computeLayoutConfidence,
  computeOptionCompleteness,
  computeTextCompleteness,
} from './quality'
import { decideStatus, pageLevelErrors, validateQuestion } from './validators'
import type { QuestionValidationInput } from './validators'
import { normalizedTextHash } from '../ids'
import type {
  ExtractedQuestion,
  ExtractionValidationError,
  PdfExtractionService,
  PdfPage,
  PdfTextSource,
} from './types'

export const syntheticSourceNote =
  'Fuente sintética: el texto procede de fixtures escritos a mano, no de un PDF real.'

export const pdfSourceStubNote =
  'Adaptador de PDF no implementado: esta fase no instala ninguna librería de PDF ni procesa binarios reales.'

export function createSyntheticTextSource(pages: PdfPage[], id = 'synthetic-text-source'): PdfTextSource {
  return {
    id,
    label: 'Fuente de texto sintética (fixtures)',
    status: 'synthetic',
    loadPages: async () => pages.map((page) => ({ ...page })),
  }
}

export function createPdfTextSourceStub(): PdfTextSource {
  return {
    id: 'pdf-text-source-stub',
    label: 'Adaptador de PDF (no implementado)',
    status: 'not-implemented',
    loadPages: async () => {
      throw new Error(pdfSourceStubNote)
    },
  }
}

export function createPdfExtractionServiceStub(): PdfExtractionService {
  return {
    id: 'pdf-extraction-stub',
    label: 'Extracción binaria de PDF (no implementada)',
    status: 'not-implemented',
    extract: async () => {
      throw new Error(pdfSourceStubNote)
    },
  }
}

type FlatSegment = { segment: ParsedSegment; page: number; pageEnd: number }

function maxOptionLabel(options: ParsedSegment['options']): string {
  let max = ''
  for (const option of options) {
    const label = option.label.toUpperCase()
    if (label > max) max = label
  }
  return max
}

function firstMeaningfulLine(text: string): string {
  const lines = text.split(newline).map((line) => line.trim()).filter((line) => line.length > 0)
  return lines.length > 0 ? lines[0] : ''
}

/**
 * Solo se une texto sin marcador de la pagina siguiente cuando la pregunta
 * anterior NO estaba cerrada por una respuesta y la nueva pagina empieza con
 * una opcion que continua el alfabeto. Cualquier otro texto suelto es un
 * bloque aparte, que ira a cuarentena por falta de numero.
 */
function isContinuation(previous: FlatSegment | undefined, item: FlatSegment): boolean {
  if (item.segment.hasMarker) return false
  if (previous === undefined) return false
  if (previous.page === item.page) return false
  if (previous.segment.detectedAnswer !== null) return false
  const label = detectOptionLabel(firstMeaningfulLine(item.segment.rawText))
  if (label === null) return false
  const previousMax = maxOptionLabel(previous.segment.options)
  if (previousMax.length === 0) return false
  return label > previousMax
}

function mergeSegmentsAcrossPages(flat: FlatSegment[]): FlatSegment[] {
  const merged: FlatSegment[] = []
  for (const item of flat) {
    const previous = merged[merged.length - 1]
    const continues = isContinuation(previous, item)
    if (continues && item.segment.rawText.trim().length > 0) {
      const combined = previous.segment.rawText + newline + item.segment.rawText
      const reparsed = parsePage({
        pageNumber: previous.page,
        text: combined,
        width: null,
        height: null,
        declaredColumns: null,
        columnTexts: null,
        hasImages: item.segment.imageDependent,
      })
      const replacement = reparsed[reparsed.length - 1] ?? previous.segment
      merged[merged.length - 1] = { segment: replacement, page: previous.page, pageEnd: item.page }
      continue
    }
    merged.push(item)
  }
  return merged
}

function buildQuality(input: {
  segment: ParsedSegment,
  page: PdfPage,
  declaredOptionsPerQuestion: number | null,
  splitAcrossPages: boolean,
}): ReturnType<typeof buildExtractionQuality> {
  const hasGeometry = input.page.width !== null && input.page.height !== null
  const notes: string[] = []
  if (!hasGeometry) notes.push('La página no declara geometría.')
  if (input.page.declaredColumns !== null && input.page.declaredColumns > 1) {
    notes.push('La página declara ' + String(input.page.declaredColumns) + ' columnas.')
  }
  return buildExtractionQuality({
    textCompleteness: computeTextCompleteness(input.segment.rawText),
    questionBoundaryConfidence: computeBoundaryConfidence({
      hasMarker: input.segment.hasMarker,
      splitAcrossPages: input.splitAcrossPages,
      endsCleanly: input.segment.endsCleanly,
      mixedMarkers: input.segment.mixedMarkers,
    }),
    optionCompleteness: computeOptionCompleteness({
      options: input.segment.options,
      declaredOptionsPerQuestion: input.declaredOptionsPerQuestion,
    }),
    answerKeyConfidence: computeAnswerKeyConfidence(input.segment.answerKind),
    layoutConfidence: computeLayoutConfidence({
      hasGeometry,
      hasText: input.segment.rawText.trim().length > 0,
      declaredColumns: input.page.declaredColumns,
      interleavedOptions: input.segment.interleavedOptions,
      hasTableMarkers: input.segment.hasTableMarkers,
      imageDependent: input.segment.imageDependent,
    }),
    notes,
  })
}

export function createTextLayerExtractionService(): PdfExtractionService {
  return {
    id: 'text-layer-extractor-v1',
    label: 'Extractor por capa de texto (v1)',
    status: 'implemented',
    extract: async ({ document, version, source }) => {
      const startedAt = new Date().toISOString()
      const pages = await source.loadPages(document, version)
      const flat: FlatSegment[] = []
      const pageErrors: ExtractionValidationError[] = []
      const pagesWithQuestions: number[] = []

      for (const page of pages) {
        const segments = parsePage(page)
        const questionsOnPage = segments.filter((segment) => segment.hasMarker || segment.rawText.trim().length > 0).length
        pageErrors.push(
          ...pageLevelErrors({
            page: page.pageNumber,
            questionsOnPage,
            declaredColumns: page.declaredColumns,
            providedColumnTexts: page.columnTexts ? page.columnTexts.length : 0,
            declaredPages: document.declaredPages,
          }),
        )
        if (questionsOnPage > 0) pagesWithQuestions.push(page.pageNumber)
        for (const segment of segments) flat.push({ segment, page: page.pageNumber, pageEnd: page.pageNumber })
      }

      const merged = mergeSegmentsAcrossPages(flat)
      const pageById = new Map(pages.map((page) => [page.pageNumber, page]))
      const questions: ExtractedQuestion[] = []
      const textHashCounts = new Map<string, number>()
      let previousNumber: number | null = null

      for (const item of merged) {
        const segment = item.segment
        const page = pageById.get(item.page)
        const splitAcrossPages =
          segment.rawText.split(newline).length > 1 &&
          pages.some((candidate) => candidate.pageNumber !== item.page && segment.rawText.indexOf(candidate.text.slice(0, 20)) !== -1 && candidate.text.length > 20)
        const quality = buildQuality({
          segment,
          page: page ?? { pageNumber: item.page, text: '', width: null, height: null, declaredColumns: null, columnTexts: null, hasImages: false },
          declaredOptionsPerQuestion: document.declaredOptionsPerQuestion,
          splitAcrossPages,
        })

        const validationInput: QuestionValidationInput = {
          page: item.page,
          rawText: segment.rawText,
          questionNumber: segment.questionNumber,
          options: segment.options,
          detectedAnswer: segment.detectedAnswer,
          previousNumber,
          mixedMarkers: segment.mixedMarkers,
          splitAcrossPages,
          endsCleanly: segment.endsCleanly,
          interleavedOptions: segment.interleavedOptions,
          hasTableMarkers: segment.hasTableMarkers,
          imageDependent: segment.imageDependent,
          anomalousCharacterRatio: segment.anomalousCharacterRatio,
        }

        const errors = validateQuestion(validationInput)
        const status = decideStatus(errors, {
          rawText: segment.rawText,
          anomalousCharacterRatio: segment.anomalousCharacterRatio,
        })

        const hash = normalizedTextHash(segment.rawText)
        const seen = textHashCounts.get(hash) ?? 0
        textHashCounts.set(hash, seen + 1)

        questions.push({
          sourceDocumentId: document.id,
          documentVersionId: version.id,
          page: item.page,
          pageEnd: item.pageEnd,
          rawText: segment.rawText,
          questionNumber: segment.questionNumber,
          originalQuestionNumber: segment.questionNumber,
          options: segment.options,
          detectedAnswer: segment.detectedAnswer,
          declaredOptionsPerQuestion: document.declaredOptionsPerQuestion,
          confidence: quality.overallConfidence,
          quality,
          validationStatus: status,
          validationErrors: errors,
          duplicateCandidate: seen > 0,
          splitAcrossPages,
          anomalousCharacterRatio: segment.anomalousCharacterRatio,
        })

        if (segment.questionNumber !== null) previousNumber = segment.questionNumber
      }

      return {
        document,
        version,
        sourceId: source.id,
        pages: pages.length,
        pagesWithQuestions,
        questions,
        pageErrors,
        startedAt,
        finishedAt: new Date().toISOString(),
      }
    },
  }
}

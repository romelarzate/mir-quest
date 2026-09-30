import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { createHash } from 'node:crypto'
import { PdfAdapterFailure, createPdfError } from './errors'
import type {
  PdfColumnInfo,
  PdfImageCandidate,
  PdfLibraryInfo,
  PdfLimits,
  PdfReadingOrder,
  PdfTableCandidate,
  PdfTextSegment,
  RealPdfAdapter,
  RichPdfPage,
} from './types'
import { defaultPdfLimits } from './types'

export const pdfLibrary: PdfLibraryInfo = {
  name: 'pdfjs-dist',
  version: '6.3.289',
  license: 'Apache-2.0',
  entry: 'pdfjs-dist/legacy/build/pdf.mjs',
}

type PdfjsTextItem = { str?: string; width?: number; height?: number; transform?: number[]; hasEOL?: boolean }
type PdfjsPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number }
  getTextContent: () => Promise<{ items: PdfjsTextItem[] }>
  getOperatorList: () => Promise<{ fnArray: number[] }>
}
type PdfjsDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfjsPage>
  cleanup?: () => void
}
type PdfjsModule = {
  version: string
  OPS: { paintImageXObject: number; paintJpegXObject?: number }
  getDocument: (params: Record<string, unknown>) => { promise: Promise<PdfjsDocument> }
}

export async function loadPdfjs(): Promise<{ module: PdfjsModule; entry: string }> {
  const candidates = ['pdfjs-dist/legacy/build/pdf.mjs', 'pdfjs-dist/build/pdf.mjs']
  for (const entry of candidates) {
    try {
      const loaded = (await import(entry)) as unknown as PdfjsModule
      if (typeof loaded.getDocument === 'function') return { module: loaded, entry }
    } catch {
      continue
    }
  }
  throw new PdfAdapterFailure('library-unavailable', 'No se pudo cargar pdfjs-dist.')
}

function clusterAxis(values: number[], tolerance: number): number[] {
  const sorted = values.slice().sort((a, b) => a - b)
  const clusters: number[] = []
  for (const value of sorted) {
    const last = clusters[clusters.length - 1]
    if (last === undefined || Math.abs(value - last) > tolerance) clusters.push(value)
  }
  return clusters
}

/** Columnas: heuristica por agrupacion de coordenadas X. Confianza null. */
export function detectColumns(segments: PdfTextSegment[]): PdfColumnInfo {
  const xs = segments.map((segment) => segment.x).filter((value): value is number => value !== null)
  if (xs.length === 0) {
    return { detected: null, method: null, confidence: null, note: 'Sin coordenadas: no se puede determinar el numero de columnas.' }
  }
  const clusters = clusterAxis(xs, 40)
  const counts = clusters.map((start) => xs.filter((value) => Math.abs(value - start) <= 40).length)
  const relevant = counts.filter((count) => count >= 2).length
  if (relevant <= 1) {
    return { detected: 1, method: 'x-cluster', confidence: null, note: 'Agrupacion X compatible con una sola columna.' }
  }
  return {
    detected: relevant,
    method: 'x-cluster',
    confidence: null,
    note: 'Agrupacion X compatible con ' + String(relevant) + ' columnas; el orden de lectura no esta verificado.',
  }
}

/** Orden de lectura: pdfjs entrega el orden del flujo de contenido, no el visual. */
export function readingOrderFor(columns: PdfColumnInfo): PdfReadingOrder {
  if (columns.detected !== null && columns.detected > 1) {
    return {
      order: 'content-stream',
      confidence: null,
      note: 'Varias columnas detectadas: el orden del flujo puede no coincidir con el orden visual.',
    }
  }
  return {
    order: 'content-stream',
    confidence: null,
    note: 'Se conserva el orden del flujo de contenido; no se asume equivalencia con el orden visual.',
  }
}

/** Candidatos a tabla: solo se declaran, nunca se convierten ni se destruyen. */
export function detectTableCandidates(segments: PdfTextSegment[], page: number): PdfTableCandidate[] {
  const pipeRows = segments.filter((segment) => (segment.text.split('|').length - 1) >= 2)
  if (pipeRows.length >= 2) {
    return [{
      candidateId: 'table-' + String(page) + '-pipes',
      page,
      boundingBox: null,
      rowCount: pipeRows.length,
      columnCount: pipeRows[0].text.split('|').length - 2,
      confidence: null,
      text: pipeRows.map((segment) => segment.text),
      note: 'Filas con separadores verticales: candidato a tabla, no confirmado.',
    }]
  }
  const xs = segments.map((segment) => segment.x).filter((value): value is number => value !== null)
  const clusters = clusterAxis(xs, 30)
  if (clusters.length >= 3 && segments.length >= clusters.length * 2) {
    return [{
      candidateId: 'table-' + String(page) + '-grid',
      page,
      boundingBox: null,
      rowCount: null,
      columnCount: clusters.length,
      confidence: null,
      text: segments.map((segment) => segment.text),
      note: 'Varias alineaciones X repetidas: posible tabla, no confirmada.',
    }]
  }
  return []
}

function segmentFromItem(item: PdfjsTextItem, page: number, index: number): PdfTextSegment | null {
  const text = typeof item.str === 'string' ? item.str : ''
  if (text.trim().length === 0) return null
  const transform = Array.isArray(item.transform) ? item.transform : null
  return {
    segmentId: 'seg-p' + String(page) + '-' + String(index),
    pageNumber: page,
    text,
    x: transform !== null && typeof transform[4] === 'number' ? transform[4] : null,
    y: transform !== null && typeof transform[5] === 'number' ? transform[5] : null,
    width: typeof item.width === 'number' ? item.width : null,
    height: typeof item.height === 'number' ? item.height : null,
    hasEol: item.hasEOL === true,
  }
}

export function createPdfjsAdapter(): RealPdfAdapter {
  return {
    id: 'real-pdf-adapter-pdfjs',
    label: 'Adaptador real de PDF (pdfjs-dist)',
    status: 'ready',
    library: pdfLibrary,
    inspect: async (input) => {
      const limits: PdfLimits = { ...defaultPdfLimits, ...(input.limits ?? {}) }
      const filePath = input.filePath

      let sizeBytes = 0
      try {
        const stats = statSync(filePath)
        if (!stats.isFile()) throw new PdfAdapterFailure('file-not-found', 'No es un archivo regular.')
        sizeBytes = stats.size
      } catch (error) {
        if (error instanceof PdfAdapterFailure) throw error
        throw new PdfAdapterFailure('file-not-found', filePath)
      }
      if (sizeBytes > limits.maxBytes) {
        throw new PdfAdapterFailure('too-large', String(sizeBytes) + ' bytes > ' + String(limits.maxBytes))
      }

      const buffer = readFileSync(filePath)
      const header = buffer.subarray(0, 5).toString('latin1')
      if (header !== '%PDF-') throw new PdfAdapterFailure('not-a-pdf', header.replace(/[^ -~]/g, '?'))

      const sha256 = createHash('sha256').update(buffer).digest('hex')
      const { module, entry } = await loadPdfjs()
      const data = new Uint8Array(buffer)
      const warnings: string[] = []

      let document: PdfjsDocument
      try {
        document = await module.getDocument({
          data,
          useSystemFonts: false,
          isEvalSupported: false,
          disableFontFace: true,
        }).promise
      } catch (error) {
        const mapped = errorFromUnknownMapped(error)
        throw new PdfAdapterFailure(mapped.code)
      }

      if (document.numPages === 0) throw new PdfAdapterFailure('empty-document')
      if (document.numPages > limits.maxPages) {
        throw new PdfAdapterFailure('too-large', String(document.numPages) + ' paginas > ' + String(limits.maxPages))
      }

      const pages: RichPdfPage[] = []
      const paintImage = module.OPS.paintImageXObject
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        const items = Array.isArray(content.items) ? content.items : []
        const segments: PdfTextSegment[] = []
        items.forEach((item, index) => {
          const segment = segmentFromItem(item, pageNumber, index)
          if (segment !== null) segments.push(segment)
        })

        let imageOps = 0
        try {
          const operators = await page.getOperatorList()
          imageOps = operators.fnArray.filter((fn) => fn === paintImage).length
        } catch {
          warnings.push('No se pudo leer la lista de operadores de la pagina ' + String(pageNumber) + '.')
        }

        const images: PdfImageCandidate[] = []
        for (let index = 0; index < imageOps; index += 1) {
          images.push({
            imageId: 'img-p' + String(pageNumber) + '-' + String(index),
            page: pageNumber,
            boundingBox: null,
            confidence: null,
            source: 'operator-list',
            note: 'La libreria confirma que hay una imagen; su geometria no se interpreta en esta fase.',
          })
        }

        const columns = detectColumns(segments)
        pages.push({
          pageNumber,
          width: typeof viewport.width === 'number' ? Math.round(viewport.width * 100) / 100 : null,
          height: typeof viewport.height === 'number' ? Math.round(viewport.height * 100) / 100 : null,
          text: segments.map((segment) => segment.text).join(String.fromCharCode(10)),
          textSegments: segments,
          images,
          tables: detectTableCandidates(segments, pageNumber),
          columns,
          readingOrder: readingOrderFor(columns),
          sourceOffsetsAvailable: false,
          hasText: segments.length > 0,
        })
      }

      if (document.cleanup) document.cleanup()
      if (pages.every((page) => !page.hasText)) warnings.push('Ninguna pagina contiene texto extraible.')

      return {
        filePath,
        fileName: basename(filePath),
        sizeBytes,
        sha256,
        pageCount: document.numPages,
        pages,
        library: { ...pdfLibrary, entry },
        encrypted: false,
        warnings,
      }
    },
  }
}

function errorFromUnknownMapped(error: unknown): { code: import('./types').PdfAdapterErrorCode } {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : ''
  if (name === 'PasswordException') return { code: 'encrypted-pdf' }
  if (name === 'InvalidPDFException') return { code: 'corrupted-pdf' }
  if (name === 'MissingPDFException') return { code: 'file-not-found' }
  return { code: 'corrupted-pdf' }
}

export const pdfAdapterProbe = { createPdfError }

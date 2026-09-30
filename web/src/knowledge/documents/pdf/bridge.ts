import type { DocumentVersionRef, PdfPage, PdfTextSource, SourceDocumentRef } from '../../extraction/types'
import type { PdfTextSegment, RichPdfDocument, RichPdfPage } from './types'

export const pdfSourceId = 'real-pdf-text-source'

export const bridgeRules: string[] = [
  'El adaptador no reinterpreta el texto: conserva los segmentos con su geometria.',
  'Cuando se detectan varias columnas, el orden NO se asume: se declara y se deja en null el texto por columna.',
  'Los offsets de origen solo existen si la libreria los entrega; hoy no los entrega.',
  'Las imagenes se declaran como presencia, sin interpretar su contenido.',
]

export const lineToleranceRatio = 0.4
export const lineToleranceMin = 1.5
export const lineToleranceMax = 4
export const spaceGapRatio = 0.15
export const spaceGapMin = 0.75
export const columnGutterHeightRatio = 2.5
export const columnGutterMin = 20
export const minimumGutterRows = 3

export const lineReconstructionRules: string[] = [
  'Dos segmentos pertenecen a la misma linea visual si su Y difiere como maximo en una tolerancia.',
  'Tolerancia = altura de la linea x 0.4, acotada entre 1.5 y 4 puntos (documentada y cubierta por tests).',
  'Las lineas se ordenan de arriba abajo (Y descendente en coordenadas PDF) y cada linea de izquierda a derecha (X ascendente).',
  'Se inserta un espacio si la separacion supera el maximo entre 0.75 y la altura x 0.15; si no, se unen sin espacio.',
  'Un segmento sin geometria forma su propia linea: nunca se fusiona a ciegas.',
  'hasEol no se usa como frontera de linea: pdfjs lo deriva del flujo de contenido, no del fin de linea visual.',
  'Las columnas se separan solo si al menos 3 lineas visuales comparten un mismo gutter geometrico de al menos maximo(20 puntos, altura x 2.5); se serializan en orden de lectura por columna.',
  'Los segmentos centrados en el gutter o que comienzan a menos de una altura del gutter y lo cruzan con ancho de al menos 10 alturas se conservan como lineas independientes antes de las columnas para evitar intercalacion.',
  'Si no hay informacion posicional (todos en el mismo punto o sin Y) se conserva el orden de flujo, sin inventar lineas.',
]

function medianHeight(segments: PdfTextSegment[]): number {
  const heights = segments
    .map((segment) => segment.height)
    .filter((value): value is number => value !== null && value > 0)
    .sort((a, b) => a - b)
  if (heights.length === 0) return 10
  return heights[Math.floor(heights.length / 2)]
}

function toleranceFor(lineHeight: number): number {
  return Math.min(lineToleranceMax, Math.max(lineToleranceMin, lineHeight * lineToleranceRatio))
}

function needsSpace(previous: PdfTextSegment, current: PdfTextSegment, lineHeight: number): boolean {
  if (previous.x === null || current.x === null) return true
  const threshold = Math.max(spaceGapMin, lineHeight * spaceGapRatio)
  if (previous.width !== null) return current.x - (previous.x + previous.width) > threshold
  return current.x - previous.x > threshold
}

function hasUsableGeometry(segments: PdfTextSegment[]): boolean {
  const ys = new Set(segments.filter((segment) => segment.y !== null).map((segment) => segment.y))
  const xs = new Set(segments.filter((segment) => segment.x !== null).map((segment) => segment.x))
  if (ys.size === 0) return false
  if (ys.size === 1 && xs.size <= 1) return false
  return true
}

/**
 * Si la geometria no es utilizable (menos de dos valores Y distintos) no se
 * inventan lineas: se conserva el orden de flujo y cada segmento es su linea.
 * Es el comportamiento anterior, y evita fundir en una sola linea documentos
 * cuya capa de texto llega sin posiciones.
 */
export const degenerateGeometryRule =
  'Si todos los segmentos comparten el mismo punto (un solo X y un solo Y, o ningun Y), no hay informacion posicional: se conserva el orden de flujo.'

type GutterCandidate = { left: number; right: number; row: number }

function inferColumnGutter(segments: PdfTextSegment[], lineHeight: number): number | null {
  const positioned = segments.filter((segment) => segment.x !== null && segment.y !== null)
  if (positioned.length < minimumGutterRows * 2) return null
  const tolerance = toleranceFor(lineHeight)
  const sorted = positioned.slice().sort((a, b) => {
    const yDifference = (b.y ?? 0) - (a.y ?? 0)
    return yDifference !== 0 ? yDifference : (a.x ?? 0) - (b.x ?? 0)
  })
  const rows: Array<{ y: number; segments: PdfTextSegment[] }> = []
  for (const segment of sorted) {
    const y = segment.y as number
    const row = rows[rows.length - 1]
    if (row !== undefined && Math.abs(row.y - y) <= tolerance) row.segments.push(segment)
    else rows.push({ y, segments: [segment] })
  }

  const minGap = Math.max(columnGutterMin, lineHeight * columnGutterHeightRatio)
  const candidates: GutterCandidate[] = []
  rows.forEach((row, index) => {
    const horizontal = row.segments.slice().sort((a, b) => (a.x ?? 0) - (b.x ?? 0))
    let largest: GutterCandidate | null = null
    for (let segmentIndex = 1; segmentIndex < horizontal.length; segmentIndex += 1) {
      const previous = horizontal[segmentIndex - 1]
      const current = horizontal[segmentIndex]
      const left = (previous.x ?? 0) + (previous.width ?? 0)
      const right = current.x ?? left
      if (right - left < minGap) continue
      if (largest === null || right - left > largest.right - largest.left) largest = { left, right, row: index }
    }
    if (largest !== null) candidates.push(largest)
  })

  let best: { left: number; right: number; support: number } | null = null
  for (const candidate of candidates) {
    const center = (candidate.left + candidate.right) / 2
    const supporting = candidates.filter((other) => other.left <= center && other.right >= center)
    const rowSupport = new Set(supporting.map((other) => other.row)).size
    if (rowSupport < minimumGutterRows) continue
    const left = Math.max(...supporting.map((other) => other.left))
    const right = Math.min(...supporting.map((other) => other.right))
    if (right - left < minGap) continue
    if (best === null || rowSupport > best.support || (rowSupport === best.support && right - left > best.right - best.left)) {
      best = { left, right, support: rowSupport }
    }
  }
  return best === null ? null : (best.left + best.right) / 2
}

function reconstructSingleStreamLines(segments: PdfTextSegment[]): string[] {
  const usable = segments.filter((segment) => segment.text.trim().length > 0)
  if (usable.length === 0) return []
  if (!hasUsableGeometry(usable)) return usable.map((segment) => segment.text.trim())
  const defaultHeight = medianHeight(usable)
  const sorted = usable.slice().sort((a, b) => {
    const left = a.y === null ? -1 : a.y
    const right = b.y === null ? -1 : b.y
    if (right !== left) return right - left
    return (a.x === null ? -1 : a.x) - (b.x === null ? -1 : b.x)
  })

  const lines: Array<{ y: number; height: number; segments: PdfTextSegment[] }> = []
  for (const segment of sorted) {
    const height = segment.height === null || segment.height <= 0 ? defaultHeight : segment.height
    if (segment.y === null) {
      lines.push({ y: -1, height, segments: [segment] })
      continue
    }
    const last = lines[lines.length - 1]
    if (last !== undefined && last.y >= 0 && Math.abs(last.y - segment.y) <= toleranceFor(last.height)) {
      last.segments.push(segment)
      last.height = Math.max(last.height, height)
      continue
    }
    lines.push({ y: segment.y, height, segments: [segment] })
  }

  return lines.map((line) => {
    const ordered = line.segments.slice().sort((a, b) => (a.x === null ? -1 : a.x) - (b.x === null ? -1 : b.x))
    let text = ''
    let previous: PdfTextSegment | null = null
    for (const segment of ordered) {
      const piece = segment.text.trim()
      if (piece.length === 0) continue
      if (previous !== null && needsSpace(previous, segment, line.height)) text += ' '
      text += piece
      previous = segment
    }
    return text.trim()
  })
}

export function reconstructLines(segments: PdfTextSegment[]): string[] {
  const usable = segments.filter((segment) => segment.text.trim().length > 0)
  if (usable.length === 0) return []
  if (!hasUsableGeometry(usable)) return usable.map((segment) => segment.text.trim())
  const gutter = inferColumnGutter(usable, medianHeight(usable))
  if (gutter === null) return reconstructSingleStreamLines(usable)
  const left: PdfTextSegment[] = []
  const right: PdfTextSegment[] = []
  const floating: PdfTextSegment[] = []
  const floatingBand = Math.max(10, medianHeight(usable))
  for (const segment of usable) {
    if (segment.x === null) {
      floating.push(segment)
      continue
    }
    const center = segment.x + (segment.width ?? 0) / 2
    const beginsAtGutter = Math.abs(segment.x - gutter) <= floatingBand && (segment.width ?? 0) >= medianHeight(usable) * 10
    if (Math.abs(center - gutter) <= floatingBand || beginsAtGutter) {
      floating.push(segment)
      continue
    }
    if (center <= gutter) left.push(segment)
    else right.push(segment)
  }
  return [
    ...reconstructSingleStreamLines(floating),
    ...reconstructSingleStreamLines(left),
    ...reconstructSingleStreamLines(right),
  ]
}

export function segmentsToText(segments: PdfTextSegment[]): string {
  return reconstructLines(segments).join(String.fromCharCode(10))
}

export function toPdfPage(page: RichPdfPage): PdfPage {
  const detected = page.columns.detected
  return {
    pageNumber: page.pageNumber,
    text: page.hasText ? segmentsToText(page.textSegments) : page.text,
    width: page.width,
    height: page.height,
    declaredColumns: detected,
    columnTexts: null,
    hasImages: page.images.length > 0,
  }
}

export function richDocumentToPages(document: RichPdfDocument): PdfPage[] {
  return document.pages.map((page) => toPdfPage(page))
}

export function createRealPdfTextSource(document: RichPdfDocument): PdfTextSource {
  const pages = richDocumentToPages(document)
  return {
    id: pdfSourceId,
    label: 'Fuente de texto del adaptador real de PDF',
    status: 'real-pdf',
    loadPages: async (_document: SourceDocumentRef, _version: DocumentVersionRef) => pages.map((page) => ({ ...page })),
  }
}

export function describeRichPage(page: RichPdfPage): string {
  return [
    'pagina ' + String(page.pageNumber),
    page.hasText ? String(page.textSegments.length) + ' segmentos' : 'sin texto',
    page.images.length > 0 ? String(page.images.length) + ' imagenes' : 'sin imagenes',
    page.tables.length > 0 ? String(page.tables.length) + ' candidatos a tabla' : 'sin tablas',
    page.columns.detected === null ? 'columnas desconocidas' : String(page.columns.detected) + ' columnas (heuristica)',
  ].join(' · ')
}

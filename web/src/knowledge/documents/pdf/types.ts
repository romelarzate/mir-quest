export type PdfAdapterErrorCode =
  | 'file-not-found'
  | 'not-a-pdf'
  | 'corrupted-pdf'
  | 'encrypted-pdf'
  | 'unsupported-pdf'
  | 'too-large'
  | 'empty-document'
  | 'library-unavailable'
  | 'unknown'

export type PdfAdapterError = {
  code: PdfAdapterErrorCode
  message: string
  recoverable: boolean
}

export type PdfLimits = {
  maxBytes: number
  maxPages: number
}

export const defaultPdfLimits: PdfLimits = { maxBytes: 25 * 1024 * 1024, maxPages: 2000 }

export type PdfTextSegment = {
  segmentId: string
  pageNumber: number
  text: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  hasEol: boolean
}

export type PdfBoundingBox = { x: number; y: number; width: number; height: number }

export type PdfImageCandidate = {
  imageId: string
  page: number
  boundingBox: PdfBoundingBox | null
  confidence: number | null
  source: 'operator-list'
  note: string
}

export type PdfTableCandidate = {
  candidateId: string
  page: number
  boundingBox: PdfBoundingBox | null
  rowCount: number | null
  columnCount: number | null
  confidence: number | null
  text: string[]
  note: string
}

export type PdfColumnInfo = {
  detected: number | null
  method: 'x-cluster' | null
  confidence: number | null
  note: string
}

export type PdfReadingOrder = {
  order: 'content-stream' | 'unknown'
  confidence: number | null
  note: string
}

export type RichPdfPage = {
  pageNumber: number
  width: number | null
  height: number | null
  text: string
  textSegments: PdfTextSegment[]
  images: PdfImageCandidate[]
  tables: PdfTableCandidate[]
  columns: PdfColumnInfo
  readingOrder: PdfReadingOrder
  sourceOffsetsAvailable: boolean
  hasText: boolean
}

export type PdfLibraryInfo = {
  name: string
  version: string
  license: string
  entry: string
}

export type RichPdfDocument = {
  filePath: string
  fileName: string
  sizeBytes: number
  sha256: string
  pageCount: number
  pages: RichPdfPage[]
  library: PdfLibraryInfo
  encrypted: boolean
  warnings: string[]
}

export type RealPdfAdapter = {
  id: string
  label: string
  status: 'ready' | 'not-implemented'
  library: PdfLibraryInfo
  inspect: (input: { filePath: string; limits?: Partial<PdfLimits> }) => Promise<RichPdfDocument>
}

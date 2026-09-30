/**
 * Extracción de PDF del Knowledge Core (Fase 5.5).
 *
 * Esta fase NO implementa un lector de PDF binario ni conecta ningún LLM:
 * trabaja sobre la capa de texto que un futuro adaptador de PDF entregue,
 * página a página. Así el pipeline se puede validar con fixtures sintéticos
 * sin depender de una librería externa ni del corpus completo.
 */

export type ExtractionStatus = 'accepted' | 'quarantined' | 'rejected'

export type QualityComponentKey =
  | 'textCompleteness'
  | 'questionBoundaryConfidence'
  | 'optionCompleteness'
  | 'answerKeyConfidence'
  | 'layoutConfidence'
  | 'overallConfidence'

/** Un componente desconocido es null: nunca se inventa una confianza. */
export type ExtractionQuality = {
  textCompleteness: number | null
  questionBoundaryConfidence: number | null
  optionCompleteness: number | null
  answerKeyConfidence: number | null
  layoutConfidence: number | null
  overallConfidence: number | null
  missingComponents: QualityComponentKey[]
  notes: string[]
}

export type ExtractionErrorCode =
  | 'empty-question'
  | 'truncated-question'
  | 'missing-options'
  | 'duplicate-options'
  | 'invalid-question-number'
  | 'sequence-mismatch'
  | 'missing-answer'
  | 'answer-out-of-range'
  | 'text-too-short'
  | 'text-too-long'
  | 'page-without-questions'
  | 'multiple-questions-mixed'
  | 'possible-column-loss'
  | 'anomalous-characters'
  | 'table-layout-unsupported'
  | 'image-dependent-question'

export type ExtractionSeverity = 'info' | 'warning' | 'error'

/** Determina la consecuencia: solo 'fatal' lleva a rechazo. */
export type ExtractionConsequence = 'none' | 'quarantine' | 'fatal'

export type ExtractionValidationError = {
  code: ExtractionErrorCode
  severity: ExtractionSeverity
  consequence: ExtractionConsequence
  message: string
  questionNumber: number | null
  page: number | null
}

export type ExtractedOption = {
  label: string
  text: string
}

/** Resultado por pregunta, con la procedencia exigida por el warehouse. */
export type ExtractedQuestion = {
  sourceDocumentId: string
  documentVersionId: string
  page: number
  pageEnd: number
  rawText: string
  questionNumber: number | null
  originalQuestionNumber: number | null
  options: ExtractedOption[]
  detectedAnswer: string | null
  declaredOptionsPerQuestion: number | null
  confidence: number | null
  quality: ExtractionQuality
  validationStatus: ExtractionStatus
  validationErrors: ExtractionValidationError[]
  duplicateCandidate: boolean
  splitAcrossPages: boolean
  anomalousCharacterRatio: number | null
}

export type PdfPage = {
  pageNumber: number
  text: string
  width: number | null
  height: number | null
  declaredColumns: number | null
  columnTexts: string[] | null
  hasImages: boolean
}

export type SourceDocumentRef = {
  id: string
  fileName: string
  title: string
  sizeBytes: number
  sha256: string
  declaredPages: number | null
  declaredOptionsPerQuestion: number | null
}

export type DocumentVersionRef = {
  id: string
  documentId: string
  versionLabel: string
  sha256: string
}

/**
 * Fuente de texto por página. Un adaptador real de PDF la implementaría;
 * en esta fase existen la fuente sintética y un marcador no implementado.
 */
export type PdfTextSource = {
  id: string
  label: string
  status: 'synthetic' | 'real-pdf' | 'not-implemented'
  loadPages: (document: SourceDocumentRef, version: DocumentVersionRef) => Promise<PdfPage[]>
}

export type ExtractionRun = {
  document: SourceDocumentRef
  version: DocumentVersionRef
  sourceId: string
  pages: number
  pagesWithQuestions: number[]
  questions: ExtractedQuestion[]
  pageErrors: ExtractionValidationError[]
  startedAt: string
  finishedAt: string
}

export type PdfExtractionService = {
  id: string
  label: string
  status: 'implemented' | 'not-implemented'
  extract: (input: {
    document: SourceDocumentRef
    version: DocumentVersionRef
    source: PdfTextSource
  }) => Promise<ExtractionRun>
}

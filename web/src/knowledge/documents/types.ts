export type ArtifactType = 'pdf' | 'markdown' | 'json' | 'extraction-result' | 'snapshot'

export const artifactTypes: ArtifactType[] = ['pdf', 'markdown', 'json', 'extraction-result', 'snapshot']

export type DocumentArtifact = {
  artifactId: string
  sourceDocumentId: string
  documentVersionId: string
  artifactType: ArtifactType
  version: number
  sha256: string
  contentSha256: string
  createdAt: string
  generator: string
  generatorVersion: string
  parentArtifactId: string | null
  metadata: Record<string, string | number | null>
  contentRef: string
}

export type MarkdownBlockKind =
  | 'title'
  | 'heading'
  | 'paragraph'
  | 'list-item'
  | 'option'
  | 'table-row'
  | 'figure'
  | 'page-break'
  | 'uninterpreted'

export type MarkdownBlock = {
  blockId: string
  kind: MarkdownBlockKind
  text: string
  sourceText: string
  level: number | null
  page: number
  uncertain: boolean
  reason: string | null
}

export type DocumentPageMap = {
  markdownBlockId: string
  sourceDocumentId: string
  documentVersionId: string
  sourcePageStart: number
  sourcePageEnd: number
  sourceOffsetStart: number | null
  sourceOffsetEnd: number | null
  confidence: number | null
}

export type CanonicalDocument = {
  documentId: string
  versionId: string
  markdownArtifactId: string
  generator: string
  generatorVersion: string
  normalizerVersion: string
  markdown: string
  blocks: MarkdownBlock[]
  pageMap: DocumentPageMap[]
  sha256: string
  createdAt: string
}

export type TraceabilityChain = {
  sourceDocumentId: string
  documentVersionId: string
  markdownArtifactId: string
  markdownBlockId: string
  sourcePageStart: number
  sourcePageEnd: number
  extractedQuestionNumber: number | null
  knowledgeEntityId: string | null
  complete: boolean
  missing: string[]
}

export type DocumentValidationSeverity = 'info' | 'warning' | 'error'

export type DocumentValidationCode =
  | 'empty-document'
  | 'missing-page-map'
  | 'duplicated-block'
  | 'broken-heading'
  | 'broken-option-sequence'
  | 'suspicious-table'
  | 'orphan-text'
  | 'image-dependent-content'
  | 'suspicious-page-transition'

export type DocumentValidationIssue = {
  code: DocumentValidationCode
  severity: DocumentValidationSeverity
  message: string
  blockId: string | null
  page: number | null
}

export type DocumentValidationReport = {
  ok: boolean
  errorCount: number
  warningCount: number
  issues: DocumentValidationIssue[]
}

export type NormalizationResult = {
  text: string
  changes: string[]
  changed: boolean
}

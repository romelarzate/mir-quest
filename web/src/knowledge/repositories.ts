import type { KnowledgeDatabase } from './db'
import {
  buildDatasetVersionId,
  buildDocumentId,
  buildDocumentVersionId,
  buildExamId,
  buildHistoricalQuestionId,
  buildSourceReferenceId,
  normalizedTextHash,
  sha256,
  shortenId,
} from './ids'

export type ValidationStatus = 'accepted' | 'quarantined' | 'rejected'
export type DatasetStatus = 'draft' | 'processing' | 'review' | 'accepted' | 'published'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'
export type SourceType = 'demo' | 'manual' | 'authorized' | 'historical' | 'ai'
export type ClassificationSource = 'demo' | 'manual' | 'authorized'

function flag(value: boolean | undefined, fallback = false): number {
  return (value ?? fallback) ? 1 : 0
}

export type SourceDocumentInput = {
  id?: string
  title: string
  fileName: string
  mimeType: string
  sha256: string
  now: Date
  author?: string | null
  edition?: string | null
  year?: number | null
  publisher?: string | null
  language?: string | null
  pageCount?: number | null
  sourceType?: SourceType
  notes?: string | null
  isDemo?: boolean
}

export function insertSourceDocument(database: KnowledgeDatabase, input: SourceDocumentInput): string {
  const id = input.id ?? buildDocumentId(input.fileName, input.sha256)
  database
    .prepare(
      'INSERT INTO source_document (id, title, author, edition, year, publisher, language, page_count, mime_type, file_name, sha256, source_type, notes, created_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.title,
      input.author ?? null,
      input.edition ?? null,
      input.year ?? null,
      input.publisher ?? null,
      input.language ?? null,
      input.pageCount ?? null,
      input.mimeType,
      input.fileName,
      input.sha256,
      input.sourceType ?? 'demo',
      input.notes ?? null,
      input.now.toISOString(),
      flag(input.isDemo, true),
    )
  return id
}

export type DocumentVersionInput = {
  documentId: string
  versionLabel: string
  sha256: string
  now: Date
  notes?: string | null
  id?: string
}

export function insertDocumentVersion(database: KnowledgeDatabase, input: DocumentVersionInput): string {
  const id = input.id ?? buildDocumentVersionId(input.documentId, input.versionLabel)
  database
    .prepare('INSERT INTO document_version (id, document_id, version_label, sha256, created_at, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, input.documentId, input.versionLabel, input.sha256, input.now.toISOString(), input.notes ?? null)
  return id
}

export type SourceReferenceInput = {
  label: string
  now: Date
  type?: SourceType
  citation?: string | null
  url?: string | null
  year?: number | null
  documentId?: string | null
  documentVersionId?: string | null
  notes?: string | null
  id?: string
}

export function insertSourceReference(database: KnowledgeDatabase, input: SourceReferenceInput): string {
  const id = input.id ?? buildSourceReferenceId(input.label, input.citation ?? null)
  database
    .prepare(
      'INSERT INTO source_reference (id, type, label, citation, url, year, document_id, document_version_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.type ?? 'demo',
      input.label,
      input.citation ?? null,
      input.url ?? null,
      input.year ?? null,
      input.documentId ?? null,
      input.documentVersionId ?? null,
      input.notes ?? null,
      input.now.toISOString(),
    )
  return id
}

export type ClinicalDomainInput = {
  id: string
  label: string
  orderIndex: number
  taxonomyVersion: string
  now: Date
  isDemo?: boolean
}

export function insertClinicalDomain(database: KnowledgeDatabase, input: ClinicalDomainInput): string {
  database
    .prepare(
      'INSERT INTO clinical_domain (id, label, order_index, taxonomy_version, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(input.id, input.label, input.orderIndex, input.taxonomyVersion, flag(input.isDemo, true), input.now.toISOString())
  return input.id
}

export type HistoricalExamInput = {
  examVersion: string
  label: string
  now: Date
  documentId: string
  documentVersionId: string
  examYear?: number | null
  questionCount?: number
  isDemo?: boolean
  id?: string
}

export function insertHistoricalExam(database: KnowledgeDatabase, input: HistoricalExamInput): string {
  const id = input.id ?? buildExamId(input.examVersion, input.examYear ?? null)
  database
    .prepare(
      'INSERT INTO historical_exam (id, exam_version, exam_year, label, source_document_id, document_version_id, question_count, created_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.examVersion,
      input.examYear ?? null,
      input.label,
      input.documentId,
      input.documentVersionId,
      input.questionCount ?? 0,
      input.now.toISOString(),
      flag(input.isDemo, true),
    )
  return id
}

export type HistoricalQuestionInput = {
  examId: string
  examVersion: string
  originalQuestionNumber: number
  stem: string
  now: Date
  documentId: string
  documentVersionId: string
  subjectId?: string | null
  topicId?: string | null
  subtopicId?: string | null
  difficulty?: 'Facil' | 'Media' | 'Dificil' | null
  page?: number | null
  sourceHash?: string | null
  rawText?: string | null
  validationStatus?: ValidationStatus
  id?: string
}

export type HistoricalQuestionInsertResult = {
  id: string
  stemHash: string
  normalizedTextHash: string
}

export function insertHistoricalQuestion(
  database: KnowledgeDatabase,
  input: HistoricalQuestionInput,
): HistoricalQuestionInsertResult {
  const id =
    input.id ??
    buildHistoricalQuestionId({
      examId: input.examId,
      examVersion: input.examVersion,
      originalQuestionNumber: input.originalQuestionNumber,
      stem: input.stem,
    })
  const stemHash = sha256(input.stem)
  const textHash = normalizedTextHash(input.stem)
  database
    .prepare(
      'INSERT INTO historical_question (id, exam_id, original_question_number, stem, stem_hash, normalized_text_hash, subject_id, topic_id, subtopic_id, difficulty, source_document_id, document_version_id, page, source_hash, raw_text, validation_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.examId,
      input.originalQuestionNumber,
      input.stem,
      stemHash,
      textHash,
      input.subjectId ?? null,
      input.topicId ?? null,
      input.subtopicId ?? null,
      input.difficulty ?? null,
      input.documentId,
      input.documentVersionId,
      input.page ?? null,
      input.sourceHash ?? null,
      input.rawText ?? null,
      input.validationStatus ?? 'accepted',
      input.now.toISOString(),
    )
  return { id, stemHash, normalizedTextHash: textHash }
}

export type QuestionOptionInput = {
  questionId: string
  optionLabel: string
  text: string
  orderIndex: number
  isCorrect?: boolean
}

export function insertQuestionOption(database: KnowledgeDatabase, input: QuestionOptionInput): void {
  database
    .prepare('INSERT INTO question_option (question_id, option_label, text, is_correct, order_index) VALUES (?, ?, ?, ?, ?)')
    .run(input.questionId, input.optionLabel, input.text, flag(input.isCorrect), input.orderIndex)
}

export type QuestionClassificationInput = {
  questionId: string
  clinicalDomainId: string
  source: ClassificationSource
  taxonomyVersion: string
  now: Date
  confidence?: number | null
  id?: string
}

export function insertQuestionClassification(database: KnowledgeDatabase, input: QuestionClassificationInput): string {
  const id = input.id ?? shortenId('qcls', input.questionId + '|' + input.clinicalDomainId + '|' + input.taxonomyVersion, 20)
  database
    .prepare(
      'INSERT INTO question_classification (id, question_id, clinical_domain_id, confidence, source, taxonomy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, input.questionId, input.clinicalDomainId, input.confidence ?? null, input.source, input.taxonomyVersion, input.now.toISOString())
  return id
}

export type CurriculumMappingInput = {
  mirSubjectId: string
  clinicalDomainId: string
  source: ClassificationSource
  taxonomyVersion: string
  now: Date
  mirTopicId?: string | null
  mirSubtopicId?: string | null
  confidence?: number | null
  id?: string
}

export function insertCurriculumMapping(database: KnowledgeDatabase, input: CurriculumMappingInput): string {
  const id =
    input.id ??
    shortenId('cmap', [input.mirSubjectId, input.mirTopicId ?? '', input.mirSubtopicId ?? '', input.clinicalDomainId, input.taxonomyVersion].join('|'), 20)
  database
    .prepare(
      'INSERT INTO curriculum_mapping (id, mir_subject_id, mir_topic_id, mir_subtopic_id, clinical_domain_id, confidence, source, taxonomy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.mirSubjectId,
      input.mirTopicId ?? null,
      input.mirSubtopicId ?? null,
      input.clinicalDomainId,
      input.confidence ?? null,
      input.source,
      input.taxonomyVersion,
      input.now.toISOString(),
    )
  return id
}

export type ExtractionResultInput = {
  sourceDocumentId: string
  rawText: string
  now: Date
  validationStatus: ValidationStatus
  historicalQuestionId?: string | null
  documentVersionId?: string | null
  page?: number | null
  confidence?: number | null
  validationErrors?: string[]
  isDemo?: boolean
  id?: string
}

export function insertExtractionResult(database: KnowledgeDatabase, input: ExtractionResultInput): string {
  const id = input.id ?? shortenId('ext', input.sourceDocumentId + '|' + String(input.page ?? '') + '|' + sha256(input.rawText), 20)
  database
    .prepare(
      'INSERT INTO extraction_result (id, historical_question_id, source_document_id, document_version_id, page, confidence, validation_status, validation_errors_json, raw_text, extracted_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.historicalQuestionId ?? null,
      input.sourceDocumentId,
      input.documentVersionId ?? null,
      input.page ?? null,
      input.confidence ?? null,
      input.validationStatus,
      JSON.stringify(input.validationErrors ?? []),
      input.rawText,
      input.now.toISOString(),
      flag(input.isDemo, true),
    )
  return id
}

export type QuarantineInput = {
  extractionResultId: string
  sourceDocumentId: string
  rawText: string
  now: Date
  reviewStatus?: ReviewStatus
  historicalQuestionId?: string | null
  confidence?: number | null
  validationErrors?: string[]
  page?: number | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  id?: string
}

export function insertQuarantineQuestion(database: KnowledgeDatabase, input: QuarantineInput): string {
  const id = input.id ?? shortenId('quar', input.extractionResultId, 20)
  database
    .prepare(
      'INSERT INTO quarantine_question (id, extraction_result_id, historical_question_id, raw_text, confidence, validation_errors_json, source_document_id, page, review_status, reviewed_by, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.extractionResultId,
      input.historicalQuestionId ?? null,
      input.rawText,
      input.confidence ?? null,
      JSON.stringify(input.validationErrors ?? []),
      input.sourceDocumentId,
      input.page ?? null,
      input.reviewStatus ?? 'pending',
      input.reviewedBy ?? null,
      input.reviewedAt ?? null,
      input.now.toISOString(),
    )
  return id
}

export type DatasetVersionInput = {
  name: string
  version: number
  taxonomyVersion: string
  now: Date
  sourceHashes?: string[]
  questionCount?: number
  acceptedCount?: number
  quarantineCount?: number
  rejectedCount?: number
  status?: DatasetStatus
  id?: string
}

export function insertDatasetVersion(database: KnowledgeDatabase, input: DatasetVersionInput): string {
  const id = input.id ?? buildDatasetVersionId(input.name, input.version)
  database
    .prepare(
      'INSERT INTO dataset_version (id, name, version, created_at, source_hashes_json, question_count, accepted_count, quarantine_count, rejected_count, taxonomy_version, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.name,
      input.version,
      input.now.toISOString(),
      JSON.stringify(input.sourceHashes ?? []),
      input.questionCount ?? 0,
      input.acceptedCount ?? 0,
      input.quarantineCount ?? 0,
      input.rejectedCount ?? 0,
      input.taxonomyVersion,
      input.status ?? 'draft',
    )
  return id
}

export function updateDatasetStatus(database: KnowledgeDatabase, datasetId: string, status: DatasetStatus): void {
  database.prepare('UPDATE dataset_version SET status = ? WHERE id = ?').run(status, datasetId)
}

export function getSourceDocument(database: KnowledgeDatabase, id: string): Record<string, unknown> | undefined {
  return database.prepare('SELECT * FROM source_document WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function getDocumentVersionByLabel(
  database: KnowledgeDatabase,
  documentId: string,
  versionLabel: string,
): Record<string, unknown> | undefined {
  return database
    .prepare('SELECT * FROM document_version WHERE document_id = ? AND version_label = ?')
    .get(documentId, versionLabel) as Record<string, unknown> | undefined
}

export function getHistoricalExam(database: KnowledgeDatabase, id: string): Record<string, unknown> | undefined {
  return database.prepare('SELECT * FROM historical_exam WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function getHistoricalQuestion(database: KnowledgeDatabase, id: string): Record<string, unknown> | undefined {
  return database.prepare('SELECT * FROM historical_question WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function listQuestionsByExam(database: KnowledgeDatabase, examId: string): Array<Record<string, unknown>> {
  return database
    .prepare('SELECT id, original_question_number, validation_status FROM historical_question WHERE exam_id = ? ORDER BY original_question_number')
    .all(examId) as Array<Record<string, unknown>>
}

export type UsableQuestionFilter = {
  examId?: string | null
  subjectId?: string | null
  topicId?: string | null
  clinicalDomainId?: string | null
  limit?: number | null
}

/**
 * Preguntas utilizables por estadísticas, features, Predict y simulacros.
 * Lee siempre la vista, que excluye cuarentena pendiente o rechazada.
 */
export function listUsableQuestions(
  database: KnowledgeDatabase,
  filter: UsableQuestionFilter = {},
): Array<Record<string, unknown>> {
  const conditions: string[] = []
  const params: Array<string | number> = []
  if (filter.examId) {
    conditions.push('q.exam_id = ?')
    params.push(filter.examId)
  }
  if (filter.subjectId) {
    conditions.push('q.subject_id = ?')
    params.push(filter.subjectId)
  }
  if (filter.topicId) {
    conditions.push('q.topic_id = ?')
    params.push(filter.topicId)
  }
  if (filter.clinicalDomainId) {
    conditions.push('EXISTS (SELECT 1 FROM question_classification c WHERE c.question_id = q.id AND c.clinical_domain_id = ?)')
    params.push(filter.clinicalDomainId)
  }
  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''
  const limit = filter.limit && filter.limit > 0 ? ' LIMIT ' + String(Math.floor(filter.limit)) : ''
  return database
    .prepare('SELECT q.* FROM usable_historical_question q' + where + ' ORDER BY q.exam_id, q.original_question_number' + limit)
    .all(...params) as Array<Record<string, unknown>>
}

export function listQuestionOptions(database: KnowledgeDatabase, questionId: string): Array<Record<string, unknown>> {
  return database
    .prepare('SELECT * FROM question_option WHERE question_id = ? ORDER BY order_index')
    .all(questionId) as Array<Record<string, unknown>>
}

export function listQuarantine(database: KnowledgeDatabase, reviewStatus?: ReviewStatus): Array<Record<string, unknown>> {
  if (reviewStatus) {
    return database
      .prepare('SELECT * FROM quarantine_question WHERE review_status = ? ORDER BY created_at')
      .all(reviewStatus) as Array<Record<string, unknown>>
  }
  return database.prepare('SELECT * FROM quarantine_question ORDER BY created_at').all() as Array<Record<string, unknown>>
}

export function getDatasetVersion(database: KnowledgeDatabase, id: string): Record<string, unknown> | undefined {
  return database.prepare('SELECT * FROM dataset_version WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function insertDatasetQuestion(
  database: KnowledgeDatabase,
  input: { datasetVersionId: string; questionId: string; position: number },
): void {
  database
    .prepare('INSERT INTO dataset_question (dataset_version_id, question_id, position) VALUES (?, ?, ?)')
    .run(input.datasetVersionId, input.questionId, input.position)
}

export function listDatasetQuestionIds(database: KnowledgeDatabase, datasetVersionId: string): string[] {
  const rows = database
    .prepare('SELECT question_id FROM dataset_question WHERE dataset_version_id = ? ORDER BY position')
    .all(datasetVersionId) as Array<{ question_id: string }>
  return rows.map((row) => row.question_id)
}

export function countQuestionsByStatus(database: KnowledgeDatabase): Record<ValidationStatus, number> {
  const rows = database
    .prepare('SELECT validation_status, COUNT(*) AS total FROM historical_question GROUP BY validation_status')
    .all() as Array<{ validation_status: ValidationStatus; total: number }>
  const summary: Record<ValidationStatus, number> = { accepted: 0, quarantined: 0, rejected: 0 }
  for (const row of rows) summary[row.validation_status] = row.total
  return summary
}

export function countUsableQuestions(database: KnowledgeDatabase): number {
  const row = database.prepare('SELECT COUNT(*) AS total FROM usable_historical_question').get() as { total: number }
  return row.total
}

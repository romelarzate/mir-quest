import type { ContentBundle } from './content'
import { createCurriculumIndex, findBrokenReferences } from './content'
import type { ContentBlock, Flashcard, Question, SourceReference, Subject, Subtopic, Tag, Topic } from './types'

export type ImportFormat = 'json' | 'csv' | 'markdown'
export type ImportEntity = 'curriculum' | 'questions' | 'flashcards' | 'content'
export type ImportSeverity = 'error' | 'warning'

export type ImportIssue = {
  severity: ImportSeverity
  code: string
  message: string
  entity: ImportEntity
  entityId?: string
  field?: string
}

export type ImportResult = {
  ok: boolean
  entity: ImportEntity
  format: ImportFormat
  schemaVersion: number | null
  recordCount: number
  issues: ImportIssue[]
}

export type ImportValidationContext = {
  bundle: ContentBundle
  existingIds?: string[]
  expectedSchemaVersion?: number
}

export type ParsedImport = {
  schemaVersion: number | null
  entity: string | null
  records: Array<Record<string, unknown>>
  issues: ImportIssue[]
}

function issue(
  entity: ImportEntity,
  code: string,
  message: string,
  extra: { entityId?: string; field?: string; severity?: ImportSeverity } = {},
): ImportIssue {
  return {
    severity: extra.severity ?? 'error',
    code,
    message,
    entity,
    entityId: extra.entityId,
    field: extra.field,
  }
}

// ---------------------------------------------------------------- parsers

export function parseJsonImport(text: string, entity: ImportEntity): ParsedImport {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { schemaVersion: null, entity: null, records: [], issues: [issue(entity, 'invalid-json', 'El texto no es JSON válido.')] }
  }

  if (Array.isArray(raw)) {
    return { schemaVersion: null, entity: null, records: raw.map(asRecord), issues: [] }
  }

  const container = asRecord(raw)
  const records = Array.isArray(container.records)
    ? container.records.map(asRecord)
    : Array.isArray(container.items)
      ? container.items.map(asRecord)
      : []

  return {
    schemaVersion: typeof container.schemaVersion === 'number' ? container.schemaVersion : null,
    entity: typeof container.entity === 'string' ? container.entity : null,
    records,
    issues: records.length === 0 ? [issue(entity, 'no-records', 'El JSON no contiene una lista de registros.')] : [],
  }
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    if (char !== '\r') field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0))
}

export function parseCsvImport(text: string, entity: ImportEntity): ParsedImport {
  const rows = splitCsvRows(text)
  if (rows.length === 0) {
    return { schemaVersion: null, entity: null, records: [], issues: [issue(entity, 'empty-csv', 'El CSV está vacío.')] }
  }
  const headers = rows[0].map((header) => header.trim())
  const records: Array<Record<string, unknown>> = []
  for (const row of rows.slice(1)) {
    const record: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? '').trim()
    })
    records.push(record)
  }
  return { schemaVersion: null, entity: null, records, issues: [] }
}

/**
 * Formato Markdown soportado:
 *
 * # mir-quest import
 * schemaVersion: 2
 * entity: questions
 *
 * ## <id>
 * campo: valor
 */
export function parseMarkdownImport(text: string, entity: ImportEntity): ParsedImport {
  const issues: ImportIssue[] = []
  let schemaVersion: number | null = null
  let declaredEntity: string | null = null
  const records: Array<Record<string, unknown>> = []
  let current: Record<string, unknown> | null = null

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue

    if (trimmed.startsWith('## ')) {
      if (current) records.push(current)
      current = { id: trimmed.slice(3).trim() }
      continue
    }

    const separator = trimmed.indexOf(':')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()

    if (!current) {
      if (key === 'schemaVersion') schemaVersion = Number(value)
      if (key === 'entity') declaredEntity = value
      continue
    }
    current[key] = value
  }
  if (current) records.push(current)

  if (records.length === 0) {
    issues.push(issue(entity, 'no-records', 'El Markdown no contiene bloques "## id".'))
  }
  return { schemaVersion, entity: declaredEntity, records, issues }
}

export function parseImport(text: string, format: ImportFormat, entity: ImportEntity): ParsedImport {
  if (format === 'json') return parseJsonImport(text, entity)
  if (format === 'csv') return parseCsvImport(text, entity)
  return parseMarkdownImport(text, entity)
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

// ------------------------------------------------------------ normalizers

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function readStringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
      .split(';')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

function readOptions(record: Record<string, unknown>): Array<{ id: string; text: string }> {
  const direct = record.options
  if (Array.isArray(direct)) {
    return direct
      .map((value) => asRecord(value))
      .map((value) => ({ id: String(value.id ?? ''), text: String(value.text ?? '') }))
      .filter((option) => option.id.length > 0)
  }
  const options: Array<{ id: string; text: string }> = []
  for (const key of ['optionA', 'optionB', 'optionC', 'optionD', 'optionE']) {
    const text = readString(record, key)
    if (text) options.push({ id: key.replace('option', '').toLowerCase(), text })
  }
  return options
}

// -------------------------------------------------------------- validation

export type Importer = {
  entity: ImportEntity
  requiredFields: string[]
  import: (text: string, format: ImportFormat, context: ImportValidationContext) => ImportResult
}

function referenceIssues(
  entity: ImportEntity,
  bundle: ContentBundle,
  entityId: string,
  refs: { subjectId?: string | null; topicId?: string | null; subtopicId?: string | null; sourceIds?: string[]; tagIds?: string[]; examVersionId?: string | null },
): ImportIssue[] {
  const index = createCurriculumIndex(bundle)
  const issues: ImportIssue[] = []
  if (refs.subjectId && !index.subjectsById.has(refs.subjectId)) {
    issues.push(issue(entity, 'invalid-reference', 'Asignatura inexistente: ' + refs.subjectId, { entityId, field: 'subjectId' }))
  }
  if (refs.topicId && !index.topicsById.has(refs.topicId)) {
    issues.push(issue(entity, 'invalid-reference', 'Tema inexistente: ' + refs.topicId, { entityId, field: 'topicId' }))
  }
  if (refs.subtopicId && !index.subtopicsById.has(refs.subtopicId)) {
    issues.push(issue(entity, 'invalid-reference', 'Subtema inexistente: ' + refs.subtopicId, { entityId, field: 'subtopicId' }))
  }
  for (const sourceId of refs.sourceIds ?? []) {
    if (!index.sourcesById.has(sourceId)) {
      issues.push(issue(entity, 'invalid-reference', 'Fuente inexistente: ' + sourceId, { entityId, field: 'sourceIds' }))
    }
  }
  for (const tagId of refs.tagIds ?? []) {
    if (!index.tagsById.has(tagId)) {
      issues.push(issue(entity, 'invalid-reference', 'Etiqueta inexistente: ' + tagId, { entityId, field: 'tags' }))
    }
  }
  if (refs.examVersionId && !index.examVersionsById.has(refs.examVersionId)) {
    issues.push(issue(entity, 'invalid-reference', 'Versión de examen inexistente: ' + refs.examVersionId, { entityId, field: 'examVersionId' }))
  }
  return issues
}

export function normalizeQuestionRecord(record: Record<string, unknown>): Question | null {
  const id = readString(record, 'id')
  const subjectId = readString(record, 'subjectId')
  const stem = readString(record, 'stem')
  const correctOptionId = readString(record, 'correctOptionId')
  if (!id || !subjectId || !stem || !correctOptionId) return null
  const options = readOptions(record)
  if (options.length < 2) return null
  const difficultyValue = readString(record, 'difficulty')
  const difficulty = difficultyValue === 'Fácil' || difficultyValue === 'Media' || difficultyValue === 'Difícil' ? difficultyValue : 'Media'
  return {
    id,
    subjectId,
    topicId: readString(record, 'topicId'),
    subtopicId: readString(record, 'subtopicId'),
    stem,
    options,
    correctOptionId,
    explanation: readString(record, 'explanation') ?? '',
    distractorExplanations: asRecord(record.distractorExplanations) as Record<string, string>,
    difficulty,
    sourceType: 'demo',
    sourceIds: readStringList(record, 'sourceIds'),
    year: null,
    examVersionId: readString(record, 'examVersionId'),
    tags: readStringList(record, 'tags'),
    createdAt: new Date(0).toISOString(),
    isDemo: true,
  }
}

export function normalizeFlashcardRecord(record: Record<string, unknown>): Flashcard | null {
  const id = readString(record, 'id')
  const subjectId = readString(record, 'subjectId')
  const front = readString(record, 'front')
  const back = readString(record, 'back')
  if (!id || !subjectId || !front || !back) return null
  return {
    id,
    questionId: readString(record, 'questionId'),
    errorId: null,
    subjectId,
    topicId: readString(record, 'topicId'),
    subtopicId: readString(record, 'subtopicId'),
    origin: 'manual',
    sourceIds: readStringList(record, 'sourceIds'),
    tags: readStringList(record, 'tags'),
    front,
    back,
    ease: 2.3,
    intervalDays: 0,
    dueAt: new Date(0).toISOString(),
    reps: 0,
    lapses: 0,
    createdAt: new Date(0).toISOString(),
    lastReviewedAt: null,
    isDemo: true,
  }
}

export function normalizeSubjectRecord(record: Record<string, unknown>): Subject | null {
  const id = readString(record, 'id')
  const label = readString(record, 'label')
  const blockId = readString(record, 'blockId')
  if (!id || !label || !blockId) return null
  return {
    id,
    label,
    blockId: blockId as Subject['blockId'],
    order: Number(record.order ?? 0) || 0,
    contentStatus: 'imported',
    isDemo: false,
    notes: readString(record, 'notes'),
  }
}

export function normalizeTopicRecord(record: Record<string, unknown>): Topic | null {
  const id = readString(record, 'id')
  const subjectId = readString(record, 'subjectId')
  const label = readString(record, 'label')
  if (!id || !subjectId || !label) return null
  return { id, subjectId, label, order: Number(record.order ?? 0) || 0, contentStatus: 'imported', isDemo: false }
}

export function normalizeSubtopicRecord(record: Record<string, unknown>): Subtopic | null {
  const id = readString(record, 'id')
  const topicId = readString(record, 'topicId')
  const subjectId = readString(record, 'subjectId')
  const label = readString(record, 'label')
  if (!id || !topicId || !subjectId || !label) return null
  return { id, topicId, subjectId, label, order: Number(record.order ?? 0) || 0, contentStatus: 'imported', isDemo: false }
}

export function normalizeContentBlockRecord(record: Record<string, unknown>): ContentBlock | null {
  const id = readString(record, 'id')
  const subjectId = readString(record, 'subjectId')
  const topicId = readString(record, 'topicId')
  const title = readString(record, 'title')
  if (!id || !subjectId || !topicId || !title) return null
  const kindValue = readString(record, 'kind')
  const kinds: ContentBlock['kind'][] = ['summary', 'note', 'reference', 'image', 'algorithm', 'table']
  const kind = kinds.includes(kindValue as ContentBlock['kind']) ? (kindValue as ContentBlock['kind']) : 'note'
  return {
    id,
    subjectId,
    topicId,
    subtopicId: readString(record, 'subtopicId'),
    kind,
    title,
    body: readString(record, 'body') ?? '',
    sourceIds: readStringList(record, 'sourceIds'),
    contentStatus: 'imported',
    isDemo: false,
  }
}

export function normalizeSourceRecord(record: Record<string, unknown>): SourceReference | null {
  const id = readString(record, 'id')
  const label = readString(record, 'label')
  const type = readString(record, 'type')
  if (!id || !label || !type) return null
  const types: SourceReference['type'][] = ['demo', 'manual', 'authorized', 'historical', 'ai']
  return {
    id,
    type: types.includes(type as SourceReference['type']) ? (type as SourceReference['type']) : 'manual',
    label,
    citation: readString(record, 'citation'),
    url: readString(record, 'url'),
    year: record.year === undefined || record.year === null || record.year === '' ? null : Number(record.year),
    examVersionId: readString(record, 'examVersionId'),
    notes: readString(record, 'notes'),
  }
}

export function normalizeTagRecord(record: Record<string, unknown>): Tag | null {
  const id = readString(record, 'id')
  const label = readString(record, 'label')
  if (!id || !label) return null
  const kindValue = readString(record, 'kind')
  const kinds: Tag['kind'][] = ['subject', 'topic', 'difficulty', 'year', 'custom']
  return { id, label, kind: kinds.includes(kindValue as Tag['kind']) ? (kindValue as Tag['kind']) : 'custom' }
}

function createImporter(config: {
  entity: ImportEntity
  requiredFields: string[]
  normalize: (record: Record<string, unknown>) => { id: string } | null
  validate?: (record: Record<string, unknown>, entityId: string, context: ImportValidationContext) => ImportIssue[]
}): Importer {
  return {
    entity: config.entity,
    requiredFields: config.requiredFields,
    import: (text, format, context) => {
      const parsed = parseImport(text, format, config.entity)
      const issues: ImportIssue[] = [...parsed.issues]

      const expected = context.expectedSchemaVersion ?? 2
      if (parsed.schemaVersion !== null && parsed.schemaVersion !== expected) {
        issues.push(
          issue(config.entity, 'unsupported-version', 'Versión de esquema no soportada: ' + String(parsed.schemaVersion) + '. Se esperaba ' + String(expected) + '.'),
        )
      }

      const existingIds = new Set(context.existingIds ?? [])
      const seenIds = new Set<string>()
      let validCount = 0

      for (const record of parsed.records) {
        const normalized = config.normalize(record)
        const rawId = readString(record, 'id')
        if (!normalized) {
          issues.push(
            issue(config.entity, 'invalid-record', 'Registro inválido o incompleto. Campos obligatorios: ' + config.requiredFields.join(', ') + '.', { entityId: rawId ?? undefined }),
          )
          continue
        }
        if (seenIds.has(normalized.id)) {
          issues.push(issue(config.entity, 'duplicate-id', 'Identificador duplicado en el archivo: ' + normalized.id + '.', { entityId: normalized.id, field: 'id' }))
          continue
        }
        if (existingIds.has(normalized.id)) {
          issues.push(issue(config.entity, 'duplicate-id', 'Identificador ya existente: ' + normalized.id + '.', { entityId: normalized.id, field: 'id' }))
          continue
        }
        seenIds.add(normalized.id)
        if (config.validate) issues.push(...config.validate(record, normalized.id, context))
        validCount += 1
      }

      const referenceProblems = findBrokenReferences(context.bundle).length
      if (referenceProblems > 0) {
        issues.push(
          issue(config.entity, 'bundle-references', 'El contenido base tiene ' + String(referenceProblems) + ' referencias rotas.', { severity: 'warning' }),
        )
      }

      return {
        ok: issues.every((entry) => entry.severity !== 'error') && validCount > 0,
        entity: config.entity,
        format,
        schemaVersion: parsed.schemaVersion,
        recordCount: validCount,
        issues,
      }
    },
  }
}

export const QuestionImporter = createImporter({
  entity: 'questions',
  requiredFields: ['id', 'subjectId', 'stem', 'correctOptionId', 'options'],
  normalize: normalizeQuestionRecord,
  validate: (record, entityId, context) => {
    const normalized = normalizeQuestionRecord(record)
    if (!normalized) return []
    const issues = referenceIssues('questions', context.bundle, entityId, {
      subjectId: normalized.subjectId,
      topicId: normalized.topicId,
      subtopicId: normalized.subtopicId,
      sourceIds: normalized.sourceIds,
      tagIds: normalized.tags,
      examVersionId: normalized.examVersionId,
    })
    if (!normalized.options.some((option) => option.id === normalized.correctOptionId)) {
      issues.push(issue('questions', 'invalid-correct-option', 'correctOptionId no coincide con ninguna opción.', { entityId, field: 'correctOptionId' }))
    }
    return issues
  },
})

export const FlashcardImporter = createImporter({
  entity: 'flashcards',
  requiredFields: ['id', 'subjectId', 'front', 'back'],
  normalize: normalizeFlashcardRecord,
  validate: (record, entityId, context) => {
    const normalized = normalizeFlashcardRecord(record)
    if (!normalized) return []
    return referenceIssues('flashcards', context.bundle, entityId, {
      subjectId: normalized.subjectId,
      topicId: normalized.topicId,
      subtopicId: normalized.subtopicId,
      sourceIds: normalized.sourceIds,
      tagIds: normalized.tags,
    })
  },
})

export const CurriculumImporter = createImporter({
  entity: 'curriculum',
  requiredFields: ['id', 'label'],
  normalize: (record) => {
    if (readString(record, 'topicId')) return normalizeSubtopicRecord(record)
    if (readString(record, 'subjectId')) return normalizeTopicRecord(record)
    return normalizeSubjectRecord(record)
  },
  validate: (record, entityId, context) => {
    const subject = normalizeSubjectRecord(record)
    if (subject) {
      const issues: ImportIssue[] = []
      const permitted = createCurriculumIndex(context.bundle)
      if (!permitted.subjectsById && false) issues.push(issue('curriculum', 'unreachable', 'sin uso'))
      const blockIds = ['medicina', 'clinica', 'quirurgica', 'salud-publica', 'basicas', 'diagnostico', 'transversal']
      if (!blockIds.includes(subject.blockId)) {
        issues.push(issue('curriculum', 'invalid-block', 'Bloque desconocido: ' + subject.blockId + '.', { entityId, field: 'blockId' }))
      }
      return issues
    }
    const topic = normalizeTopicRecord(record)
    if (topic) {
      return referenceIssues('curriculum', context.bundle, entityId, { subjectId: topic.subjectId })
    }
    const subtopic = normalizeSubtopicRecord(record)
    if (subtopic) {
      return referenceIssues('curriculum', context.bundle, entityId, {
        subjectId: subtopic.subjectId,
        topicId: subtopic.topicId,
      })
    }
    return []
  },
})

export const ContentImporter = createImporter({
  entity: 'content',
  requiredFields: ['id'],
  normalize: (record) => {
    for (const normalize of [
      normalizeQuestionRecord,
      normalizeFlashcardRecord,
      normalizeContentBlockRecord,
      normalizeSourceRecord,
      normalizeTagRecord,
      normalizeSubtopicRecord,
      normalizeTopicRecord,
      normalizeSubjectRecord,
    ]) {
      const result = normalize(record)
      if (result) return result
    }
    return null
  },
  validate: (record, entityId, context) => {
    const question = normalizeQuestionRecord(record)
    if (question) {
      return referenceIssues('content', context.bundle, entityId, {
        subjectId: question.subjectId,
        topicId: question.topicId,
        subtopicId: question.subtopicId,
        sourceIds: question.sourceIds,
        tagIds: question.tags,
      })
    }
    const block = normalizeContentBlockRecord(record)
    if (block) {
      return referenceIssues('content', context.bundle, entityId, {
        subjectId: block.subjectId,
        topicId: block.topicId,
        subtopicId: block.subtopicId,
        sourceIds: block.sourceIds,
      })
    }
    return []
  },
})

export const importers = {
  content: ContentImporter,
  curriculum: CurriculumImporter,
  questions: QuestionImporter,
  flashcards: FlashcardImporter,
}

import { withTransaction } from './db'
import type { KnowledgeDatabase } from './db'
import { detectDuplicates, detectDuplicatesWithinBatch } from './duplicates'
import { normalizedTextHash, sha256, shortenId } from './ids'
import {
  insertClinicalDomain,
  insertDatasetQuestion,
  insertDatasetVersion,
  insertDocumentVersion,
  insertExtractionResult,
  insertHistoricalExam,
  insertHistoricalQuestion,
  insertQuestionOption,
  insertQuarantineQuestion,
  insertSourceDocument,
  updateDatasetStatus,
} from './repositories'

export const knowledgeImportStages = [
  'INPUT',
  'VALIDATE',
  'NORMALIZE',
  'IDENTIFY',
  'DEDUPLICATE',
  'DECIDE',
  'DATASET_VERSION',
] as const

export type KnowledgeImportStage = (typeof knowledgeImportStages)[number]

export type ImportOption = { label: string; text: string; correct: boolean }

export type ImportRecord = {
  questionNumber: number
  stem: string
  options: ImportOption[]
  page: number | null
  rawText: string | null
  confidence: number | null
  difficulty: 'Facil' | 'Media' | 'Dificil' | null
}

export type ImportDocumentDescriptor = {
  title: string
  fileName: string
  mimeType: string
  sha256?: string
  pageCount?: number | null
}

export type KnowledgeImportInput = {
  kind: 'json' | 'csv' | 'extraction-result'
  content: string
  datasetName: string
  datasetVersion: number
  taxonomyVersion: string
  examVersion: string
  examYear: number | null
  document: ImportDocumentDescriptor
  now: Date
  confidenceThreshold?: number
  domains?: Array<{ id: string; label: string; orderIndex: number }>
}

export type ImportRecordOutcome = {
  index: number
  questionId: string | null
  decision: 'accepted' | 'quarantined' | 'rejected'
  issues: string[]
  duplicateOf: string | null
}

export type KnowledgeImportReport = {
  ok: boolean
  stages: Array<{ stage: KnowledgeImportStage; summary: string }>
  records: ImportRecordOutcome[]
  counts: { total: number; accepted: number; quarantined: number; rejected: number; duplicates: number }
  datasetVersionId: string | null
  datasetStatus: string | null
  issues: string[]
}

export const defaultConfidenceThreshold = 0.8

function splitCsvRows(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
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
    if (char === String.fromCharCode(10)) {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    if (char !== String.fromCharCode(13)) field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0))
}

export function parseKnowledgeJson(content: string): { records: unknown[]; issues: string[] } {
  try {
    const parsed: unknown = JSON.parse(content)
    if (Array.isArray(parsed)) return { records: parsed, issues: [] }
    if (typeof parsed === 'object' && parsed !== null) {
      const container = parsed as { records?: unknown }
      if (Array.isArray(container.records)) return { records: container.records, issues: [] }
    }
    return { records: [], issues: ['El JSON no contiene una lista de registros.'] }
  } catch {
    return { records: [], issues: ['JSON inválido.'] }
  }
}

export function parseKnowledgeCsv(content: string): { records: Array<Record<string, string>>; issues: string[] } {
  const rows = splitCsvRows(content)
  if (rows.length < 2) return { records: [], issues: ['CSV sin filas de datos.'] }
  const headers = rows[0].map((header) => header.trim())
  const records: Array<Record<string, string>> = []
  for (const row of rows.slice(1)) {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? '').trim()
    })
    records.push(record)
  }
  return { records, issues: [] }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function optionsFromRecord(record: Record<string, unknown>): ImportOption[] {
  const direct = record.options
  if (Array.isArray(direct)) {
    return direct.map((value) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
      return {
        label: String(item.label ?? ''),
        text: String(item.text ?? ''),
        correct: item.correct === true,
      }
    })
  }
  const options: ImportOption[] = []
  for (const label of ['A', 'B', 'C', 'D', 'E']) {
    const text = readString(record, 'option' + label)
    if (text) options.push({ label, text, correct: readString(record, 'correctOption') === label })
  }
  return options
}

export function toImportRecords(records: unknown[]): ImportRecord[] {
  return records.map((value) => {
    const record = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
    const difficultyRaw = readString(record, 'difficulty')
    const difficulty =
      difficultyRaw === 'Facil' || difficultyRaw === 'Media' || difficultyRaw === 'Dificil' ? difficultyRaw : null
    return {
      questionNumber: readNumber(record, 'questionNumber') ?? readNumber(record, 'originalQuestionNumber') ?? 0,
      stem: readString(record, 'stem') ?? '',
      options: optionsFromRecord(record),
      page: readNumber(record, 'page'),
      rawText: readString(record, 'rawText') ?? readString(record, 'text'),
      confidence: readNumber(record, 'confidence'),
      difficulty,
    }
  })
}

export function validateImportRecord(record: ImportRecord): string[] {
  const issues: string[] = []
  if (record.questionNumber <= 0) issues.push('questionNumber inválido')
  if (record.stem.trim().length === 0) issues.push('stem ausente')
  if (record.options.length < 2) issues.push('menos de dos opciones')
  const correct = record.options.filter((option) => option.correct).length
  if (correct === 0) issues.push('sin respuesta correcta marcada')
  if (correct > 1) issues.push('múltiples respuestas correctas marcadas')
  if (record.options.some((option) => option.text.trim().length === 0)) issues.push('opción sin texto')
  if (record.page === null && (record.rawText === null || record.rawText.trim().length === 0)) {
    issues.push('sin procedencia: falta página y texto original')
  }
  return issues
}

export function normalizeImportRecord(record: ImportRecord): ImportRecord {
  return {
    ...record,
    stem: record.stem.trim(),
    rawText: record.rawText === null ? null : record.rawText.trim(),
    options: record.options.map((option, index) => ({
      label: option.label.trim().length > 0 ? option.label.trim() : String.fromCharCode(65 + index),
      text: option.text.trim(),
      correct: option.correct,
    })),
  }
}

export function createMockJsonInput(now: Date): KnowledgeImportInput {
  const records = [
    { questionNumber: 1, stem: 'Enunciado DEMO de prueba técnica número uno.', optionA: 'Opción A', optionB: 'Opción B', optionC: 'Opción C', correctOption: 'A', page: 1, confidence: 0.95, difficulty: 'Media' },
    { questionNumber: 2, stem: 'Enunciado DEMO de prueba técnica número dos.', optionA: 'Opción A', optionB: 'Opción B', correctOption: 'B', page: 2, confidence: 0.42, difficulty: 'Facil' },
    { questionNumber: 3, stem: 'Enunciado DEMO de prueba técnica número tres.', optionA: 'Opción A', correctOption: 'A', page: 3, confidence: 0.9 },
    { questionNumber: 4, stem: 'Enunciado DEMO de prueba técnica número uno.', optionA: 'Opción A', optionB: 'Opción B', correctOption: 'A', page: 1, confidence: 0.95 },
  ]
  return {
    kind: 'json',
    content: JSON.stringify({ records }),
    datasetName: 'demo-dataset',
    datasetVersion: 1,
    taxonomyVersion: 'taxonomy-demo-1',
    examVersion: 'DEMO-1',
    examYear: null,
    document: { title: 'Material DEMO de prueba', fileName: 'demo-material.txt', mimeType: 'text/plain', pageCount: 3 },
    now,
    domains: [{ id: 'clinical-domain-01', label: 'Dominio clínico 01 (pendiente de nombrar)', orderIndex: 1 }],
  }
}

export function createMockCsvInput(now: Date): KnowledgeImportInput {
  const lines = [
    'questionNumber,stem,optionA,optionB,correctOption,page,confidence',
    '1,Enunciado DEMO en CSV uno,Opción A,Opción B,A,1,0.9',
    '2,Enunciado DEMO en CSV dos,Opción A,Opción B,,2,0.9',
  ]
  return { ...createMockJsonInput(now), kind: 'csv', content: lines.join(String.fromCharCode(10)) }
}

export function createMockExtractionInput(now: Date): KnowledgeImportInput {
  const records = [
    { questionNumber: 1, stem: 'Enunciado DEMO extraído de un resultado de extracción.', optionA: 'Opción A', optionB: 'Opción B', correctOption: 'A', rawText: 'Bloque DEMO sin contenido clínico.', confidence: 0.88 },
    { questionNumber: 2, stem: 'Enunciado DEMO extraído con baja confianza.', optionA: 'Opción A', optionB: 'Opción B', correctOption: 'B', rawText: 'Bloque DEMO dudoso.', confidence: 0.35 },
  ]
  return { ...createMockJsonInput(now), kind: 'extraction-result', content: JSON.stringify({ records }) }
}

export function runKnowledgeImport(database: KnowledgeDatabase, input: KnowledgeImportInput): KnowledgeImportReport {
  const threshold = input.confidenceThreshold ?? defaultConfidenceThreshold
  const stages: Array<{ stage: KnowledgeImportStage; summary: string }> = []
  const issues: string[] = []

  // INPUT
  const parsed =
    input.kind === 'csv' ? parseKnowledgeCsv(input.content) : parseKnowledgeJson(input.content)
  issues.push(...parsed.issues)
  const rawRecords = parsed.records
  stages.push({ stage: 'INPUT', summary: rawRecords.length + ' registros leídos en formato ' + input.kind })

  // VALIDATE
  const validated = toImportRecords(rawRecords)
  stages.push({ stage: 'VALIDATE', summary: validated.length + ' registros convertidos a forma interna' })

  // NORMALIZE
  const normalized = validated.map((record) => normalizeImportRecord(record))
  stages.push({ stage: 'NORMALIZE', summary: 'texto y etiquetas normalizados' })

  // IDENTIFY
  const identified = normalized.map((record) => ({
    record,
    internalId: shortenId('hq', [input.examVersion, String(input.examYear), String(record.questionNumber), normalizedTextHash(record.stem)].join('|'), 20),
  }))
  stages.push({ stage: 'IDENTIFY', summary: 'identidad interna derivada para ' + identified.length + ' registros' })

  // DEDUPLICATE
  const withinBatch = detectDuplicatesWithinBatch(identified.map((item) => item.record.stem))
  const duplicateIndexes = new Map<number, number>()
  for (const found of withinBatch) duplicateIndexes.set(found.index, found.matchesIndex)
  const databaseDuplicates = new Map<number, string>()
  identified.forEach((item, index) => {
    const matches = detectDuplicates(database, { stem: item.record.stem })
    if (matches.length > 0) databaseDuplicates.set(index, matches[0].existingQuestionId)
  })
  stages.push({
    stage: 'DEDUPLICATE',
    summary: withinBatch.length + ' duplicados en el lote, ' + databaseDuplicates.size + ' ya presentes en el warehouse',
  })

  // DECIDE
  const outcomes: ImportRecordOutcome[] = []
  const decisions: Array<{ index: number; record: ImportRecord; internalId: string; decision: 'accepted' | 'quarantined' | 'rejected'; issues: string[] }> = []

  identified.forEach((item, index) => {
    const validationIssues = validateImportRecord(item.record)
    const duplicateWithinBatch = duplicateIndexes.get(index)
    const duplicateInDatabase = databaseDuplicates.get(index)

    if (duplicateWithinBatch !== undefined || duplicateInDatabase !== undefined) {
      outcomes.push({
        index,
        questionId: null,
        decision: 'rejected',
        issues: ['duplicado: ' + (duplicateWithinBatch !== undefined ? 'mismo lote' : 'existente en el warehouse')],
        duplicateOf: duplicateInDatabase ?? identified[duplicateWithinBatch ?? 0].internalId,
      })
      return
    }

    if (validationIssues.length > 0) {
      outcomes.push({ index, questionId: null, decision: 'rejected', issues: validationIssues, duplicateOf: null })
      return
    }

    const lowConfidence = item.record.confidence !== null && item.record.confidence < threshold
    const decision: 'accepted' | 'quarantined' = lowConfidence ? 'quarantined' : 'accepted'
    decisions.push({ index, record: item.record, internalId: item.internalId, decision, issues: lowConfidence ? ['confianza por debajo del umbral'] : [] })
    outcomes.push({ index, questionId: item.internalId, decision, issues: lowConfidence ? ['confianza por debajo del umbral'] : [], duplicateOf: null })
  })

  const acceptedCount = decisions.filter((item) => item.decision === 'accepted').length
  const quarantinedCount = decisions.filter((item) => item.decision === 'quarantined').length
  const rejectedCount = outcomes.filter((item) => item.decision === 'rejected').length

  stages.push({
    stage: 'DECIDE',
    summary: 'aceptadas ' + acceptedCount + ', cuarentena ' + quarantinedCount + ', rechazadas ' + rejectedCount,
  })

  // DATASET_VERSION + persistencia
  const documentSha = input.document.sha256 ?? sha256(input.document.fileName + '|' + input.content)
  let datasetVersionId: string | null = null
  let datasetStatus: string | null = null

  withTransaction(database, () => {
    for (const domain of input.domains ?? []) {
      insertClinicalDomain(database, {
        id: domain.id,
        label: domain.label,
        orderIndex: domain.orderIndex,
        taxonomyVersion: input.taxonomyVersion,
        now: input.now,
      })
    }

    const documentId = insertSourceDocument(database, {
      title: input.document.title,
      fileName: input.document.fileName,
      mimeType: input.document.mimeType,
      sha256: documentSha,
      pageCount: input.document.pageCount ?? null,
      now: input.now,
      sourceType: 'demo',
      isDemo: true,
    })
    const versionId = insertDocumentVersion(database, {
      documentId,
      versionLabel: 'v1',
      sha256: documentSha,
      now: input.now,
    })
    const examId = insertHistoricalExam(database, {
      examVersion: input.examVersion,
      examYear: input.examYear,
      label: input.examVersion,
      documentId,
      documentVersionId: versionId,
      questionCount: decisions.length,
      now: input.now,
      isDemo: true,
    })

    datasetVersionId = insertDatasetVersion(database, {
      name: input.datasetName,
      version: input.datasetVersion,
      taxonomyVersion: input.taxonomyVersion,
      now: input.now,
      sourceHashes: [documentSha],
      questionCount: decisions.length,
      acceptedCount,
      quarantineCount: quarantinedCount,
      rejectedCount,
      status: 'processing',
    })

    decisions.forEach((item, position) => {
      const inserted = insertHistoricalQuestion(database, {
        examId,
        examVersion: input.examVersion,
        originalQuestionNumber: item.record.questionNumber,
        stem: item.record.stem,
        documentId,
        documentVersionId: versionId,
        page: item.record.page,
        rawText: item.record.rawText,
        difficulty: item.record.difficulty,
        validationStatus: item.decision,
        now: input.now,
      })
      for (const option of item.record.options) {
        insertQuestionOption(database, {
          questionId: inserted.id,
          optionLabel: option.label,
          text: option.text,
          orderIndex: item.record.options.indexOf(option),
          isCorrect: option.correct,
        })
      }
      insertDatasetQuestion(database, { datasetVersionId: datasetVersionId as string, questionId: inserted.id, position })

      const extractionId = insertExtractionResult(database, {
        sourceDocumentId: documentId,
        documentVersionId: versionId,
        historicalQuestionId: inserted.id,
        rawText: item.record.rawText ?? item.record.stem,
        page: item.record.page,
        confidence: item.record.confidence,
        validationStatus: item.decision,
        validationErrors: item.issues,
        now: input.now,
      })

      if (item.decision === 'quarantined') {
        insertQuarantineQuestion(database, {
          extractionResultId: extractionId,
          historicalQuestionId: inserted.id,
          sourceDocumentId: documentId,
          rawText: item.record.rawText ?? item.record.stem,
          page: item.record.page,
          confidence: item.record.confidence,
          validationErrors: item.issues,
          now: input.now,
        })
      }
    })

    const finalStatus = quarantinedCount === 0 && rejectedCount === 0 ? 'accepted' : 'review'
    updateDatasetStatus(database, datasetVersionId as string, finalStatus)
    datasetStatus = finalStatus
  })

  stages.push({
    stage: 'DATASET_VERSION',
    summary: 'dataset ' + String(input.datasetName) + ' v' + String(input.datasetVersion) + ' en estado ' + String(datasetStatus),
  })

  const counts = {
    total: identified.length,
    accepted: acceptedCount,
    quarantined: quarantinedCount,
    rejected: rejectedCount,
    duplicates: databaseDuplicates.size + withinBatch.length,
  }

  issues.push(...outcomes.flatMap((outcome) => outcome.issues.map((message) => 'registro ' + String(outcome.index) + ': ' + message)))

  return {
    ok: issues.length === 0 && acceptedCount > 0,
    stages,
    records: outcomes,
    counts,
    datasetVersionId,
    datasetStatus,
    issues,
  }
}

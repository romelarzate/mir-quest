import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  closeKnowledgeDatabase,
  currentKnowledgeSchemaVersion,
  declaredKnowledgeSchemaVersion,
  listKnowledgeIndexes,
  listKnowledgeTables,
  listKnowledgeViews,
  openKnowledgeDatabase,
} from './db'
import { knowledgeMigrations, knowledgeMigrationRules } from './migrations'
import { knowledgeSchemaStatements, knowledgeTableNames, knowledgeViewNames, knowledgeIndexNames } from './schema'
import {
  countQuestionsByStatus,
  countUsableQuestions,
  getDocumentVersionByLabel,
  getHistoricalExam,
  getHistoricalQuestion,
  getSourceDocument,
  insertDatasetQuestion,
  insertDatasetVersion,
  insertDocumentVersion,
  insertHistoricalExam,
  insertHistoricalQuestion,
  insertQuestionOption,
  insertSourceDocument,
  listDatasetQuestionIds,
  listQuestionOptions,
  listQuarantine,
  listQuestionsByExam,
  listUsableQuestions,
  updateDatasetStatus,
} from './repositories'
import { assertQuarantineIsolation, runKnowledgeIntegrityChecks, usableQuestionIds, violatingQuarantineQuestionIds } from './integrity'
import { detectDuplicates, duplicatePolicy, findExactHashDuplicate, findNormalizedTextDuplicate, findSemanticDuplicates } from './duplicates'
import { createKnowledgeSnapshot, serializeKnowledgeSnapshot, snapshotFilename, snapshotRules, snapshotSummary, verifyKnowledgeSnapshot } from './snapshots'
import { buildHistoricalQuestionId, normalizeText, sha256 } from './ids'

const now = new Date('2026-09-29T09:00:00.000Z')
const documentHash = sha256('documento-demo')

function fresh() {
  return openKnowledgeDatabase({ path: ':memory:', now: () => now })
}

function seedDocument(database: ReturnType<typeof fresh>) {
  const documentId = insertSourceDocument(database, {
    title: 'Material DEMO de prueba',
    fileName: 'demo.txt',
    mimeType: 'text/plain',
    sha256: documentHash,
    now,
  })
  const versionId = insertDocumentVersion(database, { documentId, versionLabel: 'v1', sha256: documentHash, now })
  const examId = insertHistoricalExam(database, {
    examVersion: 'DEMO-1',
    examYear: null,
    label: 'DEMO-1',
    documentId,
    documentVersionId: versionId,
    questionCount: 2,
    now,
  })
  return { documentId, versionId, examId }
}

function seedQuestion(
  database: ReturnType<typeof fresh>,
  context: { documentId: string; versionId: string; examId: string },
  options: { stem: string; number: number; status?: 'accepted' | 'quarantined' | 'rejected' },
) {
  const inserted = insertHistoricalQuestion(database, {
    examId: context.examId,
    examVersion: 'DEMO-1',
    originalQuestionNumber: options.number,
    stem: options.stem,
    documentId: context.documentId,
    documentVersionId: context.versionId,
    page: options.number,
    validationStatus: options.status ?? 'accepted',
    now,
  })
  insertQuestionOption(database, { questionId: inserted.id, optionLabel: 'A', text: 'Opción A', orderIndex: 0, isCorrect: true })
  insertQuestionOption(database, { questionId: inserted.id, optionLabel: 'B', text: 'Opción B', orderIndex: 1 })
  return inserted
}

describe('migraciones del warehouse', () => {
  it('aplica el esquema una sola vez y registra la versión', () => {
    const database = fresh()
    expect(currentKnowledgeSchemaVersion(database)).toBe(declaredKnowledgeSchemaVersion())
    const rows = database.prepare('SELECT version FROM knowledge_migrations').all() as Array<{ version: number }>
    expect(rows.length).toBe(knowledgeMigrations.length)
    closeKnowledgeDatabase(database)
  })

  it('declara migraciones contiguas desde la versión 1', () => {
    const versions = knowledgeMigrations.map((migration) => migration.version).sort((a, b) => a - b)
    expect(versions[0]).toBe(1)
    expect(versions.length).toBe(declaredKnowledgeSchemaVersion())
    expect(knowledgeMigrationRules.some((rule) => rule.indexOf('StudyState') !== -1)).toBe(true)
  })
})

describe('esquema físico', () => {
  it('crea todas las tablas declaradas', () => {
    const database = fresh()
    const tables = listKnowledgeTables(database)
    for (const table of knowledgeTableNames) expect(tables).toContain(table)
    closeKnowledgeDatabase(database)
  })

  it('crea índices y la vista de aislamiento', () => {
    const database = fresh()
    const indexes = listKnowledgeIndexes(database)
    for (const index of knowledgeIndexNames) expect(indexes).toContain(index)
    expect(listKnowledgeViews(database)).toEqual(expect.arrayContaining(knowledgeViewNames))
    expect(knowledgeSchemaStatements.length).toBeGreaterThan(0)
    closeKnowledgeDatabase(database)
  })
})

describe('documentos y versiones', () => {
  it('crea documento y versión y los recupera', () => {
    const database = fresh()
    const context = seedDocument(database)
    expect(getSourceDocument(database, context.documentId)?.title).toBe('Material DEMO de prueba')
    expect(getDocumentVersionByLabel(database, context.documentId, 'v1')?.sha256).toBe(documentHash)
    expect(getHistoricalExam(database, context.examId)?.exam_version).toBe('DEMO-1')
    closeKnowledgeDatabase(database)
  })

  it('rechaza un documento sin hash válido', () => {
    const database = fresh()
    expect(() =>
      insertSourceDocument(database, { title: 'x', fileName: 'x.txt', mimeType: 'text/plain', sha256: 'corto', now }),
    ).toThrow()
    closeKnowledgeDatabase(database)
  })

  it('rechaza una versión sin documento padre', () => {
    const database = fresh()
    expect(() => insertDocumentVersion(database, { documentId: 'no-existe', versionLabel: 'v1', sha256: documentHash, now })).toThrow()
    closeKnowledgeDatabase(database)
  })
})

describe('preguntas y opciones', () => {
  it('crea pregunta con opciones y recupera la secuencia', () => {
    const database = fresh()
    const context = seedDocument(database)
    const first = seedQuestion(database, context, { stem: 'Enunciado DEMO uno.', number: 1 })
    seedQuestion(database, context, { stem: 'Enunciado DEMO dos.', number: 2 })
    expect(getHistoricalQuestion(database, first.id)?.stem).toBe('Enunciado DEMO uno.')
    expect(listQuestionOptions(database, first.id).length).toBe(2)
    expect(listQuestionsByExam(database, context.examId).length).toBe(2)
    closeKnowledgeDatabase(database)
  })

  it('aplica integridad referencial al examen', () => {
    const database = fresh()
    const context = seedDocument(database)
    expect(() =>
      insertHistoricalQuestion(database, {
        examId: 'examen-inexistente',
        examVersion: 'DEMO-1',
        originalQuestionNumber: 1,
        stem: 'x',
        documentId: context.documentId,
        documentVersionId: context.versionId,
        page: 1,
        now,
      }),
    ).toThrow()
    closeKnowledgeDatabase(database)
  })

  it('exige procedencia: documento, versión y al menos un rastro', () => {
    const database = fresh()
    const context = seedDocument(database)
    expect(() =>
      insertHistoricalQuestion(database, {
        examId: context.examId,
        examVersion: 'DEMO-1',
        originalQuestionNumber: 9,
        stem: 'Sin procedencia',
        documentId: 'documento-inexistente',
        documentVersionId: context.versionId,
        page: 1,
        now,
      }),
    ).toThrow()
    expect(() =>
      insertHistoricalQuestion(database, {
        examId: context.examId,
        examVersion: 'DEMO-1',
        originalQuestionNumber: 10,
        stem: 'Sin rastro',
        documentId: context.documentId,
        documentVersionId: context.versionId,
        now,
      }),
    ).toThrow()
    closeKnowledgeDatabase(database)
  })

  it('calcula identidad interna independiente del año y del número', () => {
    const first = buildHistoricalQuestionId({ examId: 'e1', examVersion: 'DEMO-1', originalQuestionNumber: 1, stem: 'Texto' })
    const second = buildHistoricalQuestionId({ examId: 'e1', examVersion: 'DEMO-2', originalQuestionNumber: 1, stem: 'Texto' })
    expect(first).not.toBe(second)
    expect(first.startsWith('hq_')).toBe(true)
  })
})

describe('duplicados', () => {
  it('detecta duplicado exacto y textual', () => {
    const database = fresh()
    const context = seedDocument(database)
    seedQuestion(database, context, { stem: 'Enunciado DEMO repetible.', number: 1 })
    const exact = findExactHashDuplicate(database, { stem: 'Enunciado DEMO repetible.' })
    expect(exact?.kind).toBe('exact-hash')
    const textual = findNormalizedTextDuplicate(database, 'ENUNCIADO DEMO repetible!!!')
    expect(textual?.kind).toBe('normalized-text')
    expect(detectDuplicates(database, { stem: 'Enunciado DEMO repetible.' }).length).toBe(2)
    closeKnowledgeDatabase(database)
  })

  it('no encuentra duplicado en texto distinto', () => {
    const database = fresh()
    const context = seedDocument(database)
    seedQuestion(database, context, { stem: 'Enunciado DEMO distinto.', number: 1 })
    expect(detectDuplicates(database, { stem: 'Otro enunciado completamente diferente.' })).toEqual([])
    closeKnowledgeDatabase(database)
  })

  it('prepara el duplicado semántico sin implementarlo', () => {
    const database = fresh()
    const result = findSemanticDuplicates(database, { text: 'texto' })
    expect(result.implemented).toBe(false)
    expect(result.matches).toEqual([])
    expect(duplicatePolicy.length).toBe(4)
    expect(normalizeText('Árítmia, ¿crónica?')).toBe('aritmia cronica')
    closeKnowledgeDatabase(database)
  })
})

describe('aislamiento de cuarentena', () => {
  it('una pregunta aceptada pasa a no utilizable si entra en cuarentena pendiente', () => {
    const database = fresh()
    const context = seedDocument(database)
    const question = seedQuestion(database, context, { stem: 'Enunciado DEMO con cuarentena.', number: 1 })
    expect(usableQuestionIds(database)).toContain(question.id)
    expect(violatingQuarantineQuestionIds(database, [question.id])).toEqual([])

    database
      .prepare(
        'INSERT INTO extraction_result (id, historical_question_id, source_document_id, validation_status, validation_errors_json, raw_text, extracted_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run('ext-1', question.id, context.documentId, 'quarantined', '[]', 'texto DEMO', now.toISOString())
    database
      .prepare(
        'INSERT INTO quarantine_question (id, extraction_result_id, historical_question_id, raw_text, source_document_id, review_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run('quar-1', 'ext-1', question.id, 'texto DEMO', context.documentId, 'pending', now.toISOString())

    expect(usableQuestionIds(database)).not.toContain(question.id)
    expect(violatingQuarantineQuestionIds(database, [question.id])).toEqual([question.id])
    expect(() => assertQuarantineIsolation(database, [question.id])).toThrow()
    expect(countUsableQuestions(database)).toBe(0)
    expect(listUsableQuestions(database)).toEqual([])
    closeKnowledgeDatabase(database)
  })

  it('cuenta preguntas por estado y lista cuarentena', () => {
    const database = fresh()
    const context = seedDocument(database)
    seedQuestion(database, context, { stem: 'Aceptada DEMO.', number: 1 })
    seedQuestion(database, context, { stem: 'En cuarentena DEMO.', number: 2, status: 'quarantined' })
    expect(countQuestionsByStatus(database)).toEqual({ accepted: 1, quarantined: 1, rejected: 0 })
    expect(listQuarantine(database).length).toBe(0)
    closeKnowledgeDatabase(database)
  })
})

describe('integridad', () => {
  it('detecta examen sin preguntas', () => {
    const database = fresh()
    seedDocument(database)
    const report = runKnowledgeIntegrityChecks(database)
    expect(report.ok).toBe(false)
    expect(report.issues.some((issue) => issue.code === 'exam-without-questions')).toBe(true)
    closeKnowledgeDatabase(database)
  })

  it('detecta pregunta sin respuesta correcta', () => {
    const database = fresh()
    const context = seedDocument(database)
    const inserted = insertHistoricalQuestion(database, {
      examId: context.examId,
      examVersion: 'DEMO-1',
      originalQuestionNumber: 1,
      stem: 'Sin respuesta marcada.',
      documentId: context.documentId,
      documentVersionId: context.versionId,
      page: 1,
      now,
    })
    insertQuestionOption(database, { questionId: inserted.id, optionLabel: 'A', text: 'Opción A', orderIndex: 0 })
    const report = runKnowledgeIntegrityChecks(database)
    expect(report.issues.some((issue) => issue.code === 'question-without-answer')).toBe(true)
    closeKnowledgeDatabase(database)
  })

  it('avisa de huecos en la secuencia sin marcarlos como error', () => {
    const database = fresh()
    const context = seedDocument(database)
    seedQuestion(database, context, { stem: 'Primera DEMO.', number: 1 })
    seedQuestion(database, context, { stem: 'Tercera DEMO.', number: 3 })
    const report = runKnowledgeIntegrityChecks(database)
    expect(report.issues.some((issue) => issue.code === 'question-sequence-gap')).toBe(true)
    expect(report.ok).toBe(true)
    closeKnowledgeDatabase(database)
  })

  it('acepta un warehouse coherente', () => {
    const database = fresh()
    const context = seedDocument(database)
    seedQuestion(database, context, { stem: 'Uno DEMO.', number: 1 })
    seedQuestion(database, context, { stem: 'Dos DEMO.', number: 2 })
    const report = runKnowledgeIntegrityChecks(database)
    expect(report.ok).toBe(true)
    expect(report.errorCount).toBe(0)
    closeKnowledgeDatabase(database)
  })
})

describe('dataset version y snapshots', () => {
  it('crea dataset, vincula preguntas y genera un snapshot verificable', () => {
    const database = fresh()
    const context = seedDocument(database)
    const first = seedQuestion(database, context, { stem: 'Primera DEMO.', number: 1 })
    const second = seedQuestion(database, context, { stem: 'Segunda DEMO.', number: 2 })
    const datasetId = insertDatasetVersion(database, {
      name: 'demo-dataset',
      version: 1,
      taxonomyVersion: 'taxonomy-demo-1',
      now,
      sourceHashes: [documentHash],
      questionCount: 2,
      acceptedCount: 2,
      status: 'review',
    })
    insertDatasetQuestion(database, { datasetVersionId: datasetId, questionId: first.id, position: 0 })
    insertDatasetQuestion(database, { datasetVersionId: datasetId, questionId: second.id, position: 1 })
    updateDatasetStatus(database, datasetId, 'accepted')

    expect(listDatasetQuestionIds(database, datasetId).length).toBe(2)
    const snapshot = createKnowledgeSnapshot(database, datasetId, now)
    expect(snapshot).not.toBeNull()
    expect(snapshot?.datasetVersion).toBe('demo-dataset@1')
    expect(snapshot?.questionIds.length).toBe(2)
    expect(snapshot?.hash.length).toBe(64)
    expect(verifyKnowledgeSnapshot(snapshot!, database).ok).toBe(true)
    expect(snapshotSummary(snapshot!)).toContain('demo-dataset@1')
    expect(snapshotFilename(snapshot!)).toContain('.json')
    expect(serializeKnowledgeSnapshot(snapshot!).length).toBeGreaterThan(0)
    expect(snapshotRules.length).toBe(4)
    closeKnowledgeDatabase(database)
  })

  it('es reproducible: mismo dataset y misma fecha producen el mismo hash', () => {
    const database = fresh()
    const context = seedDocument(database)
    const question = seedQuestion(database, context, { stem: 'Repetible DEMO.', number: 1 })
    const datasetId = insertDatasetVersion(database, { name: 'demo-dataset', version: 2, taxonomyVersion: 'taxonomy-demo-1', now })
    insertDatasetQuestion(database, { datasetVersionId: datasetId, questionId: question.id, position: 0 })
    const first = createKnowledgeSnapshot(database, datasetId, now)
    const second = createKnowledgeSnapshot(database, datasetId, now)
    expect(first?.hash).toBe(second?.hash)
    closeKnowledgeDatabase(database)
  })

  it('detecta un snapshot manipulado', () => {
    const database = fresh()
    const context = seedDocument(database)
    const question = seedQuestion(database, context, { stem: 'Snapshot DEMO.', number: 1 })
    const datasetId = insertDatasetVersion(database, { name: 'demo-dataset', version: 3, taxonomyVersion: 'taxonomy-demo-1', now })
    insertDatasetQuestion(database, { datasetVersionId: datasetId, questionId: question.id, position: 0 })
    const snapshot = createKnowledgeSnapshot(database, datasetId, now)!
    const tampered = { ...snapshot, questionIds: [...snapshot.questionIds, 'hq_inventada'] }
    const verification = verifyKnowledgeSnapshot(tampered, database)
    expect(verification.ok).toBe(false)
    closeKnowledgeDatabase(database)
  })

  it('no inventa snapshots de datasets inexistentes', () => {
    const database = fresh()
    expect(createKnowledgeSnapshot(database, 'no-existe', now)).toBeNull()
    closeKnowledgeDatabase(database)
  })
})

describe('frontera con el Study Domain', () => {
  it('el warehouse no importa React ni el estado de estudio', () => {
    const directory = join(process.cwd(), 'src', 'knowledge')
    const files = readdirSync(directory).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    expect(files.length).toBeGreaterThan(7)
    const quote = String.fromCharCode(39)
    const forbidden = [
      'react' + quote,
      quote + '../storage',
      quote + '../repositories',
      quote + '../domain/srs',
      quote + '../domain/selectors',
    ]
    const offenders: string[] = []
    for (const file of files) {
      const lines = readFileSync(join(directory, file), 'utf8').split(String.fromCharCode(10))
      for (const line of lines) {
        if (line.indexOf('import') === -1) continue
        for (const pattern of forbidden) {
          if (line.indexOf(pattern) !== -1) offenders.push(file + ' :: ' + line.trim())
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('solo menciona la clave del Study Domain como documentación de la separación', () => {
    const directory = join(process.cwd(), 'src', 'knowledge')
    const files = readdirSync(directory).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    const contents = files.map((file) => readFileSync(join(directory, file), 'utf8').toLowerCase())
    const studyKeyMentions = contents.filter((content) => content.indexOf('mir-quest-state') !== -1)
    expect(studyKeyMentions.length).toBe(1)
    expect(contents.some((content) => content.indexOf('localstorage') !== -1)).toBe(false)
    expect(contents.some((content) => content.indexOf('flashcard') !== -1)).toBe(false)
  })
})

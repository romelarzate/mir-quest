import { describe, expect, it } from 'vitest'
import { openKnowledgeDatabase } from './db'
import {
  createMockCsvInput,
  createMockExtractionInput,
  createMockJsonInput,
  knowledgeImportStages,
  parseKnowledgeCsv,
  parseKnowledgeJson,
  runKnowledgeImport,
  validateImportRecord,
} from './importPipeline'
import { listQuarantine, listUsableQuestions, getDatasetVersion } from './repositories'
import { runKnowledgeIntegrityChecks } from './integrity'
import { createKnowledgeSnapshot, verifyKnowledgeSnapshot } from './snapshots'

const now = new Date('2026-09-29T09:00:00.000Z')
const newline = String.fromCharCode(10)

function fresh() {
  return openKnowledgeDatabase({ path: ':memory:', now: () => now })
}

describe('etapas del pipeline', () => {
  it('declara las siete etapas en orden', () => {
    expect([...knowledgeImportStages]).toEqual([
      'INPUT',
      'VALIDATE',
      'NORMALIZE',
      'IDENTIFY',
      'DEDUPLICATE',
      'DECIDE',
      'DATASET_VERSION',
    ])
  })
})

describe('parsers de entrada', () => {
  it('lee JSON con contenedor o array', () => {
    expect(parseKnowledgeJson('{"records":[{"stem":"x"}]}').records.length).toBe(1)
    expect(parseKnowledgeJson('[{"stem":"x"}]').records.length).toBe(1)
    expect(parseKnowledgeJson('no json').issues.length).toBe(1)
    expect(parseKnowledgeJson('{}').issues.length).toBe(1)
  })

  it('lee CSV con comas entre comillas', () => {
    const csv = ['stem,optionA', '"Enunciado, con coma","Opción A"'].join(newline)
    const parsed = parseKnowledgeCsv(csv)
    expect(parsed.records[0].stem).toBe('Enunciado, con coma')
    expect(parseKnowledgeCsv('solo-cabecera').issues.length).toBe(1)
  })
})

describe('validación de registros', () => {
  it('exige número, enunciado, opciones, respuesta y procedencia', () => {
    const issues = validateImportRecord({
      questionNumber: 0,
      stem: '',
      options: [],
      page: null,
      rawText: null,
      confidence: null,
      difficulty: null,
    })
    expect(issues.length).toBeGreaterThanOrEqual(5)
    expect(issues.some((issue) => issue.indexOf('procedencia') !== -1)).toBe(true)
  })

  it('acepta un registro completo', () => {
    const issues = validateImportRecord({
      questionNumber: 1,
      stem: 'Enunciado DEMO.',
      options: [
        { label: 'A', text: 'Opción A', correct: true },
        { label: 'B', text: 'Opción B', correct: false },
      ],
      page: 1,
      rawText: null,
      confidence: 0.9,
      difficulty: 'Media',
    })
    expect(issues).toEqual([])
  })
})

describe('importación JSON completa', () => {
  it('acepta, pone en cuarentena, rechaza y descarta duplicados', () => {
    const database = fresh()
    const report = runKnowledgeImport(database, createMockJsonInput(now))
    expect(report.counts.total).toBe(4)
    expect(report.counts.accepted).toBe(1)
    expect(report.counts.quarantined).toBe(1)
    expect(report.counts.rejected).toBe(2)
    expect(report.counts.duplicates).toBe(1)
    expect(report.datasetVersionId).not.toBeNull()
    expect(report.datasetStatus).toBe('review')
    expect(report.stages.length).toBe(7)
    expect(report.stages.map((stage) => stage.stage)).toEqual([...knowledgeImportStages])
    expect(listUsableQuestions(database).length).toBe(1)
    expect(listQuarantine(database).length).toBe(1)
    expect(listQuarantine(database, 'pending').length).toBe(1)
    const dataset = getDatasetVersion(database, report.datasetVersionId as string)
    expect(Number(dataset?.accepted_count)).toBe(1)
    expect(Number(dataset?.quarantine_count)).toBe(1)
    expect(Number(dataset?.rejected_count)).toBe(2)
    expect(runKnowledgeIntegrityChecks(database).ok).toBe(true)
    database.close()
  })

  it('marca como rechazado el registro sin procedencia', () => {
    const database = fresh()
    const input = createMockJsonInput(now)
    input.content = JSON.stringify({
      records: [{ questionNumber: 1, stem: 'Sin fuente DEMO.', optionA: 'A', optionB: 'B', correctOption: 'A' }],
    })
    const report = runKnowledgeImport(database, input)
    expect(report.counts.rejected).toBe(1)
    expect(report.counts.accepted).toBe(0)
    expect(report.datasetStatus).toBe('review')
    database.close()
  })

  it('marca cuarentena por baja confianza', () => {
    const database = fresh()
    const input = createMockJsonInput(now)
    input.confidenceThreshold = 0.95
    const report = runKnowledgeImport(database, input)
    expect(report.counts.quarantined).toBeGreaterThanOrEqual(1)
    const quarantined = listQuarantine(database)
    expect(quarantined.every((row) => row.review_status === 'pending')).toBe(true)
    database.close()
  })
})

describe('importación CSV y de extracción', () => {
  it('importa CSV y rechaza la fila sin respuesta', () => {
    const database = fresh()
    const report = runKnowledgeImport(database, createMockCsvInput(now))
    expect(report.counts.total).toBe(2)
    expect(report.counts.accepted).toBe(1)
    expect(report.counts.rejected).toBe(1)
    database.close()
  })

  it('importa resultados de extracción con confianza mixta', () => {
    const database = fresh()
    const input = createMockExtractionInput(now)
    input.datasetVersion = 2
    const report = runKnowledgeImport(database, input)
    expect(report.counts.accepted).toBe(1)
    expect(report.counts.quarantined).toBe(1)
    expect(report.counts.rejected).toBe(0)
    expect(listUsableQuestions(database).length).toBe(1)
    database.close()
  })
})

describe('snapshot tras la importación', () => {
  it('el dataset importado genera un snapshot verificable y reproducible', () => {
    const database = fresh()
    const report = runKnowledgeImport(database, createMockJsonInput(now))
    const first = createKnowledgeSnapshot(database, report.datasetVersionId as string, now)
    const second = createKnowledgeSnapshot(database, report.datasetVersionId as string, now)
    expect(first).not.toBeNull()
    expect(first?.hash).toBe(second?.hash)
    expect(verifyKnowledgeSnapshot(first!, database).ok).toBe(true)
    expect(first?.questionIds.length).toBe(2)
    database.close()
  })
})

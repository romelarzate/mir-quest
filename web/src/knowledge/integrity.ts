import type { KnowledgeDatabase } from './db'

export type IntegritySeverity = 'error' | 'warning'

export type IntegrityIssue = {
  code: string
  severity: IntegritySeverity
  entity: string
  entityId: string | null
  message: string
}

export type IntegrityReport = {
  ok: boolean
  errorCount: number
  warningCount: number
  issues: IntegrityIssue[]
}

export const integrityRules: string[] = [
  'Un examen debe tener preguntas.',
  'Una pregunta debe tener opciones y exactamente una respuesta correcta.',
  'Una pregunta debe tener fuente: documento y versión documental.',
  'La versión documental debe pertenecer al documento declarado.',
  'No se admiten referencias rotas ni duplicados exactos o textuales.',
  'Las preguntas fuera de secuencia se avisan como advertencia, no como error.',
  'Una pregunta en cuarentena no puede aparecer en conjuntos utilizables.',
]

function issue(
  code: string,
  severity: IntegritySeverity,
  entity: string,
  entityId: string | null,
  message: string,
): IntegrityIssue {
  return { code, severity, entity, entityId, message }
}

export function checkDocumentIntegrity(database: KnowledgeDatabase): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []

  const badHash = database
    .prepare('SELECT id FROM source_document WHERE sha256 IS NULL OR length(sha256) <> 64')
    .all() as Array<{ id: string }>
  for (const row of badHash) issues.push(issue('document-without-hash', 'error', 'source_document', row.id, 'Documento sin hash válido.'))

  const duplicateHash = database
    .prepare('SELECT sha256 AS value, COUNT(*) AS total FROM source_document GROUP BY sha256 HAVING total > 1')
    .all() as Array<{ value: string; total: number }>
  for (const row of duplicateHash) {
    issues.push(issue('duplicate-document-hash', 'error', 'source_document', row.value, 'Hash repetido en ' + String(row.total) + ' documentos.'))
  }

  const orphanVersion = database
    .prepare('SELECT v.id AS id FROM document_version v LEFT JOIN source_document d ON d.id = v.document_id WHERE d.id IS NULL')
    .all() as Array<{ id: string }>
  for (const row of orphanVersion) {
    issues.push(issue('orphan-document-version', 'error', 'document_version', row.id, 'Versión sin documento padre.'))
  }

  return issues
}

export function checkExamIntegrity(database: KnowledgeDatabase): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []

  const rows = database
    .prepare(
      'SELECT e.id AS exam_id, e.question_count AS declared, COUNT(q.id) AS actual FROM historical_exam e LEFT JOIN historical_question q ON q.exam_id = e.id GROUP BY e.id',
    )
    .all() as Array<{ exam_id: string; declared: number; actual: number }>

  for (const row of rows) {
    if (row.actual === 0) issues.push(issue('exam-without-questions', 'error', 'historical_exam', row.exam_id, 'Examen sin preguntas.'))
    else if (row.declared !== row.actual) {
      issues.push(
        issue('exam-question-count-mismatch', 'warning', 'historical_exam', row.exam_id, 'Declara ' + String(row.declared) + ' preguntas y tiene ' + String(row.actual) + '.'),
      )
    }
  }

  const duplicateNumbers = database
    .prepare(
      'SELECT exam_id, original_question_number AS number, COUNT(*) AS total FROM historical_question GROUP BY exam_id, original_question_number HAVING total > 1',
    )
    .all() as Array<{ exam_id: string; number: number; total: number }>
  for (const row of duplicateNumbers) {
    issues.push(
      issue('duplicate-question-number', 'error', 'historical_question', row.exam_id, 'Número ' + String(row.number) + ' repetido ' + String(row.total) + ' veces.'),
    )
  }

  const exams = database.prepare('SELECT id FROM historical_exam').all() as Array<{ id: string }>
  for (const exam of exams) {
    const numbers = database
      .prepare('SELECT original_question_number AS number FROM historical_question WHERE exam_id = ? ORDER BY number')
      .all(exam.id) as Array<{ number: number }>
    const gaps: number[] = []
    for (let index = 1; index < numbers.length; index += 1) {
      if (numbers[index].number - numbers[index - 1].number > 1) gaps.push(numbers[index - 1].number + 1)
    }
    if (gaps.length > 0) {
      issues.push(
        issue('question-sequence-gap', 'warning', 'historical_exam', exam.id, 'Faltan números a partir de: ' + gaps.slice(0, 5).join(', ')),
      )
    }
  }

  return issues
}

export function checkQuestionIntegrity(database: KnowledgeDatabase): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []

  const noOptions = database
    .prepare('SELECT q.id AS id FROM historical_question q WHERE NOT EXISTS (SELECT 1 FROM question_option o WHERE o.question_id = q.id)')
    .all() as Array<{ id: string }>
  for (const row of noOptions) issues.push(issue('question-without-options', 'error', 'historical_question', row.id, 'Pregunta sin opciones.'))

  const noAnswer = database
    .prepare(
      'SELECT q.id AS id FROM historical_question q WHERE NOT EXISTS (SELECT 1 FROM question_option o WHERE o.question_id = q.id AND o.is_correct = 1)',
    )
    .all() as Array<{ id: string }>
  for (const row of noAnswer) issues.push(issue('question-without-answer', 'error', 'historical_question', row.id, 'Pregunta sin respuesta correcta.'))

  const multipleAnswers = database
    .prepare(
      'SELECT question_id AS id, COUNT(*) AS total FROM question_option WHERE is_correct = 1 GROUP BY question_id HAVING total > 1',
    )
    .all() as Array<{ id: string; total: number }>
  for (const row of multipleAnswers) {
    issues.push(issue('question-with-multiple-answers', 'error', 'historical_question', row.id, 'Tiene ' + String(row.total) + ' respuestas correctas.'))
  }

  const noProvenance = database
    .prepare(
      'SELECT id FROM historical_question WHERE source_document_id IS NULL OR document_version_id IS NULL OR (page IS NULL AND raw_text IS NULL AND source_hash IS NULL)',
    )
    .all() as Array<{ id: string }>
  for (const row of noProvenance) {
    issues.push(issue('question-without-provenance', 'error', 'historical_question', row.id, 'Pregunta sin procedencia registrada.'))
  }

  const mismatchedVersion = database
    .prepare(
      'SELECT q.id AS id FROM historical_question q JOIN document_version v ON v.id = q.document_version_id WHERE v.document_id <> q.source_document_id',
    )
    .all() as Array<{ id: string }>
  for (const row of mismatchedVersion) {
    issues.push(
      issue('provenance-version-mismatch', 'error', 'historical_question', row.id, 'La versión documental no pertenece al documento declarado.'),
    )
  }

  return issues
}

export function checkReferenceIntegrity(database: KnowledgeDatabase): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []

  const orphanClassification = database
    .prepare(
      'SELECT c.id AS id FROM question_classification c LEFT JOIN clinical_domain d ON d.id = c.clinical_domain_id WHERE d.id IS NULL',
    )
    .all() as Array<{ id: string }>
  for (const row of orphanClassification) {
    issues.push(issue('broken-classification-reference', 'error', 'question_classification', row.id, 'Clasificación sin dominio clínico.'))
  }

  const orphanMapping = database
    .prepare(
      'SELECT m.id AS id FROM curriculum_mapping m LEFT JOIN clinical_domain d ON d.id = m.clinical_domain_id WHERE d.id IS NULL',
    )
    .all() as Array<{ id: string }>
  for (const row of orphanMapping) {
    issues.push(issue('broken-mapping-reference', 'error', 'curriculum_mapping', row.id, 'Mapping sin dominio clínico.'))
  }

  const orphanExtraction = database
    .prepare(
      'SELECT e.id AS id FROM extraction_result e LEFT JOIN historical_question q ON q.id = e.historical_question_id WHERE e.historical_question_id IS NOT NULL AND q.id IS NULL',
    )
    .all() as Array<{ id: string }>
  for (const row of orphanExtraction) {
    issues.push(issue('broken-extraction-reference', 'error', 'extraction_result', row.id, 'Extracción apuntando a una pregunta inexistente.'))
  }

  const orphanQuarantine = database
    .prepare(
      'SELECT z.id AS id FROM quarantine_question z LEFT JOIN extraction_result e ON e.id = z.extraction_result_id WHERE e.id IS NULL',
    )
    .all() as Array<{ id: string }>
  for (const row of orphanQuarantine) {
    issues.push(issue('broken-quarantine-reference', 'error', 'quarantine_question', row.id, 'Cuarentena sin extracción de origen.'))
  }

  const orphanDatasetQuestion = database
    .prepare('SELECT dq.question_id AS id FROM dataset_question dq LEFT JOIN historical_question q ON q.id = dq.question_id WHERE q.id IS NULL')
    .all() as Array<{ id: string }>
  for (const row of orphanDatasetQuestion) {
    issues.push(issue('broken-dataset-question-reference', 'error', 'dataset_question', row.id, 'Dataset apuntando a una pregunta inexistente.'))
  }

  return issues
}

export function checkDuplicateIntegrity(database: KnowledgeDatabase): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []
  const exact = database
    .prepare('SELECT stem_hash AS value, COUNT(*) AS total FROM historical_question GROUP BY stem_hash HAVING total > 1')
    .all() as Array<{ value: string; total: number }>
  for (const row of exact) {
    issues.push(issue('duplicate-exact-hash', 'error', 'historical_question', row.value, 'Hash exacto repetido en ' + String(row.total) + ' preguntas.'))
  }
  const textual = database
    .prepare(
      'SELECT normalized_text_hash AS value, COUNT(*) AS total FROM historical_question GROUP BY normalized_text_hash HAVING total > 1',
    )
    .all() as Array<{ value: string; total: number }>
  for (const row of textual) {
    issues.push(
      issue('duplicate-normalized-text', 'warning', 'historical_question', row.value, 'Texto normalizado repetido en ' + String(row.total) + ' preguntas.'),
    )
  }
  return issues
}

export function runKnowledgeIntegrityChecks(database: KnowledgeDatabase): IntegrityReport {
  const issues = [
    ...checkDocumentIntegrity(database),
    ...checkExamIntegrity(database),
    ...checkQuestionIntegrity(database),
    ...checkReferenceIntegrity(database),
    ...checkDuplicateIntegrity(database),
  ]
  const errorCount = issues.filter((entry) => entry.severity === 'error').length
  const warningCount = issues.length - errorCount
  return { ok: errorCount === 0, errorCount, warningCount, issues }
}

export function violatingQuarantineQuestionIds(database: KnowledgeDatabase, candidateIds: string[]): string[] {
  if (candidateIds.length === 0) return []
  const placeholders = candidateIds.map(() => '?').join(',')
  const sql =
    'SELECT q.id AS id FROM historical_question q WHERE q.id IN (' +
    placeholders +
    ') AND (q.validation_status <> ' +
    String.fromCharCode(39) +
    'accepted' +
    String.fromCharCode(39) +
    ' OR EXISTS (SELECT 1 FROM quarantine_question z WHERE z.historical_question_id = q.id AND z.review_status <> ' +
    String.fromCharCode(39) +
    'approved' +
    String.fromCharCode(39) +
    '))'
  const rows = database.prepare(sql).all(...candidateIds) as Array<{ id: string }>
  return rows.map((row) => row.id)
}

export function assertQuarantineIsolation(database: KnowledgeDatabase, candidateIds: string[]): void {
  const violating = violatingQuarantineQuestionIds(database, candidateIds)
  if (violating.length > 0) {
    throw new Error(
      'Aislamiento de cuarentena violado: ' + violating.length + ' pregunta(s) no utilizables: ' + violating.join(', '),
    )
  }
}

export function usableQuestionIds(database: KnowledgeDatabase): string[] {
  const rows = database.prepare('SELECT id FROM usable_historical_question ORDER BY id').all() as Array<{ id: string }>
  return rows.map((row) => row.id)
}

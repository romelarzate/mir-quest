import { currentKnowledgeSchemaVersion, declaredKnowledgeSchemaVersion } from './db'
import type { KnowledgeDatabase } from './db'
import { stableStringify } from './ids'
import { getDatasetVersion, listDatasetQuestionIds } from './repositories'
import { sha256 } from './ids'

export type KnowledgeSnapshot = {
  datasetVersion: string
  schemaVersion: number
  taxonomyVersion: string
  sourceHashes: string[]
  questionIds: string[]
  generatedAt: string
  hash: string
}

export const snapshotRules: string[] = [
  'Un snapshot es un artefacto de reproducibilidad y backup, no la base de datos principal.',
  'Incluye versión de dataset, versión de esquema, taxonomía, hashes de origen y preguntas.',
  'El hash permite verificar que el snapshot no se ha alterado.',
  'Los snapshots no se consultan en tiempo de ejecución: el warehouse es la fuente de verdad.',
]

export function computeSnapshotHash(snapshot: Omit<KnowledgeSnapshot, 'hash'>): string {
  return sha256(stableStringify(snapshot))
}

export function createKnowledgeSnapshot(
  database: KnowledgeDatabase,
  datasetVersionId: string,
  now: Date = new Date(),
): KnowledgeSnapshot | null {
  const row = getDatasetVersion(database, datasetVersionId)
  if (!row) return null

  const name = String(row.name)
  const version = Number(row.version)
  const sourceHashes = JSON.parse(String(row.source_hashes_json)) as string[]
  const questionIds = listDatasetQuestionIds(database, datasetVersionId)

  const payload: Omit<KnowledgeSnapshot, 'hash'> = {
    datasetVersion: name + '@' + String(version),
    schemaVersion: currentKnowledgeSchemaVersion(database),
    taxonomyVersion: String(row.taxonomy_version),
    sourceHashes: sourceHashes.slice().sort(),
    questionIds: questionIds.slice().sort(),
    generatedAt: now.toISOString(),
  }

  return { ...payload, hash: computeSnapshotHash(payload) }
}

export function serializeKnowledgeSnapshot(snapshot: KnowledgeSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}

export function snapshotFilename(snapshot: KnowledgeSnapshot): string {
  const safe = snapshot.datasetVersion.replace(/[^A-Za-z0-9.@-]+/g, '-')
  return 'knowledge-snapshot-' + safe + '-' + snapshot.hash.slice(0, 12) + '.json'
}

export type SnapshotVerification = { ok: boolean; issues: string[] }

export function verifyKnowledgeSnapshot(
  snapshot: KnowledgeSnapshot,
  database: KnowledgeDatabase,
): SnapshotVerification {
  const issues: string[] = []

  const payload: Omit<KnowledgeSnapshot, 'hash'> = {
    datasetVersion: snapshot.datasetVersion,
    schemaVersion: snapshot.schemaVersion,
    taxonomyVersion: snapshot.taxonomyVersion,
    sourceHashes: snapshot.sourceHashes,
    questionIds: snapshot.questionIds,
    generatedAt: snapshot.generatedAt,
  }

  if (computeSnapshotHash(payload) !== snapshot.hash) issues.push('El hash del snapshot no coincide con su contenido.')
  if (snapshot.schemaVersion > declaredKnowledgeSchemaVersion()) {
    issues.push('El snapshot declara una versión de esquema más nueva que la soportada.')
  }

  for (const questionId of snapshot.questionIds) {
    const row = database.prepare('SELECT id FROM historical_question WHERE id = ?').get(questionId)
    if (!row) issues.push('El snapshot referencia una pregunta inexistente: ' + questionId)
  }

  return { ok: issues.length === 0, issues }
}

export function snapshotSummary(snapshot: KnowledgeSnapshot): string {
  return (
    snapshot.datasetVersion +
    ' · esquema v' +
    String(snapshot.schemaVersion) +
    ' · ' +
    String(snapshot.questionIds.length) +
    ' preguntas · hash ' +
    snapshot.hash.slice(0, 12)
  )
}

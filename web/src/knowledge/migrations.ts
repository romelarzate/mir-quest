/**
 * Migraciones del Knowledge Core.
 *
 * Versionado independiente del Study Domain: este registro NO toca
 * StudyState ni sus migraciones. Cada dominio evoluciona por su cuenta.
 */

import { knowledgeSchemaStatements } from './schema'

export const KNOWLEDGE_SCHEMA_VERSION = 1

/** Tabla de control propia del warehouse, distinta de la del Study Domain. */
export const knowledgeMigrationTableSql = `CREATE TABLE IF NOT EXISTS knowledge_migrations (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`

export const studyStateMigrationTables = ['mir-quest-state']
export const knowledgeMigrationTables = ['knowledge_migrations']

export type KnowledgeMigration = {
  version: number
  description: string
  statements: string[]
}

export const knowledgeMigrations: KnowledgeMigration[] = [
  {
    version: 1,
    description: 'Esquema inicial: documentos, exámenes, preguntas, opciones, clasificación, procedencia, extracción, cuarentena y datasets',
    statements: knowledgeSchemaStatements,
  },
]

export function findKnowledgeMigration(version: number): KnowledgeMigration | undefined {
  return knowledgeMigrations.find((migration) => migration.version === version)
}

export function pendingKnowledgeMigrations(appliedVersions: number[]): KnowledgeMigration[] {
  const applied = new Set(appliedVersions)
  return knowledgeMigrations
    .filter((migration) => !applied.has(migration.version))
    .sort((a, b) => a.version - b.version)
}

export const knowledgeMigrationRules: string[] = [
  'Las migraciones del warehouse nunca modifican StudyState.',
  'Cada dominio mantiene su propia tabla de control y su propia versión.',
  'Una migración aplicada no se vuelve a ejecutar: la versión queda registrada.',
  'Las migraciones se aplican dentro de una transacción.',
]

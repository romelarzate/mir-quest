import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { knowledgeMigrationTableSql, pendingKnowledgeMigrations, KNOWLEDGE_SCHEMA_VERSION } from './migrations'

export type KnowledgeDatabase = DatabaseSync

export const knowledgeInMemoryPath = ':memory:'

/**
 * Ruta por defecto del warehouse. Fuera del código fuente y del control de
 * versiones: el fichero SQLite es un dato local, no un artefacto del repo.
 */
export function defaultKnowledgeDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.MIR_QUEST_KNOWLEDGE_DB
  if (configured && configured.trim().length > 0) return configured
  return join(process.cwd(), '.knowledge', 'knowledge.sqlite')
}

export type OpenKnowledgeOptions = {
  path?: string
  now?: () => Date
  applyMigrations?: boolean
}

export function openKnowledgeDatabase(options: OpenKnowledgeOptions = {}): KnowledgeDatabase {
  const path = options.path ?? defaultKnowledgeDatabasePath()
  const now = options.now ?? (() => new Date())

  if (path !== knowledgeInMemoryPath) mkdirSync(dirname(path), { recursive: true })

  const database = new DatabaseSync(path)
  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA busy_timeout = 5000')
  if (path !== knowledgeInMemoryPath) database.exec('PRAGMA journal_mode = WAL')
  database.exec('PRAGMA synchronous = NORMAL')

  if (options.applyMigrations !== false) applyKnowledgeMigrations(database, now)
  return database
}

export type MigrationOutcome = { applied: number[]; version: number }

export function applyKnowledgeMigrations(database: KnowledgeDatabase, now: () => Date = () => new Date()): MigrationOutcome {
  database.exec(knowledgeMigrationTableSql)
  const rows = database.prepare('SELECT version FROM knowledge_migrations ORDER BY version').all() as Array<{ version: number }>
  const pending = pendingKnowledgeMigrations(rows.map((row) => row.version))
  const applied: number[] = []

  for (const migration of pending) {
    withTransaction(database, () => {
      for (const statement of migration.statements) database.exec(statement)
      database
        .prepare('INSERT INTO knowledge_migrations (version, description, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.description, now().toISOString())
      applied.push(migration.version)
    })
  }

  return { applied, version: currentKnowledgeSchemaVersion(database) }
}

export function currentKnowledgeSchemaVersion(database: KnowledgeDatabase): number {
  const row = database.prepare('SELECT MAX(version) AS version FROM knowledge_migrations').get() as { version: number | null } | undefined
  return row && row.version !== null ? row.version : 0
}

export function declaredKnowledgeSchemaVersion(): number {
  return KNOWLEDGE_SCHEMA_VERSION
}

export function withTransaction<T>(database: KnowledgeDatabase, action: () => T): T {
  database.exec('BEGIN')
  try {
    const result = action()
    database.exec('COMMIT')
    return result
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export function listKnowledgeIndexes(database: KnowledgeDatabase): string[] {
  const rows = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>
  return rows.map((row) => row.name)
}

export function listKnowledgeViews(database: KnowledgeDatabase): string[] {
  const rows = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name")
    .all() as Array<{ name: string }>
  return rows.map((row) => row.name)
}

export function listKnowledgeTables(database: KnowledgeDatabase): string[] {
  const rows = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>
  return rows.map((row) => row.name)
}

export function closeKnowledgeDatabase(database: KnowledgeDatabase): void {
  database.close()
}

export const knowledgePragmas: string[] = [
  'foreign_keys = ON: la integridad referencial se aplica de verdad, no solo se declara.',
  'journal_mode = WAL: lecturas y escrituras concurrentes sin bloquearse (solo en fichero).',
  'busy_timeout = 5000: evita fallos inmediatos si otro proceso escribe.',
  'synchronous = NORMAL: equilibrio razonable entre seguridad y velocidad en local.',
]

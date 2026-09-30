import type { StudyState, ThemeMode } from './types'
import { SCHEMA_VERSION } from './types'

export type MigrationContext = {
  now: Date
  legacyTheme: string | null
}

export type Migration = {
  from: number
  to: number
  description: string
  migrate: (input: unknown, context: MigrationContext) => unknown
}

export function normalizeTheme(value: unknown): ThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

function emptySettings(context: MigrationContext) {
  return {
    dailyQuestionGoal: 20,
    dailyFlashcardGoal: 30,
    explanationsImmediately: true,
    theme: normalizeTheme(context.legacyTheme),
    lastExportAt: null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * Versión 0 = estado heredado de Fase 1 / 1.5, donde solo existía la clave
 * "mir-quest-theme" en localStorage y no había estado persistido de estudio.
 */
export const migrations: Migration[] = [
  {
    from: 0,
    to: 1,
    description: 'Crea el estado inicial y adopta el tema heredado de Fase 1.5',
    migrate: (_input, context) => {
      const state: StudyState = {
        schemaVersion: 1,
        attempts: [],
        errors: [],
        flashcards: [],
        exams: [],
        documents: [],
        settings: emptySettings(context),
        updatedAt: context.now.toISOString(),
      }
      return state
    },
  },
  {
    from: 1,
    to: 2,
    description: 'Amplía flashcards con origen y vínculos, y añade historial de simulacros',
    migrate: (input, context) => {
      const previous = asRecord(input)

      const flashcards = asArray(previous.flashcards).map((value) => {
        const card = asRecord(value)
        const questionId = typeof card.questionId === 'string' ? card.questionId : null
        const origin = typeof card.origin === 'string' ? card.origin : questionId ? 'question' : 'manual'
        return {
          ...card,
          questionId,
          errorId: typeof card.errorId === 'string' ? card.errorId : null,
          topicId: typeof card.topicId === 'string' ? card.topicId : null,
          subtopicId: typeof card.subtopicId === 'string' ? card.subtopicId : null,
          origin,
          sourceIds: asArray(card.sourceIds),
          tags: asArray(card.tags),
        }
      })

      const settingsValue = asRecord(previous.settings)
      const settings =
        Object.keys(settingsValue).length > 0
          ? { ...emptySettings(context), ...settingsValue, theme: normalizeTheme(settingsValue.theme) }
          : emptySettings(context)

      const state: StudyState = {
        schemaVersion: 2,
        attempts: asArray(previous.attempts) as StudyState['attempts'],
        errors: asArray(previous.errors) as StudyState['errors'],
        flashcards: flashcards as StudyState['flashcards'],
        exams: asArray(previous.exams) as StudyState['exams'],
        documents: asArray(previous.documents) as StudyState['documents'],
        settings: settings as StudyState['settings'],
        updatedAt: context.now.toISOString(),
      }
      return state
    },
  },
  {
    from: 2,
    to: 3,
    description: 'Añade el registro de documentos del pipeline documental',
    migrate: (input, context) => {
      const previous = asRecord(input)
      const settingsValue = asRecord(previous.settings)
      const settings =
        Object.keys(settingsValue).length > 0
          ? { ...emptySettings(context), ...settingsValue, theme: normalizeTheme(settingsValue.theme) }
          : emptySettings(context)
      const state: StudyState = {
        schemaVersion: 3,
        attempts: asArray(previous.attempts) as StudyState['attempts'],
        errors: asArray(previous.errors) as StudyState['errors'],
        flashcards: asArray(previous.flashcards) as StudyState['flashcards'],
        exams: asArray(previous.exams) as StudyState['exams'],
        documents: asArray(previous.documents) as StudyState['documents'],
        settings: settings as StudyState['settings'],
        updatedAt: context.now.toISOString(),
      }
      return state
    },
  },
]

export function findMigration(from: number, to: number): Migration | undefined {
  return migrations.find((migration) => migration.from === from && migration.to === to)
}

export type MigrationResult = {
  state: StudyState
  applied: string[]
}

/**
 * Aplica migraciones consecutivas desde la versión encontrada hasta SCHEMA_VERSION.
 * Devuelve null si falta una migración intermedia (versión no soportada).
 */
export function runMigrations(
  input: unknown,
  fromVersion: number,
  context: MigrationContext,
): MigrationResult | null {
  let current = input
  let version = fromVersion
  const applied: string[] = []

  while (version < SCHEMA_VERSION) {
    const migration = findMigration(version, version + 1)
    if (!migration) return null
    current = migration.migrate(current, context)
    version = migration.to
    applied.push(String(migration.from) + '->' + String(migration.to) + ': ' + migration.description)
  }

  return { state: current as StudyState, applied }
}

import type { StudySettings, StudyState, ThemeMode } from '../domain/types'
import { SCHEMA_VERSION } from '../domain/types'
import { normalizeTheme, runMigrations } from '../domain/migrations'

export const storageKeys = {
  state: 'mir-quest-state',
  legacyTheme: 'mir-quest-theme',
}

export type KeyValueStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export function createMemoryStorage(seed: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

export function getBrowserStorage(): KeyValueStorage | null {
  try {
    const storage = window.localStorage
    const probe = '__mir-quest-probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

export function defaultSettings(theme: ThemeMode = 'system'): StudySettings {
  return {
    dailyQuestionGoal: 20,
    dailyFlashcardGoal: 30,
    explanationsImmediately: true,
    theme,
    lastExportAt: null,
  }
}

export function createDefaultState(now: Date, theme: ThemeMode = 'system'): StudyState {
  return {
    schemaVersion: SCHEMA_VERSION,
    attempts: [],
    errors: [],
    flashcards: [],
    exams: [],
    documents: [],
    settings: defaultSettings(theme),
    updatedAt: now.toISOString(),
  }
}

export function readLegacyTheme(storage: KeyValueStorage): string | null {
  try {
    return storage.getItem(storageKeys.legacyTheme)
  } catch {
    return null
  }
}

export function serializeState(state: StudyState): string {
  return JSON.stringify(state, null, 2)
}

export function isStudyState(value: unknown): value is StudyState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<StudyState>
  if (typeof candidate.schemaVersion !== 'number') return false
  if (!Array.isArray(candidate.attempts)) return false
  if (!Array.isArray(candidate.errors)) return false
  if (!Array.isArray(candidate.flashcards)) return false
  if (!Array.isArray(candidate.exams)) return false
  if (!Array.isArray(candidate.documents)) return false
  if (typeof candidate.settings !== 'object' || candidate.settings === null) return false
  if (typeof candidate.settings.dailyQuestionGoal !== 'number') return false
  if (typeof candidate.settings.dailyFlashcardGoal !== 'number') return false
  if (typeof candidate.settings.explanationsImmediately !== 'boolean') return false
  if (typeof candidate.updatedAt !== 'string') return false
  return true
}

export type LoadStatus = 'ok' | 'missing' | 'migrated' | 'corrupt' | 'newer'

export type LoadResult = {
  state: StudyState
  status: LoadStatus
  appliedMigrations: string[]
  message: string
  persistenceBlocked: boolean
}

export function parseStoredState(
  json: string,
  now: Date,
  legacyTheme: string | null,
): LoadResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return {
      state: createDefaultState(now, normalizeTheme(legacyTheme)),
      status: 'corrupt',
      appliedMigrations: [],
      message: 'El estado guardado no era JSON válido. Se reinició con valores por defecto.',
      persistenceBlocked: false,
    }
  }

  if (typeof raw !== 'object' || raw === null) {
    return {
      state: createDefaultState(now, normalizeTheme(legacyTheme)),
      status: 'corrupt',
      appliedMigrations: [],
      message: 'El estado guardado tenía un formato inesperado. Se reinició con valores por defecto.',
      persistenceBlocked: false,
    }
  }

  const version = typeof (raw as { schemaVersion?: unknown }).schemaVersion === 'number'
    ? (raw as { schemaVersion: number }).schemaVersion
    : 0

  if (version > SCHEMA_VERSION) {
    return {
      state: createDefaultState(now, normalizeTheme(legacyTheme)),
      status: 'newer',
      appliedMigrations: [],
      message:
        'El estado guardado pertenece a una versión más nueva de la app. Se cargó en memoria sin sobrescribirlo.',
      persistenceBlocked: true,
    }
  }

  if (version === SCHEMA_VERSION) {
    if (!isStudyState(raw)) {
      return {
        state: createDefaultState(now, normalizeTheme(legacyTheme)),
        status: 'corrupt',
        appliedMigrations: [],
        message: 'El estado guardado no superó la validación. Se reinició con valores por defecto.',
        persistenceBlocked: false,
      }
    }
    return {
      state: raw,
      status: 'ok',
      appliedMigrations: [],
      message: 'Estado local cargado correctamente.',
      persistenceBlocked: false,
    }
  }

  const result = runMigrations(raw, version, { now, legacyTheme })
  if (!result) {
    return {
      state: createDefaultState(now, normalizeTheme(legacyTheme)),
      status: 'corrupt',
      appliedMigrations: [],
      message: 'No existe una migración para la versión guardada. Se reinició con valores por defecto.',
      persistenceBlocked: false,
    }
  }

  return {
    state: result.state,
    status: 'migrated',
    appliedMigrations: result.applied,
    message:
      result.applied.length > 0
        ? `Estado migrado desde la versión ${version} a la ${SCHEMA_VERSION}.`
        : 'Estado cargado sin cambios de versión.',
    persistenceBlocked: false,
  }
}

export function loadState(storage: KeyValueStorage, now: Date): LoadResult {
  const legacyTheme = readLegacyTheme(storage)
  let json: string | null
  try {
    json = storage.getItem(storageKeys.state)
  } catch {
    json = null
  }

  if (!json) {
    return {
      state: createDefaultState(now, normalizeTheme(legacyTheme)),
      status: 'missing',
      appliedMigrations: legacyTheme ? ['0->1: tema heredado adoptado desde mir-quest-theme'] : [],
      message: 'No había estado guardado. Se creó uno nuevo con datos DEMO.',
      persistenceBlocked: false,
    }
  }

  return parseStoredState(json, now, legacyTheme)
}

export function saveState(storage: KeyValueStorage, state: StudyState): void {
  storage.setItem(storageKeys.state, serializeState(state))
}

export function clearState(storage: KeyValueStorage): void {
  storage.removeItem(storageKeys.state)
  storage.removeItem(storageKeys.legacyTheme)
}

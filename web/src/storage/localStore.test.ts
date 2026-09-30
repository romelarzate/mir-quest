import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../domain/types'
import {
  clearState,
  createDefaultState,
  createMemoryStorage,
  loadState,
  parseStoredState,
  saveState,
  serializeState,
  storageKeys,
} from './localStore'

const now = new Date('2026-09-29T09:00:00.000Z')

describe('loadState', () => {
  it('crea un estado nuevo cuando no hay nada guardado', () => {
    const result = loadState(createMemoryStorage(), now)
    expect(result.status).toBe('missing')
    expect(result.state.attempts).toEqual([])
    expect(result.state.settings.theme).toBe('system')
    expect(result.persistenceBlocked).toBe(false)
  })

  it('adopta el tema heredado de Fase 1.5', () => {
    const storage = createMemoryStorage({ [storageKeys.legacyTheme]: 'dark' })
    const result = loadState(storage, now)
    expect(result.state.settings.theme).toBe('dark')
    expect(result.status).toBe('missing')
    expect(result.appliedMigrations.length).toBe(1)
  })

  it('marca como corrupto un JSON inválido y no bloquea el guardado', () => {
    const storage = createMemoryStorage({ [storageKeys.state]: '{esto no es json' })
    const result = loadState(storage, now)
    expect(result.status).toBe('corrupt')
    expect(result.persistenceBlocked).toBe(false)
  })

  it('no sobrescribe un estado de una versión más nueva', () => {
    const storage = createMemoryStorage({ [storageKeys.state]: JSON.stringify({ schemaVersion: 99, attempts: [] }) })
    const result = loadState(storage, now)
    expect(result.status).toBe('newer')
    expect(result.persistenceBlocked).toBe(true)
  })
})

describe('parseStoredState', () => {
  it('carga sin cambios un estado válido de la versión actual', () => {
    const state = createDefaultState(now, 'light')
    const result = parseStoredState(serializeState(state), now, null)
    expect(result.status).toBe('ok')
    expect(result.state.settings.theme).toBe('light')
  })

  it('rechaza un estado con forma incorrecta en la versión actual', () => {
    const result = parseStoredState(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, attempts: 'no-es-array' }),
      now,
      null,
    )
    expect(result.status).toBe('corrupt')
  })

  it('normaliza mediante migración un estado antiguo con forma incorrecta', () => {
    const result = parseStoredState(JSON.stringify({ schemaVersion: 1, attempts: 'no-es-array' }), now, null)
    expect(result.status).toBe('migrated')
    expect(result.state.attempts).toEqual([])
    expect(result.state.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('migra un estado sin versión conocida', () => {
    const result = parseStoredState(JSON.stringify({ schemaVersion: 0 }), now, 'dark')
    expect(result.status).toBe('migrated')
    expect(result.state.schemaVersion).toBe(3)
    expect(result.state.settings.theme).toBe('dark')
  })
})

describe('saveState y clearState', () => {
  it('persiste y recupera el estado', () => {
    const storage = createMemoryStorage()
    const state = createDefaultState(now, 'system')
    saveState(storage, state)
    const result = loadState(storage, now)
    expect(result.status).toBe('ok')
    expect(result.state.schemaVersion).toBe(state.schemaVersion)
  })

  it('elimina el estado y el tema heredado', () => {
    const storage = createMemoryStorage({
      [storageKeys.state]: serializeState(createDefaultState(now, 'system')),
      [storageKeys.legacyTheme]: 'dark',
    })
    clearState(storage)
    expect(storage.getItem(storageKeys.state)).toBeNull()
    expect(storage.getItem(storageKeys.legacyTheme)).toBeNull()
    expect(loadState(storage, now).status).toBe('missing')
  })
})

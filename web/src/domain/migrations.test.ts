import { describe, expect, it } from 'vitest'
import { migrations, normalizeTheme, runMigrations } from './migrations'
import { SCHEMA_VERSION } from './types'
import type { StudyState } from './types'

const now = new Date('2026-09-29T09:00:00.000Z')

describe('normalizeTheme', () => {
  it('acepta los valores válidos', () => {
    expect(normalizeTheme('light')).toBe('light')
    expect(normalizeTheme('dark')).toBe('dark')
    expect(normalizeTheme('system')).toBe('system')
  })

  it('cae en system para valores desconocidos', () => {
    expect(normalizeTheme('neon')).toBe('system')
    expect(normalizeTheme(null)).toBe('system')
    expect(normalizeTheme(7)).toBe('system')
  })
})

describe('registro de migraciones', () => {
  it('cubre de forma contigua desde la versión 0 hasta SCHEMA_VERSION', () => {
    let version = 0
    const applied: number[] = []
    while (version < SCHEMA_VERSION) {
      const migration = migrations.find((item) => item.from === version)
      expect(migration, 'falta migración desde la versión ' + String(version)).toBeDefined()
      version = migration!.to
      applied.push(version)
    }
    expect(version).toBe(SCHEMA_VERSION)
    expect(applied.length).toBeGreaterThan(0)
  })
})

describe('runMigrations', () => {
  it('crea el estado inicial y adopta el tema heredado', () => {
    const result = runMigrations({}, 0, { now, legacyTheme: 'dark' })
    expect(result).not.toBeNull()
    const state = result!.state as StudyState
    expect(state.schemaVersion).toBe(3)
    expect(state.settings.theme).toBe('dark')
    expect(state.attempts).toEqual([])
    expect(state.flashcards).toEqual([])
    expect(result!.applied.length).toBe(3)
  })

  it('usa system cuando no hay tema heredado', () => {
    const result = runMigrations({}, 0, { now, legacyTheme: null })
    expect((result!.state as StudyState).settings.theme).toBe('system')
  })
})

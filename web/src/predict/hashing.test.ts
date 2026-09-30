import { describe, expect, it } from 'vitest'
import { hashToUint32, legacySecondaryHashAlgorithm, mulberry32, primaryHashAlgorithm, sha256Hex, stableHashInput, stableStringify } from './hashing'

describe('hash principal', () => {
  it('usa SHA-256 como algoritmo principal', () => {
    expect(primaryHashAlgorithm).toBe('sha-256')
  })

  it('MD5 queda solo como compatibilidad secundaria', () => {
    expect(legacySecondaryHashAlgorithm).toBe('md5-compat')
    expect(primaryHashAlgorithm).not.toBe(legacySecondaryHashAlgorithm)
  })

  it('produce un hex de 64 caracteres reproducible', async () => {
    const first = await sha256Hex('mir-quest')
    const second = await sha256Hex('mir-quest')
    expect(first).toBe(second)
    expect(first.length).toBe(64)
  })
})

describe('serialización estable', () => {
  it('ordena claves para que el hash no dependa del orden', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }))
    expect(stableHashInput({ b: [1, 2], a: 'x' })).toBe('{"a":"x","b":[1,2]}')
  })
})

describe('generador reproducible', () => {
  it('devuelve la misma secuencia con la misma semilla', () => {
    const first = mulberry32(42)
    const second = mulberry32(42)
    const firstValues = [first(), first(), first()]
    const secondValues = [second(), second(), second()]
    expect(firstValues).toEqual(secondValues)
  })

  it('cambia la secuencia con otra semilla', () => {
    const first = mulberry32(1)
    const second = mulberry32(2)
    expect(first()).not.toBe(second())
  })

  it('convierte el hash en un entero de 32 bits', () => {
    expect(hashToUint32('ffffffff')).toBe(4294967295)
    expect(hashToUint32('00000000')).toBe(0)
    expect(Number.isInteger(hashToUint32('abcdef12'))).toBe(true)
  })
})

export const primaryHashAlgorithm = 'sha-256'

/**
 * MD5 solo se contempla como hash secundario de compatibilidad.
 * Nunca se usa como identificador criptográfico principal.
 */
export const legacySecondaryHashAlgorithm = 'md5-compat'

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map((item) => stableStringify(item)).join(',') + ']'
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + stableStringify(record[key])).join(',') + '}'
}

export function stableHashInput(value: unknown): string {
  return stableStringify(value)
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function hashToUint32(hex: string): number {
  const slice = hex.slice(0, 8)
  const parsed = Number.parseInt(slice, 16)
  return Number.isFinite(parsed) ? parsed >>> 0 : 0
}

/** Generador reproducible: la misma semilla produce la misma secuencia. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

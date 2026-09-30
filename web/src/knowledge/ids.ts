/**
 * Identidad y hashing del Knowledge Core.
 *
 * Independiente de React y del Study Domain. Usa node:crypto para hashing
 * síncrono y reproducible.
 */

import { createHash } from 'node:crypto'

export const knowledgeHashAlgorithm = 'sha256'
export const normalizedTextHashAlgorithm = 'sha256-normalized-text-v1'

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map((item) => stableStringify(item)).join(',') + ']'
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + stableStringify(record[key])).join(',') + '}'
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function shortenId(prefix: string, value: string, length = 16): string {
  return prefix + '_' + sha256(value).slice(0, length)
}

/** Texto normalizado para detectar duplicados textuales. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code < 0x0300 || code > 0x036f
    })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function normalizedTextHash(value: string): string {
  return sha256(normalizeText(value))
}

/**
 * Identificador interno y estable de una pregunta histórica.
 *
 * Decisión documentada: examYear + originalQuestionNumber NO se consideran
 * identidad global suficiente. La identidad interna se deriva del examen,
 * la versión documental, el número original y el enunciado normalizado,
 * de modo que una misma pregunta repetida con texto distinto no colisione
 * y una pregunta renumerada en otra edición tampoco.
 */
export function buildHistoricalQuestionId(input: {
  examId: string
  examVersion: string
  originalQuestionNumber: number
  stem: string
}): string {
  return shortenId(
    'hq',
    [input.examId, input.examVersion, String(input.originalQuestionNumber), normalizeText(input.stem)].join('|'),
    20,
  )
}

export function buildDocumentId(fileName: string, sha: string): string {
  return shortenId('doc', fileName + '|' + sha, 20)
}

export function buildDocumentVersionId(documentId: string, versionLabel: string): string {
  return shortenId('docv', documentId + '|' + versionLabel, 20)
}

export function buildExamId(examVersion: string, examYear: number | null): string {
  return shortenId('exam', examVersion + '|' + String(examYear), 20)
}

export function buildDatasetVersionId(name: string, version: number): string {
  return shortenId('dsv', name + '|' + String(version), 20)
}

export function buildSourceReferenceId(label: string, citation: string | null): string {
  return shortenId('srcref', label + '|' + String(citation), 20)
}

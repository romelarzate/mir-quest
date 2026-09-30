import type { KnowledgeDatabase } from './db'
import { normalizedTextHash, sha256 } from './ids'

export type DuplicateKind = 'exact-hash' | 'normalized-text' | 'semantic'

export type DuplicateMatch = {
  kind: DuplicateKind
  existingQuestionId: string
  score: number | null
  detail: string
}

export const duplicatePolicy: string[] = [
  'Duplicado exacto: mismo SHA-256 del enunciado.',
  'Duplicado textual: mismo hash del texto normalizado (sin acentos, sin puntuación, minúsculas).',
  'Duplicado semántico: contrato preparado, NO implementado en esta fase.',
  'Un duplicado detectado no se inserta: se informa y la pregunta queda fuera.',
]

export function findExactHashDuplicate(
  database: KnowledgeDatabase,
  input: { stem?: string; stemHash?: string },
): DuplicateMatch | null {
  const hash = input.stemHash ?? (input.stem ? sha256(input.stem) : null)
  if (hash === null) return null
  const row = database.prepare('SELECT id FROM historical_question WHERE stem_hash = ? LIMIT 1').get(hash) as
    | { id: string }
    | undefined
  if (!row) return null
  return { kind: 'exact-hash', existingQuestionId: row.id, score: 1, detail: 'Mismo hash exacto del enunciado.' }
}

export function findNormalizedTextDuplicate(database: KnowledgeDatabase, text: string): DuplicateMatch | null {
  const hash = normalizedTextHash(text)
  const row = database.prepare('SELECT id FROM historical_question WHERE normalized_text_hash = ? LIMIT 1').get(hash) as
    | { id: string }
    | undefined
  if (!row) return null
  return {
    kind: 'normalized-text',
    existingQuestionId: row.id,
    score: null,
    detail: 'Mismo texto normalizado: posible repetición con formato distinto.',
  }
}

export function detectDuplicates(database: KnowledgeDatabase, input: { stem: string }): DuplicateMatch[] {
  const matches: DuplicateMatch[] = []
  const exact = findExactHashDuplicate(database, { stem: input.stem })
  if (exact) matches.push(exact)
  const textual = findNormalizedTextDuplicate(database, input.stem)
  if (textual) matches.push(textual)
  return matches
}

export function detectDuplicatesWithinBatch(stems: string[]): Array<{ index: number; kind: DuplicateKind; matchesIndex: number }> {
  const seenHash = new Map<string, number>()
  const seenText = new Map<string, number>()
  const found: Array<{ index: number; kind: DuplicateKind; matchesIndex: number }> = []
  stems.forEach((stem, index) => {
    const hash = sha256(stem)
    const textHash = normalizedTextHash(stem)
    const hashMatch = seenHash.get(hash)
    const textMatch = seenText.get(textHash)
    if (hashMatch !== undefined) found.push({ index, kind: 'exact-hash', matchesIndex: hashMatch })
    else if (textMatch !== undefined) found.push({ index, kind: 'normalized-text', matchesIndex: textMatch })
    if (hashMatch === undefined) seenHash.set(hash, index)
    if (textMatch === undefined) seenText.set(textHash, index)
  })
  return found
}

export type SemanticDuplicateQuery = { text: string; limit?: number }

export type SemanticDuplicateResult = {
  implemented: false
  reason: string
  matches: DuplicateMatch[]
}

/**
 * Duplicado semántico: contrato preparado, sin implementar.
 * Requiere embeddings y un modelo autorizado, que no existen en esta fase.
 */
export function findSemanticDuplicates(
  _database: KnowledgeDatabase,
  _query: SemanticDuplicateQuery,
): SemanticDuplicateResult {
  return {
    implemented: false,
    reason: 'Detección semántica no implementada: requiere embeddings autorizados.',
    matches: [],
  }
}

export function describeDuplicateMatch(match: DuplicateMatch): string {
  return match.kind + ' contra ' + match.existingQuestionId + ': ' + match.detail
}

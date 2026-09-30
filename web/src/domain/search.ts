import type { CurriculumIndex } from './content'
import { describePath } from './content'
import type { ErrorEntry, Flashcard } from './types'

export type SearchResultType =
  | 'subject'
  | 'topic'
  | 'subtopic'
  | 'question'
  | 'flashcard'
  | 'error'
  | 'document'

export type SearchDocument = {
  type: SearchResultType
  id: string
  title: string
  subtitle: string
  path: string[]
  haystack: string
}

export type SearchResult = {
  type: SearchResultType
  id: string
  title: string
  subtitle: string
  path: string[]
  score: number
}

export const searchTypeLabels: Record<SearchResultType, string> = {
  subject: 'Asignaturas',
  topic: 'Temas',
  subtopic: 'Subtemas',
  question: 'Preguntas',
  flashcard: 'Flashcards',
  error: 'Errores',
  document: 'Documentos',
}

export const searchTypeOrder: SearchResultType[] = [
  'subject',
  'topic',
  'subtopic',
  'question',
  'flashcard',
  'error',
  'document',
]

/** Quita acentos sin usar secuencias de escape frágiles. */
export function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code < 0x0300 || code > 0x036f
    })
    .join('')
}

export function normalizeSearchText(value: string): string {
  return stripDiacritics(value).toLowerCase().trim()
}

export type SearchIndexInput = {
  curriculum: CurriculumIndex
  flashcards: Flashcard[]
  errors: ErrorEntry[]
}

export function buildSearchIndex(input: SearchIndexInput): SearchDocument[] {
  const { curriculum } = input
  const documents: SearchDocument[] = []

  for (const subject of curriculum.subjectsById.values()) {
    documents.push({
      type: 'subject',
      id: subject.id,
      title: subject.label,
      subtitle: 'Asignatura',
      path: [curriculum.curriculum.label],
      haystack: normalizeSearchText(subject.label + ' ' + subject.blockId),
    })
  }

  for (const topic of curriculum.topicsById.values()) {
    documents.push({
      type: 'topic',
      id: topic.id,
      title: topic.label,
      subtitle: 'Tema',
      path: describePath(curriculum, { subjectId: topic.subjectId }),
      haystack: normalizeSearchText(topic.label),
    })
  }

  for (const subtopic of curriculum.subtopicsById.values()) {
    documents.push({
      type: 'subtopic',
      id: subtopic.id,
      title: subtopic.label,
      subtitle: 'Subtema',
      path: describePath(curriculum, { subjectId: subtopic.subjectId, topicId: subtopic.topicId }),
      haystack: normalizeSearchText(subtopic.label),
    })
  }

  for (const question of curriculum.questionsById.values()) {
    documents.push({
      type: 'question',
      id: question.id,
      title: question.stem,
      subtitle: question.difficulty,
      path: describePath(curriculum, {
        subjectId: question.subjectId,
        topicId: question.topicId,
        subtopicId: question.subtopicId,
      }),
      haystack: normalizeSearchText(
        question.stem + ' ' + question.explanation + ' ' + question.options.map((option) => option.text).join(' '),
      ),
    })
  }

  for (const card of input.flashcards) {
    documents.push({
      type: 'flashcard',
      id: card.id,
      title: card.front,
      subtitle: card.origin,
      path: describePath(curriculum, { subjectId: card.subjectId, topicId: card.topicId, subtopicId: card.subtopicId }),
      haystack: normalizeSearchText(card.front + ' ' + card.back),
    })
  }

  for (const entry of input.errors) {
    const question = curriculum.questionsById.get(entry.questionId)
    documents.push({
      type: 'error',
      id: entry.id,
      title: question ? question.stem : entry.questionId,
      subtitle: 'Fallos: ' + String(entry.timesFailed) + (entry.resolved ? ' (recuperado)' : ''),
      path: describePath(curriculum, { subjectId: entry.subjectId, topicId: entry.topicId ?? null }),
      haystack: normalizeSearchText((question ? question.stem : entry.questionId) + ' ' + entry.subjectId),
    })
  }

  for (const block of curriculum.contentBlocksById.values()) {
    documents.push({
      type: 'document',
      id: block.id,
      title: block.title,
      subtitle: block.kind,
      path: describePath(curriculum, { subjectId: block.subjectId, topicId: block.topicId }),
      haystack: normalizeSearchText(block.title + ' ' + block.body),
    })
  }

  return documents
}

export function scoreDocument(document: SearchDocument, normalizedQuery: string): number {
  if (normalizedQuery.length === 0) return 0
  const title = normalizeSearchText(document.title)
  if (title === normalizedQuery) return 100
  if (title.startsWith(normalizedQuery)) return 80
  if (title.includes(normalizedQuery)) return 60
  const path = normalizeSearchText(document.path.join(' '))
  if (path.includes(normalizedQuery)) return 40
  if (document.haystack.includes(normalizedQuery)) return 20
  return 0
}

export function searchDocuments(
  documents: SearchDocument[],
  query: string,
  limitPerType = 5,
): SearchResult[] {
  const normalized = normalizeSearchText(query)
  if (normalized.length === 0) return []

  const hits = documents
    .map((document) => ({ document, score: scoreDocument(document, normalized) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title, 'es'))

  const perType = new Map<SearchResultType, number>()
  const results: SearchResult[] = []
  for (const hit of hits) {
    const used = perType.get(hit.document.type) ?? 0
    if (used >= limitPerType) continue
    perType.set(hit.document.type, used + 1)
    results.push({
      type: hit.document.type,
      id: hit.document.id,
      title: hit.document.title,
      subtitle: hit.document.subtitle,
      path: hit.document.path,
      score: hit.score,
    })
  }
  return results
}

export type SearchGroup = {
  type: SearchResultType
  label: string
  results: SearchResult[]
}

export function groupSearchResults(results: SearchResult[]): SearchGroup[] {
  return searchTypeOrder
    .map((type) => ({
      type,
      label: searchTypeLabels[type],
      results: results.filter((result) => result.type === type),
    }))
    .filter((group) => group.results.length > 0)
}

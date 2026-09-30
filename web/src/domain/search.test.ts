import { describe, expect, it } from 'vitest'
import { demoCurriculumBundle } from '../data/curriculum'
import { demoQuestionBank } from '../data/questions'
import { createCurriculumIndex } from './content'
import {
  buildSearchIndex,
  groupSearchResults,
  normalizeSearchText,
  searchDocuments,
  stripDiacritics,
} from './search'

function documents() {
  const curriculum = createCurriculumIndex({ ...demoCurriculumBundle, questions: demoQuestionBank })
  return buildSearchIndex({ curriculum, flashcards: [], errors: [] })
}

describe('normalización de texto', () => {
  it('quita acentos y baja a minúsculas', () => {
    expect(stripDiacritics('Cardiología')).toBe('Cardiologia')
    expect(normalizeSearchText('  Fibrilación AURICULAR ')).toBe('fibrilacion auricular')
  })
})

describe('buildSearchIndex', () => {
  it('indexa asignaturas, temas, subtemas, preguntas y documentos', () => {
    const docs = documents()
    const types = new Set(docs.map((doc) => doc.type))
    expect(types.has('subject')).toBe(true)
    expect(types.has('topic')).toBe(true)
    expect(types.has('subtopic')).toBe(true)
    expect(types.has('question')).toBe(true)
    expect(types.has('document')).toBe(true)
  })
})

describe('searchDocuments', () => {
  it('devuelve vacío con consulta vacía', () => {
    expect(searchDocuments(documents(), '   ')).toEqual([])
  })

  it('encuentra por nombre sin acentos', () => {
    const results = searchDocuments(documents(), 'cardiologia')
    expect(results.some((result) => result.type === 'subject' && result.title === 'Cardiología')).toBe(true)
  })

  it('encuentra temas por texto parcial', () => {
    const results = searchDocuments(documents(), 'arritm')
    expect(results.some((result) => result.id === 'topic-cardio-arritmias')).toBe(true)
  })

  it('encuentra preguntas por contenido del enunciado', () => {
    const results = searchDocuments(documents(), 'resincronizacion')
    expect(results.some((result) => result.type === 'question')).toBe(true)
  })

  it('limita los resultados por tipo', () => {
    const results = searchDocuments(documents(), 'a', 2)
    const byType = new Map<string, number>()
    for (const result of results) byType.set(result.type, (byType.get(result.type) ?? 0) + 1)
    for (const count of byType.values()) expect(count).toBeLessThanOrEqual(2)
  })

  it('prioriza coincidencias exactas de título', () => {
    const results = searchDocuments(documents(), 'cardiologia')
    expect(results[0].title).toBe('Cardiología')
  })
})

describe('groupSearchResults', () => {
  it('agrupa por tipo en orden estable', () => {
    const groups = groupSearchResults(searchDocuments(documents(), 'cardio'))
    expect(groups.length).toBeGreaterThan(0)
    expect(groups[0].label).toBe('Asignaturas')
    expect(groups.every((group) => group.results.length > 0)).toBe(true)
  })
})

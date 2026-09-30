import { describe, expect, it } from 'vitest'
import { demoCurriculumBundle } from '../data/curriculum'
import { demoQuestionBank } from '../data/questions'
import { createCurriculumIndex, describePath, findBrokenReferences, findUnsourcedProvenance } from './content'
import type { ContentBundle } from './content'

function bundle(): ContentBundle {
  return { ...demoCurriculumBundle, questions: demoQuestionBank.map((question) => ({ ...question })) }
}

describe('createCurriculumIndex', () => {
  it('indexa asignaturas, temas, subtemas y contenido', () => {
    const index = createCurriculumIndex(bundle())
    expect(index.subjectsById.size).toBe(36)
    expect(index.topicsById.size).toBeGreaterThan(0)
    expect(index.subtopicsById.size).toBeGreaterThan(0)
    expect(index.contentBlocksById.size).toBe(2)
    expect(index.examVersionsById.size).toBe(1)
  })

  it('agrupa preguntas por asignatura y por tema', () => {
    const index = createCurriculumIndex(bundle())
    expect((index.questionsBySubject.get('cardiologia') ?? []).length).toBe(3)
    expect((index.questionsByTopic.get('topic-cardio-arritmias') ?? []).length).toBe(1)
  })
})

describe('describePath', () => {
  it('devuelve la ruta asignatura, tema y subtema', () => {
    const index = createCurriculumIndex(bundle())
    expect(
      describePath(index, {
        subjectId: 'cardiologia',
        topicId: 'topic-cardio-arritmias',
        subtopicId: 'subtopic-cardio-arritmias-fa',
      }),
    ).toEqual(['Cardiología', 'Arritmias', 'Fibrilación auricular'])
  })

  it('ignora identificadores inexistentes', () => {
    const index = createCurriculumIndex(bundle())
    expect(describePath(index, { subjectId: 'no-existe' })).toEqual([])
  })
})

describe('findBrokenReferences', () => {
  it('no reporta nada en el paquete DEMO', () => {
    expect(findBrokenReferences(bundle())).toEqual([])
  })

  it('detecta un tema huérfano', () => {
    const base = bundle()
    const broken: ContentBundle = {
      ...base,
      topics: [...base.topics, { id: 'topic-huerfano', subjectId: 'no-existe', label: 'X', order: 99, contentStatus: 'demo', isDemo: true }],
    }
    const issues = findBrokenReferences(broken)
    expect(issues.some((entry) => entry.entityId === 'topic-huerfano' && entry.field === 'subjectId')).toBe(true)
  })

  it('detecta una opción correcta inexistente', () => {
    const base = bundle()
    const broken: ContentBundle = {
      ...base,
      questions: [{ ...base.questions[0], id: 'q-rota', correctOptionId: 'zz' }],
    }
    const issues = findBrokenReferences(broken)
    expect(issues.some((entry) => entry.entityId === 'q-rota' && entry.field === 'correctOptionId')).toBe(true)
  })

  it('detecta etiquetas y fuentes inexistentes', () => {
    const base = bundle()
    const broken: ContentBundle = {
      ...base,
      questions: [{ ...base.questions[0], id: 'q-refs', tags: ['tag-fantasma'], sourceIds: ['src-fantasma'] }],
    }
    const issues = findBrokenReferences(broken)
    expect(issues.filter((entry) => entry.entityId === 'q-refs').length).toBe(2)
  })
})

describe('findUnsourcedProvenance', () => {
  it('marca una pregunta DEMO que declare año', () => {
    const base = bundle()
    const suspicious: ContentBundle = {
      ...base,
      questions: [{ ...base.questions[0], id: 'q-anio', year: 2023 }],
    }
    const issues = findUnsourcedProvenance(suspicious)
    expect(issues.length).toBe(1)
    expect(issues[0].entityId).toBe('q-anio')
  })
})

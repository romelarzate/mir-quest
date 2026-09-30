import { describe, expect, it } from 'vitest'
import { subjects as progressSubjects } from './demoData'
import {
  curriculumExamVersions,
  curriculumSources,
  curriculumSubjects,
  curriculumTopics,
  demoCurriculumBundle,
  demoCurriculumIndex,
} from './curriculum'
import { demoQuestionBank } from './questions'
import { createCurriculumIndex, findBrokenReferences, findUnsourcedProvenance } from '../domain/content'

describe('currículo DEMO', () => {
  it('declara las 36 asignaturas MIR', () => {
    expect(curriculumSubjects.length).toBe(36)
  })

  it('usa los mismos identificadores que la lista de progreso', () => {
    const progressIds = progressSubjects.map((subject) => subject.id).sort()
    const curriculumIds = curriculumSubjects.map((subject) => subject.id).sort()
    expect(curriculumIds).toEqual(progressIds)
  })

  it('marca todo el contenido estructural como DEMO', () => {
    expect(curriculumSubjects.every((subject) => subject.isDemo)).toBe(true)
    expect(curriculumTopics.every((topic) => topic.isDemo)).toBe(true)
    expect(demoCurriculumBundle.curriculum.isDemo).toBe(true)
  })

  it('cada tema pertenece a una asignatura real', () => {
    const subjectIds = new Set(curriculumSubjects.map((subject) => subject.id))
    expect(curriculumTopics.every((topic) => subjectIds.has(topic.subjectId))).toBe(true)
  })

  it('no declara convocatorias históricas reales', () => {
    expect(curriculumExamVersions.length).toBe(1)
    expect(curriculumExamVersions[0].isDemo).toBe(true)
    expect(curriculumExamVersions[0].notes).toContain('No contiene')
  })

  it('las fuentes son marcadores sin citas inventadas', () => {
    expect(curriculumSources.every((source) => source.citation === null)).toBe(true)
    expect(curriculumSources.every((source) => source.url === null)).toBe(true)
  })

  it('genera un índice navegable sin referencias rotas', () => {
    const bundle = { ...demoCurriculumBundle, questions: demoQuestionBank }
    expect(findBrokenReferences(bundle)).toEqual([])
  })

  it('construye el árbol MIR 2027 con Cardiología y sus temas', () => {
    const index = createCurriculumIndex({ ...demoCurriculumBundle, questions: demoQuestionBank })
    const cardiologyTopics = index.topicsBySubject.get('cardiologia') ?? []
    expect(cardiologyTopics.map((topic) => topic.label)).toContain('Arritmias')
    expect(cardiologyTopics.length).toBeGreaterThanOrEqual(5)
  })
})

describe('procedencia', () => {
  it('no atribuye año ni versión de examen a contenido DEMO', () => {
    const bundle = { ...demoCurriculumBundle, questions: demoQuestionBank }
    expect(findUnsourcedProvenance(bundle)).toEqual([])
  })

  it('el índice DEMO no contiene preguntas porque el banco vive aparte', () => {
    expect(demoCurriculumIndex.questionsById.size).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { findQuestion, demoQuestionBank } from './questions'
import { demoCurriculumIndex } from './curriculum'

describe('banco de preguntas DEMO', () => {
  it('tiene identificadores únicos', () => {
    const ids = demoQuestionBank.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todas las preguntas son DEMO y sin procedencia histórica', () => {
    expect(demoQuestionBank.every((question) => question.isDemo)).toBe(true)
    expect(demoQuestionBank.every((question) => question.sourceType === 'demo')).toBe(true)
    expect(demoQuestionBank.every((question) => question.year === null)).toBe(true)
    expect(demoQuestionBank.every((question) => question.examVersionId === null)).toBe(true)
  })

  it('la opción correcta existe siempre entre las opciones', () => {
    for (const question of demoQuestionBank) {
      expect(question.options.some((option) => option.id === question.correctOptionId), question.id).toBe(true)
    }
  })

  it('cada distractor incorrecto tiene explicación', () => {
    for (const question of demoQuestionBank) {
      const wrongIds = question.options
        .map((option) => option.id)
        .filter((id) => id !== question.correctOptionId)
      for (const wrongId of wrongIds) {
        expect(question.distractorExplanations[wrongId], question.id + ':' + wrongId).toBeTruthy()
      }
    }
  })

  it('tiene al menos cuatro opciones por pregunta', () => {
    expect(demoQuestionBank.every((question) => question.options.length >= 4)).toBe(true)
  })

  it('cada pregunta apunta a asignatura y tema existentes del currículo', () => {
    for (const question of demoQuestionBank) {
      expect(demoCurriculumIndex.subjectsById.has(question.subjectId), question.subjectId).toBe(true)
      if (question.topicId) {
        expect(demoCurriculumIndex.topicsById.has(question.topicId), question.topicId).toBe(true)
      }
      if (question.subtopicId) {
        expect(demoCurriculumIndex.subtopicsById.has(question.subtopicId), question.subtopicId).toBe(true)
      }
      for (const sourceId of question.sourceIds) {
        expect(demoCurriculumIndex.sourcesById.has(sourceId), sourceId).toBe(true)
      }
    }
  })

  it('findQuestion localiza y devuelve undefined si no existe', () => {
    expect(findQuestion('q-cardio-ic-resincronizacion')?.subjectId).toBe('cardiologia')
    expect(findQuestion('no-existe')).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { demoQuestionBank } from '../data/questions'
import { createMemoryStorage, loadState } from '../storage/localStore'
import { createStudyStore } from './studyStore'

const question = demoQuestionBank[0]
const now = new Date('2026-09-29T09:00:00.000Z')

function wrongOptionId() {
  return question.options.find((option) => option.id !== question.correctOptionId)!.id
}

function makeStore() {
  const storage = createMemoryStorage()
  const store = createStudyStore({ storage, now: () => now, questions: demoQuestionBank })
  return { storage, store }
}

describe('flashcards enlazadas', () => {
  it('la tarjeta creada desde un error guarda origen, vínculo y tema', () => {
    const { store } = makeStore()
    const result = store.recordAttempt({ questionId: question.id, selectedOptionId: wrongOptionId() })
    const card = result?.flashcard
    expect(card?.origin).toBe('question')
    expect(card?.errorId).toBe(result?.errorEntry?.id)
    expect(card?.topicId).toBe(question.topicId)
    expect(card?.sourceIds).toEqual(question.sourceIds)
    expect(card?.tags).toEqual(question.tags)
  })

  it('el intento y el error guardan el tema', () => {
    const { store } = makeStore()
    const result = store.recordAttempt({ questionId: question.id, selectedOptionId: wrongOptionId() })
    expect(result?.attempt.topicId).toBe(question.topicId)
    expect(result?.errorEntry?.topicId).toBe(question.topicId)
  })

  it('crea tarjetas manuales vinculadas a tema', () => {
    const { store } = makeStore()
    const card = store.createManualFlashcard({
      front: 'Pregunta manual',
      back: 'Respuesta manual',
      subjectId: 'cardiologia',
      topicId: 'topic-cardio-arritmias',
    })
    expect(card?.origin).toBe('manual')
    expect(card?.questionId).toBeNull()
    expect(store.getState().flashcards.length).toBe(1)
  })

  it('rechaza tarjetas manuales vacías', () => {
    const { store } = makeStore()
    expect(store.createManualFlashcard({ front: '  ', back: 'algo', subjectId: 'cardiologia' })).toBeNull()
    expect(store.getState().flashcards.length).toBe(0)
  })

  it('actualiza una tarjeta existente', () => {
    const { store } = makeStore()
    const card = store.createManualFlashcard({ front: 'antes', back: 'reverso', subjectId: 'cardiologia' })
    const updated = store.updateFlashcard(card!.id, { front: 'después', tags: ['tag-demo'] })
    expect(updated?.front).toBe('después')
    expect(updated?.back).toBe('reverso')
    expect(updated?.tags).toEqual(['tag-demo'])
  })

  it('devuelve null al actualizar una tarjeta inexistente', () => {
    const { store } = makeStore()
    expect(store.updateFlashcard('no-existe', { front: 'x' })).toBeNull()
  })

  it('elimina tarjetas y confirma el borrado', () => {
    const { store } = makeStore()
    const card = store.createManualFlashcard({ front: 'a', back: 'b', subjectId: 'cardiologia' })
    expect(store.deleteFlashcard(card!.id)).toBe(true)
    expect(store.deleteFlashcard(card!.id)).toBe(false)
    expect(store.getState().flashcards.length).toBe(0)
  })
})

describe('historial de simulacros', () => {
  it('guarda intentos de examen y los persiste', () => {
    const { store, storage } = makeStore()
    store.recordExam({
      id: 'exam-1',
      title: 'Simulacro DEMO',
      examVersionId: null,
      questionIds: [question.id],
      answers: { [question.id]: wrongOptionId() },
      correctCount: 0,
      totalCount: 1,
      precision: 0,
      durationMinutes: 30,
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      isDemo: true,
    })
    expect(store.getState().exams.length).toBe(1)
    expect(loadState(storage, now).state.exams.length).toBe(1)
  })
})

describe('compatibilidad del estado', () => {
  it('crea estado v2 con lista de exámenes', () => {
    const { store } = makeStore()
    expect(store.getState().schemaVersion).toBe(3)
    expect(store.getState().exams).toEqual([])
  })
})

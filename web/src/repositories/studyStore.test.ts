import { describe, expect, it } from 'vitest'
import { demoQuestionBank } from '../data/questions'
import { openErrors, precisionPercent } from '../domain/selectors'
import { createMemoryStorage, loadState, storageKeys } from '../storage/localStore'
import { createStudyStore } from './studyStore'

const firstQuestion = demoQuestionBank[0]
const now = new Date('2026-09-29T09:00:00.000Z')

function wrongOptionId() {
  return firstQuestion.options.find((option) => option.id !== firstQuestion.correctOptionId)!.id
}

function makeStore(seed: Record<string, string> = {}) {
  const storage = createMemoryStorage(seed)
  const store = createStudyStore({ storage, now: () => now, questions: demoQuestionBank })
  return { storage, store }
}

describe('recordAttempt', () => {
  it('registra un acierto sin abrir errores', () => {
    const { store } = makeStore()
    const result = store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: firstQuestion.correctOptionId })
    expect(result?.isCorrect).toBe(true)
    expect(result?.errorEntry).toBeNull()
    expect(result?.flashcard).toBeNull()
    expect(store.getState().attempts.length).toBe(1)
    expect(openErrors(store.getState()).length).toBe(0)
  })

  it('abre un error y crea una flashcard al fallar', () => {
    const { store } = makeStore()
    const result = store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: wrongOptionId() })
    expect(result?.isCorrect).toBe(false)
    expect(result?.errorEntry?.timesFailed).toBe(1)
    expect(result?.flashcard?.questionId).toBe(firstQuestion.id)
    expect(store.getState().flashcards.length).toBe(1)
    expect(openErrors(store.getState()).length).toBe(1)
  })

  it('no duplica la flashcard al fallar de nuevo', () => {
    const { store } = makeStore()
    store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: wrongOptionId() })
    const second = store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: wrongOptionId() })
    expect(second?.errorEntry?.timesFailed).toBe(2)
    expect(second?.flashcard).toBeNull()
    expect(store.getState().flashcards.length).toBe(1)
  })

  it('marca el error como recuperado al acertar después', () => {
    const { store } = makeStore()
    store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: wrongOptionId() })
    const fixed = store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: firstQuestion.correctOptionId })
    expect(fixed?.errorEntry?.resolved).toBe(true)
    expect(openErrors(store.getState()).length).toBe(0)
    expect(precisionPercent(store.getState().attempts)).toBe(50)
  })

  it('devuelve null si la pregunta no existe', () => {
    const { store } = makeStore()
    expect(store.recordAttempt({ questionId: 'no-existe', selectedOptionId: 'a' })).toBeNull()
  })

  it('guarda el estado en el almacenamiento', () => {
    const { store, storage } = makeStore()
    store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: wrongOptionId() })
    const reloaded = loadState(storage, now)
    expect(reloaded.state.attempts.length).toBe(1)
    expect(reloaded.state.errors.length).toBe(1)
    expect(reloaded.state.flashcards.length).toBe(1)
  })
})

describe('reviewFlashcard', () => {
  it('reprograma la tarjeta y actualiza el estado', () => {
    const { store } = makeStore()
    const created = store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: wrongOptionId() })?.flashcard
    expect(created).not.toBeNull()
    const reviewed = store.reviewFlashcard(created!.id, 'good')
    expect(reviewed?.intervalDays).toBe(2)
    expect(new Date(reviewed!.dueAt).getTime()).toBeGreaterThan(now.getTime())
    expect(store.getState().flashcards[0].reps).toBe(1)
  })

  it('devuelve null si la tarjeta no existe', () => {
    const { store } = makeStore()
    expect(store.reviewFlashcard('no-existe', 'good')).toBeNull()
  })
})

describe('addFlashcardForQuestion', () => {
  it('crea una tarjeta y evita duplicados', () => {
    const { store } = makeStore()
    const first = store.addFlashcardForQuestion(firstQuestion.id)
    const second = store.addFlashcardForQuestion(firstQuestion.id)
    expect(first?.id).toBe(second?.id)
    expect(store.getState().flashcards.length).toBe(1)
  })
})

describe('ajustes, respaldos y reinicio', () => {
  it('actualiza ajustes y normaliza el tema', () => {
    const { store } = makeStore()
    store.updateSettings({ dailyQuestionGoal: 35, theme: 'dark' })
    expect(store.getState().settings.dailyQuestionGoal).toBe(35)
    expect(store.getState().settings.theme).toBe('dark')
  })

  it('exporta e importa un respaldo completo', () => {
    const { store } = makeStore()
    store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: wrongOptionId() })
    const json = store.exportJson()
    expect(store.getState().settings.lastExportAt).not.toBeNull()

    const { store: fresh } = makeStore()
    const result = fresh.importJson(json)
    expect(result.ok).toBe(true)
    expect(fresh.getState().attempts.length).toBe(1)
  })

  it('rechaza un respaldo inválido', () => {
    const { store } = makeStore()
    const result = store.importJson('no es json')
    expect(result.ok).toBe(false)
  })

  it('reinicia los datos y conserva el tema', () => {
    const { store } = makeStore()
    store.updateSettings({ theme: 'dark' })
    store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: wrongOptionId() })
    store.resetAll()
    expect(store.getState().attempts.length).toBe(0)
    expect(store.getState().flashcards.length).toBe(0)
    expect(store.getState().settings.theme).toBe('dark')
  })

  it('expone el estado de carga con la clave de almacenamiento', () => {
    const { store } = makeStore({ [storageKeys.legacyTheme]: 'light' })
    const status = store.getStatus()
    expect(status.persistenceAvailable).toBe(true)
    expect(status.status).toBe('missing')
    expect(store.getState().settings.theme).toBe('light')
  })
})

describe('suscripción', () => {
  it('notifica a los suscriptores al cambiar el estado', () => {
    const { store } = makeStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls += 1
    })
    store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: firstQuestion.correctOptionId })
    expect(calls).toBe(1)
    unsubscribe()
    store.recordAttempt({ questionId: firstQuestion.id, selectedOptionId: firstQuestion.correctOptionId })
    expect(calls).toBe(1)
  })
})

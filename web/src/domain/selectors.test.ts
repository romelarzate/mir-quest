import { describe, expect, it } from 'vitest'
import { attemptsOnDay, attemptsByWeekday, openErrors, precisionPercent, streakDays } from './selectors'
import type { StudyState } from './types'

function makeState(overrides: Partial<StudyState> = {}): StudyState {
  return {
    schemaVersion: 1,
    attempts: [],
    errors: [],
    flashcards: [],
    exams: [],
    documents: [],
    settings: {
      dailyQuestionGoal: 20,
      dailyFlashcardGoal: 30,
      explanationsImmediately: true,
      theme: 'system',
      lastExportAt: null,
    },
    updatedAt: '2026-09-29T09:00:00.000Z',
    ...overrides,
  }
}

const now = new Date('2026-09-29T12:00:00.000Z')

describe('precisionPercent', () => {
  it('devuelve null sin intentos', () => {
    expect(precisionPercent([])).toBeNull()
  })

  it('calcula el porcentaje redondeado', () => {
    const attempts = [
      { id: '1', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: now.toISOString() },
      { id: '2', questionId: 'q2', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: false, answeredAt: now.toISOString() },
      { id: '3', questionId: 'q3', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: now.toISOString() },
    ]
    expect(precisionPercent(attempts)).toBe(67)
  })
})

describe('attemptsOnDay', () => {
  it('filtra por día natural', () => {
    const state = makeState({
      attempts: [
        { id: 'hoy', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: '2026-09-29T08:00:00.000Z' },
        { id: 'ayer', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: '2026-09-28T08:00:00.000Z' },
      ],
    })
    expect(attemptsOnDay(state, now).map((attempt) => attempt.id)).toEqual(['hoy'])
  })
})

describe('streakDays', () => {
  it('cuenta días consecutivos incluyendo hoy', () => {
    const state = makeState({
      attempts: [
        { id: '1', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: new Date('2026-09-29T08:00:00.000Z').toISOString() },
        { id: '2', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: new Date('2026-09-28T08:00:00.000Z').toISOString() },
        { id: '3', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: new Date('2026-09-26T08:00:00.000Z').toISOString() },
      ],
    })
    expect(streakDays(state, now)).toBe(2)
  })

  it('cuenta la racha si el último día con actividad fue ayer', () => {
    const state = makeState({
      attempts: [
        { id: '1', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: new Date('2026-09-28T08:00:00.000Z').toISOString() },
        { id: '2', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: new Date('2026-09-27T08:00:00.000Z').toISOString() },
      ],
    })
    expect(streakDays(state, now)).toBe(2)
  })

  it('devuelve 0 sin actividad reciente', () => {
    expect(streakDays(makeState(), now)).toBe(0)
  })
})

describe('openErrors', () => {
  it('excluye los resueltos y filtra por asignatura', () => {
    const state = makeState({
      errors: [
        { id: 'a', questionId: 'q1', subjectId: 'cardiologia', timesFailed: 1, firstFailedAt: now.toISOString(), lastFailedAt: now.toISOString(), resolved: false },
        { id: 'b', questionId: 'q2', subjectId: 'cardiologia', timesFailed: 1, firstFailedAt: now.toISOString(), lastFailedAt: now.toISOString(), resolved: true },
        { id: 'c', questionId: 'q3', subjectId: 'neumologia', timesFailed: 2, firstFailedAt: now.toISOString(), lastFailedAt: now.toISOString(), resolved: false },
      ],
    })
    expect(openErrors(state).map((entry) => entry.id)).toEqual(['a', 'c'])
    expect(openErrors(state, 'cardiologia').map((entry) => entry.id)).toEqual(['a'])
  })
})

describe('attemptsByWeekday', () => {
  it('agrupa por día de la semana', () => {
    const state = makeState({
      attempts: [
        { id: '1', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: true, answeredAt: '2026-09-29T08:00:00.000Z' },
        { id: '2', questionId: 'q', subjectId: 'cardiologia', selectedOptionId: 'a', isCorrect: false, answeredAt: '2026-09-29T09:00:00.000Z' },
      ],
    })
    const buckets = attemptsByWeekday(state)
    const martes = buckets.find((bucket) => bucket.day === 'Mar')
    expect(martes?.intentos).toBe(2)
    expect(martes?.precisión).toBe(50)
  })
})

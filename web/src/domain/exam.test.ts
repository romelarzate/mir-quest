import { describe, expect, it } from 'vitest'
import { demoQuestionBank } from '../data/questions'
import { createDefaultState } from '../storage/localStore'
import {
  answerExamQuestion,
  buildExamSession,
  defaultExamConfig,
  finishExam,
  scoreExam,
  selectExamQuestions,
  toExamAttempt,
} from './exam'
import type { ExamConfig } from './exam'
import type { StudyState } from './types'

const now = new Date('2026-09-29T09:00:00.000Z')

function state(overrides: Partial<StudyState> = {}): StudyState {
  return { ...createDefaultState(now, 'system'), ...overrides }
}

function config(overrides: Partial<ExamConfig> = {}): ExamConfig {
  return { ...defaultExamConfig, ...overrides }
}

describe('selectExamQuestions', () => {
  it('respeta el número solicitado', () => {
    const selected = selectExamQuestions({ bank: demoQuestionBank, config: config({ questionCount: 4 }), state: state() })
    expect(selected.length).toBe(4)
  })

  it('no devuelve más preguntas de las disponibles', () => {
    const selected = selectExamQuestions({ bank: demoQuestionBank, config: config({ questionCount: 500 }), state: state() })
    expect(selected.length).toBe(demoQuestionBank.length)
  })

  it('filtra por asignatura', () => {
    const selected = selectExamQuestions({
      bank: demoQuestionBank,
      config: config({ questionCount: 20, subjectIds: ['cardiologia'] }),
      state: state(),
    })
    expect(selected.length).toBe(3)
    expect(selected.every((question) => question.subjectId === 'cardiologia')).toBe(true)
  })

  it('filtra por tema', () => {
    const selected = selectExamQuestions({
      bank: demoQuestionBank,
      config: config({ questionCount: 20, topicIds: ['topic-neumo-epoc'] }),
      state: state(),
    })
    expect(selected.map((question) => question.id)).toEqual(['q-neumo-epoc-espirometria'])
  })

  it('filtra por dificultad', () => {
    const selected = selectExamQuestions({
      bank: demoQuestionBank,
      config: config({ questionCount: 20, difficulties: ['Difícil'] }),
      state: state(),
    })
    expect(selected.every((question) => question.difficulty === 'Difícil')).toBe(true)
  })

  it('prioriza las preguntas con error abierto', () => {
    const failedId = 'q-neumo-epoc-espirometria'
    const selected = selectExamQuestions({
      bank: demoQuestionBank,
      config: config({ questionCount: 3 }),
      state: state({
        errors: [
          { id: 'e1', questionId: failedId, subjectId: 'neumologia', timesFailed: 2, firstFailedAt: now.toISOString(), lastFailedAt: now.toISOString(), resolved: false },
        ],
      }),
    })
    expect(selected[0].id).toBe(failedId)
  })

  it('excluye preguntas nuevas si includeNew es false', () => {
    const seenId = 'q-cardio-ic-resincronizacion'
    const selected = selectExamQuestions({
      bank: demoQuestionBank,
      config: config({ questionCount: 20, includeNew: false }),
      state: state({
        attempts: [{ id: 'a1', questionId: seenId, subjectId: 'cardiologia', selectedOptionId: 'b', isCorrect: true, answeredAt: now.toISOString() }],
      }),
    })
    expect(selected.map((question) => question.id)).toEqual([seenId])
  })

  it('excluye preguntas falladas si includeFailed es false', () => {
    const failedId = 'q-neumo-epoc-espirometria'
    const selected = selectExamQuestions({
      bank: demoQuestionBank,
      config: config({ questionCount: 20, includeFailed: false, includeNew: false }),
      state: state({
        errors: [
          { id: 'e1', questionId: failedId, subjectId: 'neumologia', timesFailed: 1, firstFailedAt: now.toISOString(), lastFailedAt: now.toISOString(), resolved: false },
        ],
      }),
    })
    expect(selected.map((question) => question.id)).not.toContain(failedId)
  })

  it('es determinista con la misma entrada', () => {
    const first = selectExamQuestions({ bank: demoQuestionBank, config: config({ questionCount: 6 }), state: state() })
    const second = selectExamQuestions({ bank: demoQuestionBank, config: config({ questionCount: 6 }), state: state() })
    expect(first.map((q) => q.id)).toEqual(second.map((q) => q.id))
  })
})

describe('flujo del simulacro', () => {
  const session = buildExamSession({
    bank: demoQuestionBank,
    config: config({ questionCount: 4 }),
    state: state(),
    now,
    id: 'exam-1',
  })

  it('crea la sesión sin respuestas', () => {
    expect(session.questionIds.length).toBe(4)
    expect(session.answers).toEqual({})
    expect(session.finishedAt).toBeNull()
  })

  it('registra respuestas y puntúa correctamente', () => {
    let current = answerExamQuestion(session, session.questionIds[0], demoQuestionBank[0].correctOptionId)
    current = answerExamQuestion(current, session.questionIds[1], 'zz')
    const result = scoreExam(current, demoQuestionBank)
    expect(result.totalCount).toBe(4)
    expect(result.answeredCount).toBe(2)
    expect(result.correctCount).toBe(1)
    expect(result.incorrectCount).toBe(1)
    expect(result.blankCount).toBe(2)
    expect(result.precision).toBe(50)
    expect(result.wrongQuestionIds.length).toBe(1)
  })

  it('ignora respuestas a preguntas fuera del examen', () => {
    const updated = answerExamQuestion(session, 'q-no-esta', 'a')
    expect(updated.answers).toEqual({})
  })

  it('agrupa estadísticas por asignatura', () => {
    const current = answerExamQuestion(session, session.questionIds[0], demoQuestionBank[0].correctOptionId)
    const result = scoreExam(current, demoQuestionBank)
    expect(result.perSubject.length).toBeGreaterThan(0)
    expect(result.perSubject.every((stat) => stat.total > 0)).toBe(true)
  })

  it('cierra la sesión y genera un intento persistible', () => {
    const closed = finishExam(session, demoQuestionBank, now)
    expect(closed.session.finishedAt).toBe(now.toISOString())
    const attempt = toExamAttempt({ session: closed.session, result: closed.result, now })
    expect(attempt.id).toBe('exam-1')
    expect(attempt.totalCount).toBe(4)
    expect(attempt.isDemo).toBe(true)
    expect(attempt.examVersionId).toBeNull()
  })
})

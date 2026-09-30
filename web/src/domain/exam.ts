import type { ExamAttempt, Question, QuestionDifficulty, StudyState } from './types'

export type ExamConfig = {
  questionCount: number
  subjectIds: string[]
  topicIds: string[]
  difficulties: QuestionDifficulty[]
  includeNew: boolean
  includeFailed: boolean
  durationMinutes: number | null
}

export const defaultExamConfig: ExamConfig = {
  questionCount: 10,
  subjectIds: [],
  topicIds: [],
  difficulties: [],
  includeNew: true,
  includeFailed: true,
  durationMinutes: 30,
}

export type ExamSession = {
  id: string
  title: string
  config: ExamConfig
  questionIds: string[]
  startedAt: string
  finishedAt: string | null
  answers: Record<string, string | null>
}

export type ExamSubjectStat = {
  subjectId: string
  total: number
  answered: number
  correct: number
  precision: number
}

export type ExamResult = {
  totalCount: number
  answeredCount: number
  blankCount: number
  correctCount: number
  incorrectCount: number
  precision: number
  perSubject: ExamSubjectStat[]
  wrongQuestionIds: string[]
  blankQuestionIds: string[]
}

/**
 * Selección determinista: primero las preguntas falladas con error abierto,
 * después las ya vistas y por último las nuevas. Sin aleatoriedad para que
 * el resultado sea reproducible y comprobable.
 */
export function selectExamQuestions(input: {
  bank: Question[]
  config: ExamConfig
  state: StudyState
}): Question[] {
  const openErrorIds = new Set(
    input.state.errors.filter((entry) => !entry.resolved).map((entry) => entry.questionId),
  )
  const attemptedIds = new Set(input.state.attempts.map((attempt) => attempt.questionId))

  const candidates = input.bank
    .filter((question) => {
      if (input.config.subjectIds.length > 0 && !input.config.subjectIds.includes(question.subjectId)) return false
      if (
        input.config.topicIds.length > 0 &&
        !(question.topicId !== null && input.config.topicIds.includes(question.topicId))
      ) {
        return false
      }
      if (input.config.difficulties.length > 0 && !input.config.difficulties.includes(question.difficulty)) {
        return false
      }
      return true
    })
    .map((question) => ({
      question,
      priority: openErrorIds.has(question.id) ? 0 : attemptedIds.has(question.id) ? 1 : 2,
    }))
    .filter((item) => {
      if (!input.config.includeFailed && item.priority === 0) return false
      if (!input.config.includeNew && item.priority === 2) return false
      return true
    })
    .sort((a, b) => a.priority - b.priority)

  const requested = Math.max(0, input.config.questionCount)
  return candidates.slice(0, requested).map((item) => item.question)
}

export function buildExamSession(input: {
  bank: Question[]
  config: ExamConfig
  state: StudyState
  now: Date
  id: string
  title?: string
}): ExamSession {
  const questions = selectExamQuestions(input)
  return {
    id: input.id,
    title: input.title ?? 'Simulacro DEMO',
    config: input.config,
    questionIds: questions.map((question) => question.id),
    startedAt: input.now.toISOString(),
    finishedAt: null,
    answers: {},
  }
}

export function answerExamQuestion(session: ExamSession, questionId: string, optionId: string | null): ExamSession {
  if (!session.questionIds.includes(questionId)) return session
  return { ...session, answers: { ...session.answers, [questionId]: optionId } }
}

export function scoreExam(session: ExamSession, bank: Question[]): ExamResult {
  const byId = new Map(bank.map((question) => [question.id, question]))
  const perSubjectMap = new Map<string, ExamSubjectStat>()
  const wrongQuestionIds: string[] = []
  const blankQuestionIds: string[] = []
  let correctCount = 0
  let answeredCount = 0

  for (const questionId of session.questionIds) {
    const question = byId.get(questionId)
    if (!question) continue
    const stat =
      perSubjectMap.get(question.subjectId) ??
      { subjectId: question.subjectId, total: 0, answered: 0, correct: 0, precision: 0 }
    stat.total += 1

    const answer = session.answers[questionId] ?? null
    if (answer === null) {
      blankQuestionIds.push(questionId)
    } else {
      answeredCount += 1
      stat.answered += 1
      if (answer === question.correctOptionId) {
        correctCount += 1
        stat.correct += 1
      } else {
        wrongQuestionIds.push(questionId)
      }
    }
    perSubjectMap.set(question.subjectId, stat)
  }

  const perSubject = Array.from(perSubjectMap.values()).map((stat) => ({
    ...stat,
    precision: stat.answered === 0 ? 0 : Math.round((stat.correct / stat.answered) * 100),
  }))

  const totalCount = session.questionIds.length
  return {
    totalCount,
    answeredCount,
    blankCount: blankQuestionIds.length,
    correctCount,
    incorrectCount: wrongQuestionIds.length,
    precision: answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100),
    perSubject,
    wrongQuestionIds,
    blankQuestionIds,
  }
}

export function finishExam(session: ExamSession, bank: Question[], now: Date): { session: ExamSession; result: ExamResult } {
  const finished: ExamSession = { ...session, finishedAt: now.toISOString() }
  return { session: finished, result: scoreExam(finished, bank) }
}

export function toExamAttempt(input: {
  session: ExamSession
  result: ExamResult
  now: Date
  examVersionId?: string | null
}): ExamAttempt {
  const startedAt = new Date(input.session.startedAt).getTime()
  const elapsedMinutes = Math.max(0, Math.round((input.now.getTime() - startedAt) / 60000))
  return {
    id: input.session.id,
    title: input.session.title,
    examVersionId: input.examVersionId ?? null,
    questionIds: input.session.questionIds,
    answers: input.session.answers,
    correctCount: input.result.correctCount,
    totalCount: input.result.totalCount,
    precision: input.result.precision,
    durationMinutes: input.session.config.durationMinutes === null ? elapsedMinutes : input.session.config.durationMinutes,
    startedAt: input.session.startedAt,
    finishedAt: input.now.toISOString(),
    isDemo: true,
  }
}

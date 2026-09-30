import type { Attempt, ErrorEntry, Flashcard, StudyState } from './types'
import { isDue } from './srs'

export function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function attemptsOnDay(state: StudyState, day: Date): Attempt[] {
  return state.attempts.filter((attempt) => isSameDay(new Date(attempt.answeredAt), day))
}

export function attemptsForSubject(state: StudyState, subjectId: string): Attempt[] {
  return state.attempts.filter((attempt) => attempt.subjectId === subjectId)
}

export function attemptsForQuestion(state: StudyState, questionId: string): Attempt[] {
  return state.attempts.filter((attempt) => attempt.questionId === questionId)
}

export function precisionPercent(attempts: Attempt[]): number | null {
  if (attempts.length === 0) return null
  const correct = attempts.filter((attempt) => attempt.isCorrect).length
  return Math.round((correct / attempts.length) * 100)
}

export function dueFlashcards(state: StudyState, now: Date): Flashcard[] {
  return state.flashcards
    .filter((card) => isDue(card, now))
    .slice()
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
}

export function openErrors(state: StudyState, subjectId?: string): ErrorEntry[] {
  return state.errors
    .filter((entry) => !entry.resolved)
    .filter((entry) => (subjectId ? entry.subjectId === subjectId : true))
    .slice()
    .sort((a, b) => new Date(b.lastFailedAt).getTime() - new Date(a.lastFailedAt).getTime())
}

export function streakDays(state: StudyState, now: Date): number {
  if (state.attempts.length === 0) return 0
  const studied = new Set(state.attempts.map((attempt) => dayKey(new Date(attempt.answeredAt))))
  const cursor = startOfDay(now)
  if (!studied.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!studied.has(dayKey(cursor))) return 0
  }
  let streak = 0
  while (studied.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function attemptsByWeekday(state: StudyState): Array<{ day: string; intentos: number; precisión: number }> {
  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const buckets = labels.map((day) => ({ day, intentos: 0, correctas: 0 }))
  for (const attempt of state.attempts) {
    const bucket = buckets[new Date(attempt.answeredAt).getDay()]
    bucket.intentos += 1
    if (attempt.isCorrect) bucket.correctas += 1
  }
  return buckets.map((bucket) => ({
    day: bucket.day,
    intentos: bucket.intentos,
    precisión: bucket.intentos === 0 ? 0 : Math.round((bucket.correctas / bucket.intentos) * 100),
  }))
}

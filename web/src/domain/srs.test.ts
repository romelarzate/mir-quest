import { describe, expect, it } from 'vitest'
import { clampEase, createFlashcard, dueFlashcards, scheduleReview } from './srs'
import type { Flashcard } from './types'

const baseDate = new Date('2026-09-29T09:00:00.000Z')

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  const base = createFlashcard({
    id: 'card-1',
    questionId: 'q-cardio-ic-resincronizacion',
    subjectId: 'cardiologia',
    front: 'frente',
    back: 'reverso',
    now: baseDate,
    isDemo: true,
  })
  return { ...base, ...overrides }
}

describe('clampEase', () => {
  it('mantiene la facilidad dentro de los límites', () => {
    expect(clampEase(0.5)).toBe(1.3)
    expect(clampEase(9)).toBe(2.8)
    expect(clampEase(2.34)).toBe(2.34)
  })
})

describe('scheduleReview', () => {
  it('trata "again" como fallo y reprograma en 10 minutos', () => {
    const reviewed = scheduleReview(makeCard({ intervalDays: 10 }), 'again', baseDate)
    expect(reviewed.intervalDays).toBe(0)
    expect(reviewed.lapses).toBe(1)
    expect(reviewed.reps).toBe(1)
    expect(new Date(reviewed.dueAt).getTime() - baseDate.getTime()).toBe(10 * 60 * 1000)
  })

  it('programa la primera respuesta buena en 2 días', () => {
    const reviewed = scheduleReview(makeCard({ intervalDays: 0, reps: 0 }), 'good', baseDate)
    expect(reviewed.intervalDays).toBe(2)
    expect(reviewed.lapses).toBe(0)
    expect(new Date(reviewed.dueAt).getTime() - baseDate.getTime()).toBe(2 * 24 * 60 * 60 * 1000)
  })

  it('multiplica el intervalo por la facilidad cuando la respuesta es buena', () => {
    const reviewed = scheduleReview(makeCard({ intervalDays: 10, ease: 2.5, reps: 3 }), 'good', baseDate)
    expect(reviewed.intervalDays).toBe(25)
    expect(reviewed.ease).toBe(2.5)
  })

  it('aumenta la facilidad en "easy" y la reduce en "hard"', () => {
    const easy = scheduleReview(makeCard({ ease: 2.3 }), 'easy', baseDate)
    const hard = scheduleReview(makeCard({ ease: 2.3 }), 'hard', baseDate)
    expect(easy.ease).toBeCloseTo(2.45)
    expect(hard.ease).toBeCloseTo(2.15)
  })

  it('no baja de los límites de facilidad tras muchos fallos', () => {
    let card = makeCard({ ease: 1.4 })
    for (let index = 0; index < 5; index += 1) {
      card = scheduleReview(card, 'again', baseDate)
    }
    expect(card.ease).toBe(1.3)
  })
})

describe('dueFlashcards', () => {
  it('devuelve solo las vencidas y las ordena por fecha', () => {
    const cards = [
      makeCard({ id: 'futura', dueAt: new Date(baseDate.getTime() + 60_000).toISOString() }),
      makeCard({ id: 'vieja', dueAt: new Date(baseDate.getTime() - 120_000).toISOString() }),
      makeCard({ id: 'reciente', dueAt: new Date(baseDate.getTime() - 60_000).toISOString() }),
    ]
    expect(dueFlashcards(cards, baseDate).map((card) => card.id)).toEqual(['vieja', 'reciente'])
  })
})

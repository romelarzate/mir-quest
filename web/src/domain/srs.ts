import type { Flashcard, FlashcardOrigin, FlashcardRating } from './types'

const dayMs = 24 * 60 * 60 * 1000
const relearnMs = 10 * 60 * 1000

export const easeBounds = { min: 1.3, max: 2.8 }
export const initialEase = 2.3

const easeAdjust: Record<FlashcardRating, number> = {
  again: -0.3,
  hard: -0.15,
  good: 0,
  easy: 0.15,
}

export function clampEase(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return Math.min(easeBounds.max, Math.max(easeBounds.min, rounded))
}

export function isDue(card: Flashcard, now: Date): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime()
}

export function dueFlashcards(cards: Flashcard[], now: Date): Flashcard[] {
  return cards
    .filter((card) => isDue(card, now))
    .slice()
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
}

export function scheduleReview(card: Flashcard, rating: FlashcardRating, now: Date): Flashcard {
  const ease = clampEase(card.ease + easeAdjust[rating])
  let intervalDays = card.intervalDays
  let lapses = card.lapses
  let dueAt: Date

  if (rating === 'again') {
    intervalDays = 0
    lapses += 1
    dueAt = new Date(now.getTime() + relearnMs)
  } else {
    if (card.intervalDays <= 0) {
      intervalDays = rating === 'hard' ? 1 : rating === 'good' ? 2 : 4
    } else {
      const multiplier = rating === 'hard' ? 1.2 : rating === 'good' ? ease : ease * 1.3
      intervalDays = Math.max(1, Math.round(card.intervalDays * multiplier))
    }
    dueAt = new Date(now.getTime() + intervalDays * dayMs)
  }

  return {
    ...card,
    ease,
    intervalDays,
    lapses,
    reps: card.reps + 1,
    dueAt: dueAt.toISOString(),
    lastReviewedAt: now.toISOString(),
  }
}

export function createFlashcard(input: {
  id: string
  questionId: string | null
  subjectId: string
  front: string
  back: string
  now: Date
  isDemo: boolean
  origin?: FlashcardOrigin
  errorId?: string | null
  topicId?: string | null
  subtopicId?: string | null
  sourceIds?: string[]
  tags?: string[]
}): Flashcard {
  return {
    id: input.id,
    questionId: input.questionId,
    errorId: input.errorId ?? null,
    subjectId: input.subjectId,
    topicId: input.topicId ?? null,
    subtopicId: input.subtopicId ?? null,
    origin: input.origin ?? (input.questionId ? 'question' : 'manual'),
    sourceIds: input.sourceIds ?? [],
    tags: input.tags ?? [],
    front: input.front,
    back: input.back,
    ease: initialEase,
    intervalDays: 0,
    dueAt: input.now.toISOString(),
    reps: 0,
    lapses: 0,
    createdAt: input.now.toISOString(),
    lastReviewedAt: null,
    isDemo: input.isDemo,
  }
}

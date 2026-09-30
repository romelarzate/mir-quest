import type { LucideIcon } from 'lucide-react'

/**
 * Reexporta el modelo compartido para no duplicar definiciones.
 * El modelo de contenido vive en src/domain/types.ts.
 */
export type {
  SubjectBlockId,
  SubjectBlockOption,
  SubjectProgress,
  Question,
  QuestionDifficulty,
  QuestionOption,
  Flashcard,
  FlashcardOrigin,
  FlashcardRating,
  SourceReference,
  SourceType,
  Tag,
  TagKind,
  ThemeMode,
} from './domain/types'

export type ViewId =
  | 'dashboard'
  | 'route'
  | 'subjects'
  | 'subject-detail'
  | 'library'
  | 'questions'
  | 'flashcards'
  | 'mocks'
  | 'atlas'
  | 'stats'
  | 'settings'

export type NavItem = {
  id: ViewId
  label: string
  shortLabel: string
  icon: LucideIcon
}

export type StatCard = {
  label: string
  value: string
  detail: string
  tone: 'blue' | 'violet' | 'green' | 'coral' | 'gold'
}

export type AtlasMessage = {
  role: 'student' | 'atlas'
  text: string
}

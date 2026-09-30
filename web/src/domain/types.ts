import type { DocumentRecord } from './documents'

export const SCHEMA_VERSION = 3

export type SubjectBlockId =
  | 'medicina'
  | 'clinica'
  | 'quirurgica'
  | 'salud-publica'
  | 'basicas'
  | 'diagnostico'
  | 'transversal'

export type SubjectBlockOption = {
  value: 'todos' | SubjectBlockId
  label: string
}

/** Resumen de progreso que consume la interfaz. No es el modelo de contenido. */
export type SubjectProgress = {
  id: string
  name: string
  blockId: SubjectBlockId
  blockLabel: string
  progress: number
  questions: number
  accuracy: number
  dueCards: number
  forgettingRisk: number
  priority: 'Alta' | 'Media' | 'Baja'
}

export type ContentStatus = 'demo' | 'pending-import' | 'imported'

export type SourceType = 'demo' | 'manual' | 'authorized' | 'historical' | 'ai'

/** Referencia bibliográfica o de procedencia. Nunca se inventa una cita real. */
export type SourceReference = {
  id: string
  type: SourceType
  label: string
  citation: string | null
  url: string | null
  year: number | null
  examVersionId: string | null
  notes: string | null
}

export type TagKind = 'subject' | 'topic' | 'difficulty' | 'year' | 'custom'

export type Tag = {
  id: string
  label: string
  kind: TagKind
}

export type Curriculum = {
  id: string
  label: string
  examYear: number
  isDemo: boolean
  description: string
}

export type Subject = {
  id: string
  label: string
  blockId: SubjectBlockId
  order: number
  contentStatus: ContentStatus
  isDemo: boolean
  notes: string | null
}

export type Topic = {
  id: string
  subjectId: string
  label: string
  order: number
  contentStatus: ContentStatus
  isDemo: boolean
}

export type Subtopic = {
  id: string
  topicId: string
  subjectId: string
  label: string
  order: number
  contentStatus: ContentStatus
  isDemo: boolean
}

export type ContentBlockKind = 'summary' | 'note' | 'reference' | 'image' | 'algorithm' | 'table'

export type ContentBlock = {
  id: string
  subjectId: string
  topicId: string
  subtopicId: string | null
  kind: ContentBlockKind
  title: string
  body: string
  sourceIds: string[]
  contentStatus: ContentStatus
  isDemo: boolean
}

export type QuestionDifficulty = 'Fácil' | 'Media' | 'Difícil'

export type QuestionOption = {
  id: string
  text: string
}

export type Question = {
  id: string
  subjectId: string
  topicId: string | null
  subtopicId: string | null
  stem: string
  options: QuestionOption[]
  correctOptionId: string
  explanation: string
  distractorExplanations: Record<string, string>
  difficulty: QuestionDifficulty
  sourceType: SourceType
  sourceIds: string[]
  year: number | null
  examVersionId: string | null
  tags: string[]
  createdAt: string
  isDemo: boolean
}

export type ExamVersion = {
  id: string
  label: string
  year: number | null
  isDemo: boolean
  sourceIds: string[]
  notes: string | null
}

export type Exam = {
  id: string
  title: string
  examVersionId: string | null
  questionIds: string[]
  durationMinutes: number | null
  isDemo: boolean
  createdAt: string
}

export type ExamQuestion = {
  examId: string
  questionId: string
  position: number
  points: number
}

export type Attempt = {
  id: string
  questionId: string
  subjectId: string
  topicId?: string | null
  selectedOptionId: string
  isCorrect: boolean
  answeredAt: string
}

export type ErrorEntry = {
  id: string
  questionId: string
  subjectId: string
  topicId?: string | null
  timesFailed: number
  firstFailedAt: string
  lastFailedAt: string
  resolved: boolean
}

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy'

export type FlashcardOrigin = 'question' | 'manual' | 'ai' | 'error'

export type Flashcard = {
  id: string
  questionId: string | null
  errorId: string | null
  subjectId: string
  topicId: string | null
  subtopicId: string | null
  origin: FlashcardOrigin
  sourceIds: string[]
  tags: string[]
  front: string
  back: string
  ease: number
  intervalDays: number
  dueAt: string
  reps: number
  lapses: number
  createdAt: string
  lastReviewedAt: string | null
  isDemo: boolean
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type StudySettings = {
  dailyQuestionGoal: number
  dailyFlashcardGoal: number
  explanationsImmediately: boolean
  theme: ThemeMode
  lastExportAt: string | null
}

export type ExamAttempt = {
  id: string
  title: string
  examVersionId: string | null
  questionIds: string[]
  answers: Record<string, string | null>
  correctCount: number
  totalCount: number
  precision: number
  durationMinutes: number | null
  startedAt: string
  finishedAt: string
  isDemo: boolean
}

export type StudyState = {
  schemaVersion: number
  attempts: Attempt[]
  errors: ErrorEntry[]
  flashcards: Flashcard[]
  exams: ExamAttempt[]
  documents: DocumentRecord[]
  settings: StudySettings
  updatedAt: string
}

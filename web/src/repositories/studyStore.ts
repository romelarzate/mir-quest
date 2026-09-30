import type { DocumentRecord } from '../domain/documents'
import type {
  Attempt,
  ErrorEntry,
  ExamAttempt,
  Flashcard,
  FlashcardOrigin,
  FlashcardRating,
  Question,
  StudySettings,
  StudyState,
} from '../domain/types'
import { createFlashcard, scheduleReview } from '../domain/srs'
import { normalizeTheme } from '../domain/migrations'
import type { KeyValueStorage, LoadStatus } from '../storage/localStore'
import {
  clearState,
  createDefaultState,
  getBrowserStorage,
  loadState,
  parseStoredState,
  saveState,
  serializeState,
} from '../storage/localStore'
import { demoQuestionBank, findQuestion } from '../data/questions'

let idCounter = 0

export function createId(prefix: string, now: Date): string {
  const random =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : String(now.getTime()) + '-' + String(++idCounter)
  return prefix + '_' + random
}

export type StudyStatus = {
  status: LoadStatus
  message: string
  appliedMigrations: string[]
  persistenceBlocked: boolean
  persistenceAvailable: boolean
}

export type RecordAttemptResult = {
  attempt: Attempt
  question: Question
  isCorrect: boolean
  errorEntry: ErrorEntry | null
  flashcard: Flashcard | null
}

export type ManualFlashcardInput = {
  front: string
  back: string
  subjectId: string
  topicId?: string | null
  subtopicId?: string | null
  sourceIds?: string[]
  tags?: string[]
  origin?: FlashcardOrigin
}

export type FlashcardPatch = {
  front?: string
  back?: string
  subjectId?: string
  topicId?: string | null
  subtopicId?: string | null
  tags?: string[]
}

export type ImportResult = { ok: true; state: StudyState } | { ok: false; error: string }

export type StudyStore = {
  getState: () => StudyState
  getStatus: () => StudyStatus
  subscribe: (listener: () => void) => () => void
  recordAttempt: (input: { questionId: string; selectedOptionId: string }) => RecordAttemptResult | null
  reviewFlashcard: (flashcardId: string, rating: FlashcardRating) => Flashcard | null
  addFlashcardForQuestion: (questionId: string, front?: string, back?: string) => Flashcard | null
  createManualFlashcard: (input: ManualFlashcardInput) => Flashcard | null
  updateFlashcard: (flashcardId: string, patch: FlashcardPatch) => Flashcard | null
  deleteFlashcard: (flashcardId: string) => boolean
  setErrorResolved: (errorId: string, resolved: boolean) => void
  recordExam: (attempt: ExamAttempt) => void
  upsertDocument: (record: DocumentRecord) => void
  removeDocument: (documentId: string) => boolean
  updateSettings: (patch: Partial<StudySettings>) => void
  resetAll: () => void
  exportJson: () => string
  importJson: (json: string) => ImportResult
}

export type StudyStoreOptions = {
  storage?: KeyValueStorage | null
  now?: () => Date
  questions?: Question[]
}

export function createStudyStore(options: StudyStoreOptions = {}): StudyStore {
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage
  const now = options.now ?? (() => new Date())
  const questions = options.questions ?? demoQuestionBank
  const listeners = new Set<() => void>()

  const initial = storage
    ? loadState(storage, now())
    : {
        state: createDefaultState(now(), 'system'),
        status: 'missing' as LoadStatus,
        appliedMigrations: [] as string[],
        message: 'Sin almacenamiento disponible: los cambios son solo de sesión.',
        persistenceBlocked: false,
      }

  let state = initial.state
  const status: StudyStatus = {
    status: initial.status,
    message: initial.message,
    appliedMigrations: initial.appliedMigrations,
    persistenceBlocked: initial.persistenceBlocked,
    persistenceAvailable: Boolean(storage),
  }

  function emit() {
    for (const listener of listeners) listener()
  }

  function persist() {
    if (!storage || status.persistenceBlocked) return
    try {
      saveState(storage, state)
    } catch {
      /* almacenamiento lleno o bloqueado: se conserva el estado en memoria */
    }
  }

  function commit(next: StudyState) {
    state = { ...next, updatedAt: now().toISOString() }
    persist()
    emit()
  }

  function findFlashcardByQuestion(questionId: string): Flashcard | undefined {
    return state.flashcards.find((card) => card.questionId === questionId)
  }

  function answerText(question: Question): string {
    const correctOption = question.options.find((option) => option.id === question.correctOptionId)
    return 'Respuesta correcta: ' + (correctOption ? correctOption.text : 'ver explicación') + '. ' + question.explanation
  }

  return {
    getState: () => state,

    getStatus: () => status,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    recordAttempt: ({ questionId, selectedOptionId }) => {
      const question = findQuestion(questionId, questions)
      if (!question) return null
      const at = now()
      const isCorrect = selectedOptionId === question.correctOptionId

      const attempt: Attempt = {
        id: createId('attempt', at),
        questionId,
        subjectId: question.subjectId,
        topicId: question.topicId,
        selectedOptionId,
        isCorrect,
        answeredAt: at.toISOString(),
      }

      const existingError = state.errors.find((entry) => entry.questionId === questionId)
      let errorEntry: ErrorEntry | null = null
      let errors = state.errors

      if (!isCorrect) {
        if (existingError) {
          errorEntry = {
            ...existingError,
            timesFailed: existingError.timesFailed + 1,
            lastFailedAt: at.toISOString(),
            resolved: false,
          }
          const target = errorEntry
          errors = state.errors.map((entry) => (entry.id === target.id ? target : entry))
        } else {
          errorEntry = {
            id: createId('error', at),
            questionId,
            subjectId: question.subjectId,
            topicId: question.topicId,
            timesFailed: 1,
            firstFailedAt: at.toISOString(),
            lastFailedAt: at.toISOString(),
            resolved: false,
          }
          errors = [errorEntry, ...state.errors]
        }
      } else if (existingError && !existingError.resolved) {
        errorEntry = { ...existingError, resolved: true }
        const target = errorEntry
        errors = state.errors.map((entry) => (entry.id === target.id ? target : entry))
      }

      let flashcard: Flashcard | null = null
      let flashcards = state.flashcards

      if (!isCorrect && !findFlashcardByQuestion(questionId)) {
        flashcard = createFlashcard({
          id: createId('card', at),
          questionId,
          subjectId: question.subjectId,
          topicId: question.topicId,
          subtopicId: question.subtopicId,
          front: question.stem,
          back: answerText(question),
          now: at,
          isDemo: question.isDemo,
          origin: 'question',
          errorId: errorEntry ? errorEntry.id : null,
          sourceIds: question.sourceIds,
          tags: question.tags,
        })
        flashcards = [flashcard, ...flashcards]
      }

      commit({ ...state, attempts: [...state.attempts, attempt], errors, flashcards })

      return { attempt, question, isCorrect, errorEntry, flashcard }
    },

    reviewFlashcard: (flashcardId, rating) => {
      const card = state.flashcards.find((item) => item.id === flashcardId)
      if (!card) return null
      const reviewed = scheduleReview(card, rating, now())
      commit({
        ...state,
        flashcards: state.flashcards.map((item) => (item.id === flashcardId ? reviewed : item)),
      })
      return reviewed
    },

    addFlashcardForQuestion: (questionId, front, back) => {
      const question = findQuestion(questionId, questions)
      if (!question) return null
      const existing = findFlashcardByQuestion(questionId)
      if (existing) return existing
      const at = now()
      const card = createFlashcard({
        id: createId('card', at),
        questionId,
        subjectId: question.subjectId,
        topicId: question.topicId,
        subtopicId: question.subtopicId,
        front: front ?? question.stem,
        back: back ?? answerText(question),
        now: at,
        isDemo: question.isDemo,
        origin: 'question',
        errorId: null,
        sourceIds: question.sourceIds,
        tags: question.tags,
      })
      commit({ ...state, flashcards: [card, ...state.flashcards] })
      return card
    },

    createManualFlashcard: (input) => {
      if (input.front.trim().length === 0 || input.back.trim().length === 0) return null
      const at = now()
      const card = createFlashcard({
        id: createId('card', at),
        questionId: null,
        subjectId: input.subjectId,
        topicId: input.topicId ?? null,
        subtopicId: input.subtopicId ?? null,
        front: input.front.trim(),
        back: input.back.trim(),
        now: at,
        isDemo: true,
        origin: input.origin ?? 'manual',
        errorId: null,
        sourceIds: input.sourceIds ?? [],
        tags: input.tags ?? [],
      })
      commit({ ...state, flashcards: [card, ...state.flashcards] })
      return card
    },

    updateFlashcard: (flashcardId, patch) => {
      const card = state.flashcards.find((item) => item.id === flashcardId)
      if (!card) return null
      const updated: Flashcard = {
        ...card,
        ...patch,
        front: patch.front === undefined ? card.front : patch.front,
        back: patch.back === undefined ? card.back : patch.back,
      }
      commit({
        ...state,
        flashcards: state.flashcards.map((item) => (item.id === flashcardId ? updated : item)),
      })
      return updated
    },

    deleteFlashcard: (flashcardId) => {
      const exists = state.flashcards.some((item) => item.id === flashcardId)
      if (!exists) return false
      commit({ ...state, flashcards: state.flashcards.filter((item) => item.id !== flashcardId) })
      return true
    },

    setErrorResolved: (errorId, resolved) => {
      commit({
        ...state,
        errors: state.errors.map((entry) => (entry.id === errorId ? { ...entry, resolved } : entry)),
      })
    },

    recordExam: (attempt) => {
      commit({ ...state, exams: [attempt, ...state.exams] })
    },

    upsertDocument: (record) => {
      const exists = state.documents.some((item) => item.id === record.id)
      const documents = exists
        ? state.documents.map((item) => (item.id === record.id ? record : item))
        : [record, ...state.documents]
      commit({ ...state, documents })
    },

    removeDocument: (documentId) => {
      const exists = state.documents.some((item) => item.id === documentId)
      if (!exists) return false
      commit({ ...state, documents: state.documents.filter((item) => item.id !== documentId) })
      return true
    },

    updateSettings: (patch) => {
      const nextSettings: StudySettings = {
        ...state.settings,
        ...patch,
        theme: patch.theme === undefined ? state.settings.theme : normalizeTheme(patch.theme),
      }
      commit({ ...state, settings: nextSettings })
    },

    resetAll: () => {
      if (storage) {
        try {
          clearState(storage)
        } catch {
          /* sin acceso al almacenamiento */
        }
      }
      commit(createDefaultState(now(), state.settings.theme))
    },

    exportJson: () => {
      const exported: StudyState = {
        ...state,
        settings: { ...state.settings, lastExportAt: now().toISOString() },
      }
      state = exported
      persist()
      emit()
      return serializeState(exported)
    },

    importJson: (json) => {
      const parsed = parseStoredState(json, now(), null)
      if (parsed.status === 'corrupt') {
        return { ok: false, error: 'El archivo no tiene un formato de respaldo válido.' }
      }
      if (parsed.status === 'newer') {
        return { ok: false, error: 'El respaldo pertenece a una versión más nueva de la app.' }
      }
      state = parsed.state
      persist()
      emit()
      return { ok: true, state: parsed.state }
    },
  }
}

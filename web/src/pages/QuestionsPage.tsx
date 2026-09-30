import { BookOpen, CheckCircle2, CreditCard, MessageCircle, RotateCcw, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProgressBar } from '../components/ProgressBar'
import { Section } from '../components/Section'
import { demoCurriculumIndex } from '../data/curriculum'
import { demoQuestionBank } from '../data/questions'
import type { Question } from '../domain/types'
import { attemptsOnDay, openErrors, precisionPercent, streakDays } from '../domain/selectors'
import { useStudyState, useStudyStore } from '../repositories/useStudyStore'

type AnswerFeedback = {
  isCorrect: boolean
  correctOptionId: string
}

export function QuestionsPage({ initialSubjectId = 'all' }: { initialSubjectId?: string }) {
  const state = useStudyState()
  const store = useStudyStore()
  const [subjectId, setSubjectId] = useState(initialSubjectId)
  const [index, setIndex] = useState(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [actionStatus, setActionStatus] = useState('Responde para registrar tu intento en este dispositivo.')

  const now = new Date()
  const subjects = useMemo(() => {
    const map = new Map<string, string>()
    for (const question of demoQuestionBank) {
      map.set(question.subjectId, demoCurriculumIndex.subjectsById.get(question.subjectId)?.label ?? question.subjectId)
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [])

  const filteredQuestions = useMemo(
    () => demoQuestionBank.filter((question) => (subjectId === 'all' ? true : question.subjectId === subjectId)),
    [subjectId],
  )

  const question: Question | undefined = filteredQuestions.length > 0 ? filteredQuestions[index % filteredQuestions.length] : undefined

  const questionSubjectLabel = question
    ? demoCurriculumIndex.subjectsById.get(question.subjectId)?.label ?? question.subjectId
    : ''
  const questionTopicLabel =
    question && question.topicId ? demoCurriculumIndex.topicsById.get(question.topicId)?.label ?? '' : ''

  const todayAttempts = attemptsOnDay(state, now)
  const todayGoal = state.settings.dailyQuestionGoal
  const precision = precisionPercent(state.attempts)
  const streak = streakDays(state, now)
  const openErrorCount = openErrors(state).length

  function resetForNext(nextIndex: number) {
    setIndex(nextIndex)
    setSelectedOptionId(null)
    setFeedback(null)
    setActionStatus('Responde para registrar tu intento en este dispositivo.')
  }

  function registerAnswer(optionId: string) {
    if (!question) return
    const result = store.recordAttempt({ questionId: question.id, selectedOptionId: optionId })
    if (!result) return
    setFeedback({ isCorrect: result.isCorrect, correctOptionId: question.correctOptionId })
    const parts = [result.isCorrect ? 'Respuesta correcta registrada.' : 'Respuesta incorrecta registrada.']
    if (!result.isCorrect) parts.push('Se abrió una entrada de errores.')
    if (result.flashcard) parts.push('Se creó una flashcard de repaso.')
    if (result.isCorrect && result.errorEntry?.resolved) parts.push('Ese error quedó marcado como recuperado.')
    setActionStatus(parts.join(' '))
  }

  function handleOption(optionId: string) {
    if (!question || feedback) return
    setSelectedOptionId(optionId)
    if (state.settings.explanationsImmediately) {
      registerAnswer(optionId)
    } else {
      setActionStatus('Opción seleccionada. Pulsa Comprobar respuesta para registrar el intento.')
    }
  }

  return (
    <Section
      eyebrow="Banco de preguntas DEMO"
      title="Preguntas"
      action={
        <select
          value={subjectId}
          onChange={(event) => {
            setSubjectId(event.target.value)
            resetForNext(0)
          }}
          className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
          aria-label="Filtrar preguntas por asignatura"
        >
          <option value="all">Todas las asignaturas</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Intentos hoy" value={String(todayAttempts.length) + '/' + String(todayGoal)} />
        <Metric label="Precisión global" value={precision === null ? 'Sin datos' : String(precision) + '%'} />
        <Metric label="Racha" value={String(streak) + (streak === 1 ? ' día' : ' días')} />
        <Metric label="Errores abiertos" value={String(openErrorCount)} />
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>Objetivo diario de preguntas</span>
          <span>{String(todayAttempts.length) + '/' + String(todayGoal)}</span>
        </div>
        <ProgressBar value={todayGoal === 0 ? 0 : (todayAttempts.length / todayGoal) * 100} tone="green" />
      </div>

      {question ? (
        <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-md bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
              {questionSubjectLabel} · {questionTopicLabel}
            </span>
            <span className="text-sm font-semibold text-slate-500">
              Dificultad {question.difficulty} · Pregunta {(index % filteredQuestions.length) + 1} de {filteredQuestions.length}
            </span>
          </div>

          <p className="text-lg font-semibold leading-relaxed">{question.stem}</p>

          <div className="mt-5 grid gap-3">
            {question.options.map((option, optionIndex) => {
              const isSelected = selectedOptionId === option.id
              const isCorrectOption = feedback !== null && option.id === feedback.correctOptionId
              const isWrongSelection = feedback !== null && isSelected && !feedback.isCorrect
              const tone = isCorrectOption
                ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:bg-emerald-400/15 dark:text-emerald-100'
                : isWrongSelection
                  ? 'border-rose-400 bg-rose-50 text-rose-950 dark:bg-rose-400/15 dark:text-rose-100'
                  : isSelected
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-400/15'
                    : 'border-slate-200 dark:border-slate-700'
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={feedback !== null}
                  onClick={() => handleOption(option.id)}
                  className={'rounded-md border p-4 text-left font-medium disabled:cursor-default ' + tone}
                >
                  {String.fromCharCode(65 + optionIndex)}. {option.text}
                </button>
              )
            })}
          </div>

          {!state.settings.explanationsImmediately && feedback === null ? (
            <button
              type="button"
              disabled={selectedOptionId === null}
              onClick={() => {
                if (selectedOptionId !== null) registerAnswer(selectedOptionId)
              }}
              className="mt-5 w-full rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40 dark:bg-white dark:text-slate-950 sm:w-auto"
            >
              Comprobar respuesta
            </button>
          ) : null}

          {feedback !== null ? (
            <div className="mt-5 rounded-md bg-stone-100 p-4 dark:bg-slate-800">
              <div className="mb-2 flex items-center gap-2 font-bold">
                {feedback.isCorrect ? (
                  <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={18} /> Correcto
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                    <XCircle size={18} /> Incorrecto
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{question.explanation}</p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                const card = store.addFlashcardForQuestion(question.id)
                setActionStatus(card ? 'Flashcard guardada en este dispositivo.' : 'No se pudo crear la flashcard.')
              }}
              className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700"
            >
              <CreditCard size={17} /> Crear flashcard
            </button>
            <button
              type="button"
              onClick={() => setActionStatus('ATLAS sigue desactivado en esta fase: no hay llamadas a IA real.')}
              className="flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-3 text-sm font-bold text-white"
            >
              <MessageCircle size={17} /> Preguntar a ATLAS
            </button>
            <button
              type="button"
              onClick={() => setActionStatus('Teoría DEMO relacionada: ' + questionTopicLabel + ' (' + questionSubjectLabel + ').')}
              className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700"
            >
              <BookOpen size={17} /> Ver teoría
            </button>
          </div>

          <p aria-live="polite" className="mt-3 rounded-md bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 dark:bg-violet-400/15 dark:text-violet-100">
            {actionStatus}
          </p>

          <button
            type="button"
            onClick={() => resetForNext(index + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700"
          >
            <RotateCcw size={17} /> Siguiente pregunta
          </button>
        </article>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          No hay preguntas DEMO para este filtro.
        </p>
      )}
    </Section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

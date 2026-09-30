import { Pencil, Save, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { demoCurriculumBundle } from '../data/curriculum'
import { demoQuestionBank } from '../data/questions'
import { createCurriculumIndex } from '../domain/content'
import { dueFlashcards, openErrors } from '../domain/selectors'
import { isDue } from '../domain/srs'
import type { Flashcard, FlashcardOrigin, FlashcardRating, QuestionDifficulty } from '../domain/types'
import { useStudyState, useStudyStore } from '../repositories/useStudyStore'

const ratingOptions: Array<{ rating: FlashcardRating; label: string; hint: string }> = [
  { rating: 'again', label: 'Otra vez', hint: 'Vuelve en 10 minutos' },
  { rating: 'hard', label: 'Difícil', hint: 'Intervalo corto' },
  { rating: 'good', label: 'Bien', hint: 'Intervalo normal' },
  { rating: 'easy', label: 'Fácil', hint: 'Intervalo largo' },
]

const originLabels: Record<FlashcardOrigin, string> = {
  question: 'De pregunta',
  manual: 'Manual',
  ai: 'Generada por IA',
  error: 'De error',
}

export function FlashcardsPage() {
  const [tab, setTab] = useState<'review' | 'editor'>('review')

  return (
    <Section eyebrow="Repaso espaciado y edición" title="Flashcards">
      <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {([
          { id: 'review', label: 'Repaso' },
          { id: 'editor', label: 'Editor' },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              'rounded-md px-3 py-2 text-sm font-bold ' +
              (tab === item.id
                ? 'bg-violet-100 text-violet-950 dark:bg-violet-400/15 dark:text-violet-100'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'review' ? <ReviewPanel /> : <FlashcardEditor />}
    </Section>
  )
}

function ReviewPanel() {
  const state = useStudyState()
  const store = useStudyStore()
  const [revealed, setRevealed] = useState(false)
  const [status, setStatus] = useState('Las tarjetas se generan al fallar preguntas o al crearlas manualmente.')

  const now = new Date()
  const due = dueFlashcards(state, now)
  const card = due[0]
  const openErrorCount = openErrors(state).length
  const newCards = state.flashcards.filter((item) => item.reps === 0).length

  function rate(rating: FlashcardRating) {
    if (!card) return
    const reviewed = store.reviewFlashcard(card.id, rating)
    if (!reviewed) return
    setRevealed(false)
    setStatus(
      'Repaso guardado. Próxima revisión: ' +
        new Date(reviewed.dueAt).toLocaleString('es-ES') +
        '. Intervalo: ' +
        String(reviewed.intervalDays) +
        ' días.',
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {card ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-md bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
                {card.reps === 0 ? 'Tarjeta nueva DEMO' : 'Repaso vencido DEMO'}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{originLabels[card.origin]}</span>
            </div>
            <h3 className="text-xl font-bold leading-relaxed">{card.front}</h3>
            {revealed ? (
              <p className="mt-4 rounded-md bg-stone-100 p-4 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{card.back}</p>
            ) : (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="mt-4 w-full rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950 sm:w-auto"
              >
                Mostrar respuesta
              </button>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ratingOptions.map((option) => (
                <button
                  key={option.rating}
                  type="button"
                  disabled={!revealed}
                  onClick={() => rate(option.rating)}
                  title={option.hint}
                  className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-40 dark:border-slate-700"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p aria-live="polite" className="mt-3 text-sm font-semibold text-violet-700 dark:text-violet-300">{status}</p>
          </>
        ) : (
          <div>
            <h3 className="text-xl font-bold">No hay tarjetas vencidas</h3>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Practica preguntas en el banco DEMO: cada fallo abre un error y genera una flashcard de repaso.
            </p>
            <p className="mt-3 text-sm font-semibold text-violet-700 dark:text-violet-300">{status}</p>
          </div>
        )}
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 font-bold">Estado de la cola</h3>
        <div className="grid gap-3">
          <Queue label="Vencidas ahora" value={String(due.length)} />
          <Queue label="Tarjetas nuevas" value={String(newCards)} />
          <Queue label="Total de tarjetas" value={String(state.flashcards.length)} />
          <Queue label="Errores abiertos" value={String(openErrorCount)} />
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Programación tipo SM-2 simplificada, guardada solo en este dispositivo.
        </p>
      </article>
    </div>
  )
}

function FlashcardEditor() {
  const state = useStudyState()
  const store = useStudyStore()
  const index = useMemo(
    () => createCurriculumIndex({ ...demoCurriculumBundle, questions: demoQuestionBank }),
    [],
  )

  const [subjectFilter, setSubjectFilter] = useState('todos')
  const [topicFilter, setTopicFilter] = useState('todos')
  const [originFilter, setOriginFilter] = useState<'todos' | FlashcardOrigin>('todos')
  const [difficultyFilter, setDifficultyFilter] = useState<'todas' | QuestionDifficulty>('todas')
  const [onlyDue, setOnlyDue] = useState(false)
  const [onlyErrors, setOnlyErrors] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [formSubject, setFormSubject] = useState('cardiologia')
  const [formTopic, setFormTopic] = useState('')
  const [status, setStatus] = useState('Crea, edita o elimina tarjetas locales.')

  const now = new Date()
  const errorQuestionIds = new Set(state.errors.filter((entry) => !entry.resolved).map((entry) => entry.questionId))

  const topics = useMemo(() => {
    if (subjectFilter === 'todos') return []
    return index.topicsBySubject.get(subjectFilter) ?? []
  }, [index, subjectFilter])

  const formTopics = index.topicsBySubject.get(formSubject) ?? []

  const difficultyByQuestion = useMemo(() => {
    const map = new Map<string, QuestionDifficulty>()
    for (const question of demoQuestionBank) map.set(question.id, question.difficulty)
    return map
  }, [])

  const cards = state.flashcards
    .filter((card) => (subjectFilter === 'todos' ? true : card.subjectId === subjectFilter))
    .filter((card) => (topicFilter === 'todos' ? true : card.topicId === topicFilter))
    .filter((card) => (originFilter === 'todos' ? true : card.origin === originFilter))
    .filter((card) => {
      if (difficultyFilter === 'todas') return true
      if (!card.questionId) return false
      return difficultyByQuestion.get(card.questionId) === difficultyFilter
    })
    .filter((card) => (onlyDue ? isDue(card, now) : true))
    .filter((card) => (onlyErrors ? Boolean(card.questionId && errorQuestionIds.has(card.questionId)) : true))

  function resetForm() {
    setEditingId(null)
    setFront('')
    setBack('')
    setFormTopic('')
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id)
    setFront(card.front)
    setBack(card.back)
    setFormSubject(card.subjectId)
    setFormTopic(card.topicId ?? '')
    setStatus('Editando una tarjeta existente.')
  }

  function save() {
    if (editingId) {
      const updated = store.updateFlashcard(editingId, {
        front,
        back,
        subjectId: formSubject,
        topicId: formTopic.length > 0 ? formTopic : null,
      })
      setStatus(updated ? 'Tarjeta actualizada.' : 'No se pudo actualizar la tarjeta.')
      resetForm()
      return
    }
    const created = store.createManualFlashcard({
      front,
      back,
      subjectId: formSubject,
      topicId: formTopic.length > 0 ? formTopic : null,
    })
    setStatus(created ? 'Tarjeta creada y guardada en este dispositivo.' : 'Anverso y reverso son obligatorios.')
    resetForm()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-bold">{editingId ? 'Editar flashcard' : 'Nueva flashcard'}</h3>
        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Anverso</span>
            <textarea
              value={front}
              onChange={(event) => setFront(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Reverso</span>
            <textarea
              value={back}
              onChange={(event) => setBack(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Asignatura</span>
            <select
              value={formSubject}
              onChange={(event) => {
                setFormSubject(event.target.value)
                setFormTopic('')
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              {Array.from(index.subjectsById.values()).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Tema (opcional)</span>
            <select
              value={formTopic}
              onChange={(event) => setFormTopic(event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Sin tema</option>
              {formTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={save}
              className="flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
            >
              <Save size={17} /> {editingId ? 'Guardar cambios' : 'Crear flashcard'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700"
            >
              <X size={17} /> Limpiar
            </button>
          </div>
          <p aria-live="polite" className="text-sm font-semibold text-violet-700 dark:text-violet-300">{status}</p>
        </div>
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-bold">Biblioteca de flashcards</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Asignatura</span>
            <select
              value={subjectFilter}
              onChange={(event) => {
                setSubjectFilter(event.target.value)
                setTopicFilter('todos')
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="todos">Todas</option>
              {Array.from(index.subjectsById.values()).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Tema</span>
            <select
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              disabled={topics.length === 0}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="todos">Todos</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Origen</span>
            <select
              value={originFilter}
              onChange={(event) => setOriginFilter(event.target.value as typeof originFilter)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="todos">Todos</option>
              <option value="question">De pregunta</option>
              <option value="manual">Manual</option>
              <option value="error">De error</option>
              <option value="ai">Generada por IA</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Dificultad de la pregunta</span>
            <select
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value as typeof difficultyFilter)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="todas">Todas</option>
              <option value="Fácil">Fácil</option>
              <option value="Media">Media</option>
              <option value="Difícil">Difícil</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={onlyDue} onChange={(event) => setOnlyDue(event.target.checked)} className="size-4 accent-violet-600" />
            Solo vencidas
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={onlyErrors} onChange={(event) => setOnlyErrors(event.target.checked)} className="size-4 accent-violet-600" />
            Vinculadas a errores abiertos
          </label>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Mostrando {cards.length} de {state.flashcards.length} tarjetas.
        </p>

        <div className="mt-3 grid gap-2">
          {cards.length === 0 ? (
            <p className="rounded-md bg-stone-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              No hay tarjetas con estos filtros.
            </p>
          ) : (
            cards.map((card) => (
              <div key={card.id} className="rounded-md bg-stone-100 p-3 dark:bg-slate-800">
                <p className="font-semibold">{card.front}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {[...(index.subjectsById.get(card.subjectId) ? [index.subjectsById.get(card.subjectId)!.label] : []), ...(card.topicId && index.topicsById.get(card.topicId) ? [index.topicsById.get(card.topicId)!.label] : [])].join(' · ') ||
                    card.subjectId}{' '}
                  · {originLabels[card.origin]} · reps {String(card.reps)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(card)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-700"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const removed = store.deleteFlashcard(card.id)
                      setStatus(removed ? 'Tarjeta eliminada.' : 'No se pudo eliminar la tarjeta.')
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 dark:border-rose-700 dark:text-rose-300"
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
    </div>
  )
}

function Queue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-stone-100 p-3 dark:bg-slate-800">
      <span className="font-semibold">{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  )
}

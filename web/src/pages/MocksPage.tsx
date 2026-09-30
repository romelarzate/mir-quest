import { AlertTriangle, Brain, Clock, ListChecks, Play, RotateCcw, ShieldQuestion, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { demoCurriculumBundle } from '../data/curriculum'
import { demoQuestionBank } from '../data/questions'
import { createCurriculumIndex, describePath } from '../domain/content'
import {
  answerExamQuestion,
  buildExamSession,
  defaultExamConfig,
  finishExam,
  toExamAttempt,
} from '../domain/exam'
import type { ExamConfig, ExamResult, ExamSession } from '../domain/exam'
import { predictionFeatureCatalog, unavailablePredictionEngine } from '../domain/predict'
import type { QuestionDifficulty } from '../domain/types'
import { useStudyState, useStudyStore } from '../repositories/useStudyStore'

const difficulties: QuestionDifficulty[] = ['Fácil', 'Media', 'Difícil']

export function MocksPage() {
  const state = useStudyState()
  const store = useStudyStore()
  const index = useMemo(() => createCurriculumIndex({ ...demoCurriculumBundle, questions: demoQuestionBank }), [])

  const [config, setConfig] = useState<ExamConfig>(defaultExamConfig)
  const [phase, setPhase] = useState<'config' | 'running' | 'result'>('config')
  const [session, setSession] = useState<ExamSession | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [current, setCurrent] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [status, setStatus] = useState('Configura el simulacro con datos DEMO.')

  const subjectOptions = useMemo(() => {
    const ids = new Set(demoQuestionBank.map((question) => question.subjectId))
    return Array.from(ids)
      .map((id) => ({ id, label: index.subjectsById.get(id)?.label ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [index])

  const topicOptions = useMemo(() => {
    const ids = new Set(demoQuestionBank.map((question) => question.topicId).filter((id): id is string => Boolean(id)))
    return Array.from(ids).map((id) => ({ id, label: index.topicsById.get(id)?.label ?? id }))
  }, [index])

  useEffect(() => {
    if (phase !== 'running' || remainingSeconds === null) return
    if (remainingSeconds <= 0) {
      finish()
      return
    }
    const timer = window.setTimeout(() => setRemainingSeconds((value) => (value === null ? null : value - 1)), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingSeconds])

  function toggleValue(values: string[], value: string): string[] {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
  }

  function start() {
    const built = buildExamSession({
      bank: demoQuestionBank,
      config,
      state,
      now: new Date(),
      id: 'exam-' + String(Date.now()),
      title: 'Simulacro DEMO',
    })
    if (built.questionIds.length === 0) {
      setStatus('No hay preguntas DEMO que cumplan esos filtros.')
      return
    }
    setSession(built)
    setResult(null)
    setCurrent(0)
    setRemainingSeconds(config.durationMinutes === null ? null : config.durationMinutes * 60)
    setPhase('running')
    setStatus('Simulacro en curso. Guardado solo en este dispositivo.')
  }

  function answer(optionId: string) {
    if (!session) return
    const questionId = session.questionIds[current]
    setSession(answerExamQuestion(session, questionId, optionId))
  }

  function finish() {
    if (!session) return
    const now = new Date()
    const closed = finishExam(session, demoQuestionBank, now)
    // Registra cada respuesta: abre errores y genera flashcards cuando falla.
    for (const questionId of closed.session.questionIds) {
      const optionId = closed.session.answers[questionId]
      if (optionId) store.recordAttempt({ questionId, selectedOptionId: optionId })
    }
    store.recordExam(toExamAttempt({ session: closed.session, result: closed.result, now }))
    setSession(closed.session)
    setResult(closed.result)
    setRemainingSeconds(null)
    setPhase('result')
    setStatus('Simulacro finalizado. Los fallos alimentan errores y flashcards.')
  }

  function reset() {
    setPhase('config')
    setSession(null)
    setResult(null)
    setRemainingSeconds(null)
    setStatus('Configura el simulacro con datos DEMO.')
  }

  return (
    <Section eyebrow="Simulacros y Predict" title="Simulacro MIR">
      {phase === 'config' ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold">Configuración</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Número de preguntas</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={config.questionCount}
                  onChange={(event) => setConfig({ ...config, questionCount: Math.max(1, Number(event.target.value) || 1) })}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Tiempo en minutos</span>
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={config.durationMinutes ?? 0}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    setConfig({ ...config, durationMinutes: value > 0 ? value : null })
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>

            <fieldset className="mt-4">
              <legend className="text-sm font-bold">Dificultad</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {difficulties.map((difficulty) => (
                  <label key={difficulty} className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={config.difficulties.includes(difficulty)}
                      onChange={() => setConfig({ ...config, difficulties: toggleValue(config.difficulties, difficulty) as QuestionDifficulty[] })}
                      className="size-4 accent-violet-600"
                    />
                    {difficulty}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-sm font-bold">Tipo de preguntas</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={config.includeNew}
                    onChange={(event) => setConfig({ ...config, includeNew: event.target.checked })}
                    className="size-4 accent-violet-600"
                  />
                  Incluir preguntas nuevas
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={config.includeFailed}
                    onChange={(event) => setConfig({ ...config, includeFailed: event.target.checked })}
                    className="size-4 accent-violet-600"
                  />
                  Incluir preguntas falladas
                </label>
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-sm font-bold">Asignaturas</legend>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sin selección: todas.</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {subjectOptions.map((subject) => (
                  <label key={subject.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.subjectIds.includes(subject.id)}
                      onChange={() => setConfig({ ...config, subjectIds: toggleValue(config.subjectIds, subject.id) })}
                      className="size-4 accent-violet-600"
                    />
                    {subject.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-sm font-bold">Temas</legend>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sin selección: todos los temas del banco.</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {topicOptions.map((topic) => (
                  <label key={topic.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.topicIds.includes(topic.id)}
                      onChange={() => setConfig({ ...config, topicIds: toggleValue(config.topicIds, topic.id) })}
                      className="size-4 accent-violet-600"
                    />
                    {topic.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={start}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
            >
              <Play size={17} /> Iniciar simulacro
            </button>
            <p aria-live="polite" className="mt-3 text-sm font-semibold text-violet-700 dark:text-violet-300">{status}</p>
          </article>

          <div className="grid gap-4">
            <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 grid size-10 place-items-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
                <ListChecks size={20} />
              </div>
              <h3 className="font-bold">Historial de simulacros</h3>
              {state.exams.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Todavía no hay simulacros guardados.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {state.exams.slice(0, 4).map((exam) => (
                    <div key={exam.id} className="rounded-md bg-stone-100 p-3 text-sm dark:bg-slate-800">
                      <p className="font-semibold">{exam.title}</p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {String(exam.correctCount)}/{String(exam.totalCount)} correctas · {String(exam.precision)}% ·{' '}
                        {new Date(exam.finishedAt).toLocaleString('es-ES')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <PredictPanel />
          </div>
        </div>
      ) : null}

      {phase === 'running' && session ? (
        <div className="grid gap-4">
          <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-md bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                Pregunta {String(current + 1)} de {String(session.questionIds.length)}
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                <Clock size={17} />
                {remainingSeconds === null ? 'Sin límite' : String(Math.floor(remainingSeconds / 60)) + ':' + String(remainingSeconds % 60).padStart(2, '0')}
              </span>
            </div>

            {(() => {
              const questionId = session.questionIds[current]
              const question = demoQuestionBank.find((item) => item.id === questionId)
              if (!question) return <p>Pregunta no disponible.</p>
              return (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {describePath(index, { subjectId: question.subjectId, topicId: question.topicId }).join(' · ')}
                  </p>
                  <p className="mt-3 text-lg font-semibold leading-relaxed">{question.stem}</p>
                  <div className="mt-4 grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = session.answers[questionId] === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => answer(option.id)}
                          className={
                            'rounded-md border p-4 text-left font-medium ' +
                            (selected ? 'border-violet-400 bg-violet-50 dark:bg-violet-400/15' : 'border-slate-200 dark:border-slate-700')
                          }
                        >
                          {String.fromCharCode(65 + optionIndex)}. {option.text}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={current === 0}
                      onClick={() => setCurrent((value) => Math.max(0, value - 1))}
                      className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-40 dark:border-slate-700"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={current >= session.questionIds.length - 1}
                      onClick={() => setCurrent((value) => Math.min(session.questionIds.length - 1, value + 1))}
                      className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-40 dark:border-slate-700"
                    >
                      Siguiente
                    </button>
                    <button
                      type="button"
                      onClick={finish}
                      className="rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
                    >
                      Finalizar simulacro
                    </button>
                  </div>
                </>
              )
            })()}
          </article>
        </div>
      ) : null}

      {phase === 'result' && result ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-bold">Resultado DEMO</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Precisión" value={String(result.precision) + '%'} />
              <Stat label="Correctas" value={String(result.correctCount)} />
              <Stat label="Incorrectas" value={String(result.incorrectCount)} />
              <Stat label="En blanco" value={String(result.blankCount)} />
            </div>

            <h4 className="mt-5 font-bold">Por asignatura</h4>
            <div className="mt-2 grid gap-2">
              {result.perSubject.map((stat) => (
                <div key={stat.subjectId} className="flex items-center justify-between rounded-md bg-stone-100 p-3 text-sm dark:bg-slate-800">
                  <span className="font-semibold">{index.subjectsById.get(stat.subjectId)?.label ?? stat.subjectId}</span>
                  <span>
                    {String(stat.correct)}/{String(stat.total)} · {String(stat.precision)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
              >
                <RotateCcw size={17} /> Nuevo simulacro
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = 'flashcards'
                }}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700"
              >
                <Brain size={17} /> Ir a flashcards
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold text-violet-700 dark:text-violet-300">{status}</p>
          </article>

          <div className="grid gap-4">
            <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 grid size-10 place-items-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200">
                <AlertTriangle size={20} />
              </div>
              <h3 className="font-bold">Revisión de fallos</h3>
              {result.wrongQuestionIds.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sin fallos en este simulacro.</p>
              ) : (
                <div className="mt-3 grid gap-3">
                  {result.wrongQuestionIds.map((questionId) => {
                    const question = demoQuestionBank.find((item) => item.id === questionId)
                    if (!question) return null
                    return (
                      <div key={questionId} className="rounded-md bg-rose-50 p-3 text-sm dark:bg-rose-400/15">
                        <p className="font-semibold">{question.stem}</p>
                        <p className="mt-1 text-rose-900 dark:text-rose-100">{question.explanation}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </article>

            <PredictPanel />
          </div>
        </div>
      ) : null}
    </Section>
  )
}

function PredictPanel() {
  const prediction = unavailablePredictionEngine.predict({ historicalQuestions: [] }, new Date())
  return (
    <article className="rounded-lg border border-dashed border-violet-300 bg-white p-5 dark:border-violet-700 dark:bg-slate-900">
      <div className="mb-3 grid size-10 place-items-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
        <Sparkles size={20} />
      </div>
      <h3 className="font-bold">Predict MIR</h3>
      <p className="mt-1 text-sm font-bold text-violet-700 dark:text-violet-300">Motor estadístico próximamente</p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Estado del motor: {prediction.status}. No se calculan probabilidades ni índices en esta fase.
      </p>
      <ul className="mt-3 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
        {predictionFeatureCatalog.slice(0, 6).map((feature) => (
          <li key={feature.key} className="flex items-center gap-2">
            <ShieldQuestion size={13} className="shrink-0 text-slate-400" />
            {feature.label}: pendiente de datos
          </li>
        ))}
      </ul>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-100 p-3 dark:bg-slate-800">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

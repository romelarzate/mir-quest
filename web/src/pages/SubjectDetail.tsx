import { ArrowLeft, BookMarked, CheckCircle2, ClipboardCheck, FileText, Layers3, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { ProgressBar } from '../components/ProgressBar'
import { Section } from '../components/Section'
import { findQuestion } from '../data/questions'
import { openErrors } from '../domain/selectors'
import { classNames } from '../lib/classNames'
import { useStudyState, useStudyStore } from '../repositories/useStudyStore'

type CardiologyTab = 'inicio' | 'manual' | 'resumenes' | 'intocables' | 'desgloses' | 'imagenes' | 'flashcards' | 'autoevaluacion' | 'errores' | 'predict'

const tabs: Array<{ id: CardiologyTab; label: string }> = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'manual', label: 'Manual' },
  { id: 'resumenes', label: 'Resúmenes' },
  { id: 'intocables', label: 'Intocables' },
  { id: 'desgloses', label: 'Desgloses' },
  { id: 'imagenes', label: 'Imágenes' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'autoevaluacion', label: 'Autoevaluación' },
  { id: 'errores', label: 'Errores' },
  { id: 'predict', label: 'Predict' },
]

export function SubjectDetail({ onBack, onPractice }: { onBack: () => void; onPractice: () => void }) {
  const [activeTab, setActiveTab] = useState<CardiologyTab>('inicio')
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'ready'>('idle')
  const topics = ['Insuficiencia cardíaca', 'Cardiopatía isquémica', 'Arritmias', 'Valvulopatías', 'Hipertensión arterial']

  function showMockSummary() {
    setActiveTab('resumenes')
    setSummaryStatus('ready')
  }

  return (
    <Section
      eyebrow="Detalle de asignatura"
      title="Cardiología"
      action={
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
        >
          <ArrowLeft size={17} />
          Volver a Asignaturas
        </button>
      }
    >
      <div className="relative mb-4">
        <nav className="scrollbar-hidden overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900" aria-label="Secciones de Cardiología">
          <div className="flex min-w-max gap-1 pr-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  'rounded-md px-3 py-2 text-sm font-bold',
                  activeTab === tab.id
                    ? 'bg-violet-100 text-violet-950 dark:bg-violet-400/15 dark:text-violet-100'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="pointer-events-none absolute bottom-1 right-1 top-1 flex w-10 items-center justify-end rounded-r-lg bg-linear-to-l from-white via-white/90 to-transparent pr-2 dark:from-slate-900 dark:via-slate-900/90" aria-hidden="true">
          <span className="h-8 w-1 rounded-full bg-violet-400/70" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">Ejemplo principal DEMO</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-4xl font-bold">68%</h3>
              <p className="text-slate-600 dark:text-slate-300">Progreso con 420 preguntas y 74% de precisión.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Preguntas" value="420" />
              <Metric label="Flashcards" value="118" />
              <Metric label="Errores" value="31" />
            </div>
          </div>
          <div className="mt-5">
            <ProgressBar value={68} tone="green" />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button className="rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950" type="button" onClick={onPractice}>
              Practicar
            </button>
            <button className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700" type="button" onClick={() => setActiveTab('errores')}>
              Revisar errores
            </button>
            <button className="rounded-md border border-violet-200 px-4 py-3 text-sm font-bold text-violet-700 dark:border-violet-700 dark:text-violet-200" type="button" onClick={showMockSummary}>
              Generar resumen
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Cifras de progreso DEMO. Los errores de la pestaña Errores sí son tus datos reales del dispositivo.
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-bold">Temas prioritarios</h3>
          <div className="grid gap-3">
            {topics.map((topic, index) => (
              <div key={topic} className="flex items-center gap-3 rounded-md bg-stone-100 p-3 dark:bg-slate-800">
                <span className="grid size-8 place-items-center rounded-md bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">{index + 1}</span>
                <span className="font-semibold">{topic}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <TabContent activeTab={activeTab} summaryStatus={summaryStatus} />
      </article>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Feature icon={<ClipboardCheck size={20} />} title="Preguntas" text="Bloques adaptativos por tema y dificultad." />
        <Feature icon={<Layers3 size={20} />} title="Flashcards" text="Repaso espaciado de errores y perlas MIR." />
        <Feature icon={<BookMarked size={20} />} title="Teoría" text="Resumen mock, sin IA real en Fase 2." />
      </div>
    </Section>
  )
}

function TabContent({ activeTab, summaryStatus }: { activeTab: CardiologyTab; summaryStatus: 'idle' | 'ready' }) {
  const state = useStudyState()
  const store = useStudyStore()

  if (activeTab === 'errores') {
    const errors = openErrors(state, 'cardiologia')
    return (
      <div>
        <h3 className="text-xl font-bold">Errores abiertos de Cardiología</h3>
        {errors.length === 0 ? (
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            No hay errores pendientes en Cardiología. Se abren al fallar una pregunta y se cierran al volver a acertarla.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {errors.map((entry) => {
              const question = findQuestion(entry.questionId)
              return (
                <div key={entry.id} className="rounded-md bg-rose-50 p-4 dark:bg-rose-400/15">
                  <p className="font-semibold text-rose-950 dark:text-rose-100">{question ? question.stem : entry.questionId}</p>
                  <p className="mt-1 text-sm text-rose-900 dark:text-rose-200">
                    Fallos: {String(entry.timesFailed)} · Último: {new Date(entry.lastFailedAt).toLocaleString('es-ES')}
                  </p>
                  <button
                    type="button"
                    onClick={() => store.setErrorResolved(entry.id, true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-bold text-white"
                  >
                    <CheckCircle2 size={16} /> Marcar como recuperado
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (activeTab === 'resumenes') {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <WandSparkles size={20} className="text-violet-500" />
          <h3 className="text-xl font-bold">Resúmenes</h3>
        </div>
        {summaryStatus === 'ready' ? (
          <div className="rounded-md bg-violet-50 p-4 text-violet-950 dark:bg-violet-400/15 dark:text-violet-100">
            <p className="font-bold">Resumen mock generado</p>
            <p className="mt-1 text-sm">Contenido simulado para validar el flujo. No se llamó a Gemini ni a ningún servicio externo.</p>
          </div>
        ) : (
          <p className="text-slate-600 dark:text-slate-300">Pulsa Generar resumen para mostrar un estado mock claramente etiquetado.</p>
        )}
      </div>
    )
  }

  if (activeTab === 'predict') {
    return (
      <div>
        <h3 className="text-xl font-bold">Predict 2027</h3>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Módulo deshabilitado en Fase 2. No hay modelo predictivo real ni cálculo clínico.</p>
      </div>
    )
  }

  const copy: Record<CardiologyTab, string> = {
    inicio: 'Vista de control con progreso, prioridades y acciones principales.',
    manual: 'Índice mock del manual de Cardiología, sin PDF real procesado.',
    resumenes: '',
    intocables: 'Lista mock de conceptos de alto rendimiento para repaso rápido.',
    desgloses: 'Desglose mock por años y temas frecuentes.',
    imagenes: 'Galería mock de ECG, radiología y esquemas pendientes de integración.',
    flashcards: 'Cola mock de flashcards asociadas a errores de Cardiología.',
    autoevaluacion: 'Autoevaluación mock por competencias y temas MIR.',
    errores: '',
    predict: '',
  }

  return (
    <div>
      <h3 className="text-xl font-bold">{tabs.find((tab) => tab.id === activeTab)?.label}</h3>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{copy[activeTab]}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-100 px-3 py-2 dark:bg-slate-800">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 grid size-10 place-items-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">{icon || <FileText size={20} />}</div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
    </article>
  )
}

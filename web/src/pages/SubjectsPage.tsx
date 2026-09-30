import { ArrowRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProgressBar } from '../components/ProgressBar'
import { Section } from '../components/Section'
import { subjectBlockOptions, subjects } from '../data/demoData'
import type { SubjectProgress, SubjectBlockId } from '../types'

type SortKey = 'priority' | 'progress' | 'accuracy' | 'risk' | 'questions' | 'name'

const priorities: Array<'Todas' | SubjectProgress['priority']> = ['Todas', 'Alta', 'Media', 'Baja']

export function SubjectsPage({ onOpenCardiology }: { onOpenCardiology: () => void }) {
  const [query, setQuery] = useState('')
  const [block, setBlock] = useState<'todos' | SubjectBlockId>('todos')
  const [priority, setPriority] = useState<'Todas' | SubjectProgress['priority']>('Todas')
  const [minProgress, setMinProgress] = useState(0)
  const [minAccuracy, setMinAccuracy] = useState(0)
  const [minRisk, setMinRisk] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [detailNotice, setDetailNotice] = useState('Cardiología tiene detalle completo en esta demo.')

  const filteredSubjects = useMemo(() => {
    const priorityRank = { Alta: 3, Media: 2, Baja: 1 }
    return subjects
      .filter((subject) => subject.name.toLowerCase().includes(query.trim().toLowerCase()))
      .filter((subject) => block === 'todos' || subject.blockId === block)
      .filter((subject) => priority === 'Todas' || subject.priority === priority)
      .filter((subject) => subject.progress >= minProgress)
      .filter((subject) => subject.accuracy >= minAccuracy)
      .filter((subject) => subject.forgettingRisk >= minRisk)
      .sort((a, b) => {
        if (sortKey === 'name') return a.name.localeCompare(b.name)
        if (sortKey === 'priority') return priorityRank[b.priority] - priorityRank[a.priority]
        if (sortKey === 'progress') return b.progress - a.progress
        if (sortKey === 'accuracy') return b.accuracy - a.accuracy
        if (sortKey === 'risk') return b.forgettingRisk - a.forgettingRisk
        return b.questions - a.questions
      })
  }, [block, minAccuracy, minProgress, minRisk, priority, query, sortKey])

  return (
    <Section eyebrow="36 asignaturas MIR" title="Asignaturas">
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Buscar por nombre</span>
            <span className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
              <Search size={16} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
                placeholder="Cardiología, preventiva..."
              />
            </span>
          </label>
          <Select
            label="Bloque"
            value={block}
            onChange={(value) => setBlock(value as typeof block)}
            options={subjectBlockOptions}
          />
          <Select
            label="Prioridad"
            value={priority}
            onChange={(value) => setPriority(value as typeof priority)}
            options={priorities.map((item) => ({ value: item, label: item }))}
          />
          <Select
            label="Ordenar por"
            value={sortKey}
            onChange={(value) => setSortKey(value as SortKey)}
            options={[
              { value: 'priority', label: 'prioridad' },
              { value: 'progress', label: 'progreso' },
              { value: 'accuracy', label: 'precisión' },
              { value: 'risk', label: 'riesgo de olvido' },
              { value: 'questions', label: 'preguntas' },
              { value: 'name', label: 'nombre' },
            ]}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Range label="Progreso mínimo" value={minProgress} onChange={setMinProgress} />
          <Range label="Precisión mínima" value={minAccuracy} onChange={setMinAccuracy} />
          <Range label="Riesgo de olvido mínimo" value={minRisk} onChange={setMinRisk} />
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Mostrando {filteredSubjects.length} de {subjects.length} asignaturas. Controles mock funcionales sobre datos DEMO.
        </p>
        <p aria-live="polite" className="mt-2 rounded-md bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 dark:bg-violet-400/15 dark:text-violet-100">
          {detailNotice}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredSubjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            onClick={() => {
              if (subject.id === 'cardiologia') {
                onOpenCardiology()
                return
              }
              setDetailNotice(`${subject.name}: detalle aún no disponible en esta demo. La tarjeta sí responde y mantiene los datos visibles.`)
            }}
            aria-label={
              subject.id === 'cardiologia'
                ? `Abrir detalle de ${subject.name}: progreso ${subject.progress}%, precisión ${subject.accuracy}%, ${subject.questions} preguntas realizadas`
                : `${subject.name}: progreso ${subject.progress}%, precisión ${subject.accuracy}%, ${subject.questions} preguntas realizadas. Pulsa para ver aviso de detalle no disponible.`
            }
            title={subject.id === 'cardiologia' ? 'Abrir detalle de Cardiología' : 'Detalle mock no disponible en Fase 1.5'}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-500"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{subject.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{subject.blockLabel}</p>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{subject.priority}</span>
            </div>
            <ProgressBar value={subject.progress} tone={subject.priority === 'Alta' ? 'green' : subject.priority === 'Media' ? 'blue' : 'coral'} />
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Metric label="Progreso" value={`${subject.progress}%`} />
              <Metric label="Precisión" value={`${subject.accuracy}%`} />
              <Metric label="Preguntas" value={String(subject.questions)} />
              <Metric label="Riesgo olvido" value={`${subject.forgettingRisk}%`} />
            </dl>
            {subject.id === 'cardiologia' ? (
              <div className="mt-3 flex items-center gap-1 text-sm font-bold text-violet-700 dark:text-violet-300">
                Abrir detalle <ArrowRight size={15} />
              </div>
            ) : (
              <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Detalle mock pendiente</div>
            )}
          </button>
        ))}
      </div>
    </Section>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 font-medium dark:border-slate-700 dark:bg-slate-950"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold">
        {label}
        <span>{value}%</span>
      </span>
      <input className="w-full accent-violet-600" type="range" min="0" max="80" step="5" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-100 px-3 py-2 dark:bg-slate-800">
      <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-bold text-slate-900 dark:text-white">{value}</dd>
    </div>
  )
}

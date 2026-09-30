import { CheckCircle2, Lock, PlayCircle } from 'lucide-react'
import { ProgressBar } from '../components/ProgressBar'
import { Section } from '../components/Section'
import { routeMilestones } from '../data/demoData'

export function RoutePage() {
  return (
    <Section eyebrow="Plan longitudinal" title="Ruta MIR">
      <div className="grid gap-4">
        {routeMilestones.map((milestone, index) => (
          <article key={milestone.phase} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  {milestone.status === 'Bloqueada' ? <Lock size={20} /> : index === 0 ? <PlayCircle size={20} /> : <CheckCircle2 size={20} />}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{milestone.phase}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{milestone.focus}</p>
                </div>
              </div>
              <span className="w-fit rounded-md bg-violet-100 px-3 py-1 text-sm font-bold text-violet-800 dark:bg-violet-400/15 dark:text-violet-200">{milestone.status}</span>
            </div>
            <div className="mt-4">
              <ProgressBar value={milestone.progress} tone={index === 0 ? 'green' : 'violet'} />
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}

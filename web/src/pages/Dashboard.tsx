import { AlertTriangle, ArrowRight, CalendarClock, Flame, Trophy } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ProgressBar } from '../components/ProgressBar'
import { Section } from '../components/Section'
import { dashboardStats, demoNotice, netasEstimate, netasTrend, nextBestAction, riskChart } from '../data/demoData'
import { attemptsOnDay, dueFlashcards, openErrors, precisionPercent, streakDays } from '../domain/selectors'
import { useStudyState } from '../repositories/useStudyStore'

export function Dashboard({ onStartSession }: { onStartSession: () => void }) {
  const state = useStudyState()
  const now = new Date()
  const todayAttempts = attemptsOnDay(state, now)
  const todayGoal = state.settings.dailyQuestionGoal
  const precision = precisionPercent(state.attempts)
  const streak = streakDays(state, now)
  const dueCount = dueFlashcards(state, now).length
  const openErrorCount = openErrors(state).length

  const realCards = [
    { label: 'Intentos hoy', value: String(todayAttempts.length) + '/' + String(todayGoal), detail: 'Se guarda en este dispositivo', tone: 'green' as const, progress: todayGoal === 0 ? 0 : (todayAttempts.length / todayGoal) * 100 },
    { label: 'Precisión global', value: precision === null ? 'Sin datos' : String(precision) + '%', detail: String(state.attempts.length) + ' intentos registrados', tone: 'blue' as const, progress: precision ?? 0 },
    { label: 'Racha', value: String(streak) + (streak === 1 ? ' día' : ' días'), detail: 'Días consecutivos con actividad', tone: 'gold' as const, progress: Math.min(streak * 12, 100) },
    { label: 'Flashcards vencidas', value: String(dueCount), detail: 'Pendientes de repaso hoy', tone: 'coral' as const, progress: Math.min(dueCount * 8, 100) },
  ]

  return (
    <>
      <Section eyebrow="Centro de mando" title="Dashboard MIR">
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                <ArrowRight size={24} />
              </div>
              <span className="rounded-md bg-slate-950 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white dark:bg-white dark:text-slate-950">DEMO</span>
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Siguiente mejor acción</p>
            <h3 className="mt-2 text-2xl font-bold">{nextBestAction.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{nextBestAction.description}</p>
            <button
              type="button"
              onClick={onStartSession}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-200"
            >
              {nextBestAction.cta}
              <ArrowRight size={17} />
            </button>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Errores abiertos: {openErrorCount}. Se resuelven al volver a acertar la pregunta.
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">Netas estimadas (DEMO)</p>
                <h3 className="mt-1 text-3xl font-bold">{netasEstimate.value}</h3>
              </div>
              <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{netasEstimate.period}</p>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{netasEstimate.explanation}</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netasTrend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.42} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
                  <XAxis dataKey="week" stroke="#64748b" tickLine={false} />
                  <YAxis domain={[110, 150]} stroke="#64748b" tickLine={false} width={36} />
                  <Tooltip formatter={(value) => [String(value) + ' netas', 'Estimación DEMO']} />
                  <Area type="monotone" dataKey="netas" stroke="#10b981" fill="url(#netas)" strokeWidth={3} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {realCards.map((stat) => (
          <article key={stat.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{stat.label}</p>
              {stat.tone === 'gold' ? <Trophy size={18} className="text-amber-500" /> : <Flame size={18} className="text-violet-500" />}
            </div>
            <div className="text-3xl font-bold">{stat.value}</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{stat.detail}</p>
            <div className="mt-4">
              <ProgressBar value={stat.progress} tone={stat.tone} />
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-lg font-bold">Riesgo de olvido por bloque (DEMO)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis domain={[0, 80]} stroke="#64748b" width={34} />
                <Tooltip />
                <Area type="monotone" dataKey="riesgo" stroke="#ef4444" fill="#fecdd3" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <div className="grid gap-4">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 grid size-10 place-items-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
              <AlertTriangle size={20} />
            </div>
            <h3 className="font-bold">Errores abiertos</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {openErrorCount === 0 ? 'Sin errores pendientes. Buen trabajo.' : String(openErrorCount) + ' preguntas pendientes de recuperar.'}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 grid size-10 place-items-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
              <CalendarClock size={20} />
            </div>
            <h3 className="font-bold">Próximo simulacro</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">MIR corto de 50 preguntas, sábado 09:00. Módulo aún simulado.</p>
          </article>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Métricas reales de tu actividad local. {demoNotice} Tarjetas DEMO de referencia: {dashboardStats.length} tarjetas de ejemplo del catálogo.
      </p>
    </>
  )
}

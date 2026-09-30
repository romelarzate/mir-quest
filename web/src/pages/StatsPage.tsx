import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Section } from '../components/Section'
import { attemptsOnDay, attemptsByWeekday, openErrors, precisionPercent, streakDays } from '../domain/selectors'
import { useStudyState } from '../repositories/useStudyStore'

export function StatsPage() {
  const state = useStudyState()
  const now = new Date()
  const weekdayData = attemptsByWeekday(state)
  const todayAttempts = attemptsOnDay(state, now)
  const precision = precisionPercent(state.attempts)
  const streak = streakDays(state, now)

  return (
    <Section eyebrow="Analítica local" title="Estadísticas">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Intentos registrados" value={String(state.attempts.length)} />
        <Metric label="Intentos hoy" value={String(todayAttempts.length)} />
        <Metric label="Precisión global" value={precision === null ? 'Sin datos' : String(precision) + '%'} />
        <Metric label="Errores abiertos" value={String(openErrors(state).length)} />
      </div>

      {state.attempts.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-violet-300 bg-white p-5 text-slate-600 dark:border-violet-700 dark:bg-slate-900 dark:text-slate-300">
          Todavía no hay actividad guardada. Responde preguntas en el banco DEMO y estas gráficas se llenarán con tus datos reales del dispositivo.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Intentos por día de la semana">
          <BarChart data={weekdayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
            <XAxis dataKey="day" stroke="#64748b" />
            <YAxis stroke="#64748b" allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="intentos" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Precisión por día de la semana">
          <LineChart data={weekdayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
            <XAxis dataKey="day" stroke="#64748b" />
            <YAxis domain={[0, 100]} stroke="#64748b" />
            <Tooltip />
            <Line type="monotone" dataKey="precisión" stroke="#8b5cf6" strokeWidth={3} />
          </LineChart>
        </ChartCard>
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Racha actual: {String(streak) + (streak === 1 ? ' día' : ' días')}. Datos guardados solo en este dispositivo.
      </p>
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

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 font-bold">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </article>
  )
}

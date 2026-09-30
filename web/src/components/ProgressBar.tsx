type ProgressBarProps = {
  value: number
  tone?: 'blue' | 'violet' | 'green' | 'coral' | 'gold'
}

const toneClass = {
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
  green: 'bg-emerald-500',
  coral: 'bg-rose-500',
  gold: 'bg-amber-400',
}

export function ProgressBar({ value, tone = 'blue' }: ProgressBarProps) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={`${toneClass[tone]} h-full rounded-full`} style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  )
}

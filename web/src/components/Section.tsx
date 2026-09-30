type SectionProps = {
  eyebrow?: string
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}

export function Section({ eyebrow, title, children, action }: SectionProps) {
  return (
    <section className="mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">{eyebrow}</p> : null}
          <h2 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

import { SendHorizontal, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Section } from '../components/Section'
import { atlasMessages } from '../data/demoData'

export function AtlasPage() {
  const [sentStatus, setSentStatus] = useState('Chat mock. No se envía nada a servicios externos.')

  return (
    <Section eyebrow="Tutor IA mock" title="Tutor ATLAS">
      <article className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-950 p-4 text-white dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-violet-500"><Sparkles size={20} /></span>
            <div>
              <h3 className="font-bold">ATLAS DEMO</h3>
              <p className="text-sm text-slate-300">Sin llamadas reales a Gemini ni servicios externos.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4">
          {atlasMessages.map((message) => (
            <div key={message.text} className={`max-w-3xl rounded-lg p-4 ${message.role === 'student' ? 'ml-auto bg-violet-600 text-white' : 'bg-stone-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>
              {message.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <input className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950" placeholder="Escribe una duda MIR mock..." />
          <button type="button" onClick={() => setSentStatus('Mensaje mock registrado localmente. ATLAS real sigue desactivado.')} className="grid size-12 place-items-center rounded-md bg-violet-600 text-white" aria-label="Enviar mensaje mock"><SendHorizontal size={20} /></button>
        </div>
        <p className="px-4 pb-4 text-sm font-semibold text-violet-700 dark:text-violet-300">{sentStatus}</p>
      </article>
    </Section>
  )
}

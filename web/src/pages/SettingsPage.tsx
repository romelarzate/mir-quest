import { Bell, Database, Download, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Section } from '../components/Section'
import { SCHEMA_VERSION } from '../domain/types'
import { storageKeys } from '../storage/localStore'
import { useStudyState, useStudyStatus, useStudyStore } from '../repositories/useStudyStore'

export function SettingsPage() {
  const state = useStudyState()
  const status = useStudyStatus()
  const store = useStudyStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dataStatus, setDataStatus] = useState('Sin cambios recientes en los datos locales.')
  const [confirmReset, setConfirmReset] = useState(false)

  function handleExport() {
    const json = store.exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mir-quest-respaldo.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setDataStatus('Respaldo descargado con ' + String(state.attempts.length) + ' intentos y ' + String(state.flashcards.length) + ' flashcards.')
  }

  async function handleImportFile(file: File) {
    const text = await file.text()
    const result = store.importJson(text)
    setDataStatus(result.ok ? 'Respaldo importado correctamente.' : 'Error al importar: ' + result.error)
  }

  function handleReset() {
    store.resetAll()
    setConfirmReset(false)
    setDataStatus('Datos locales reiniciados. Los ajustes de tema se conservaron.')
  }

  return (
    <Section eyebrow="Preferencias y datos" title="Ajustes">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 grid size-11 place-items-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Bell size={22} />
          </div>
          <h3 className="font-bold">Objetivos diarios</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Preguntas por día</span>
              <input
                type="number"
                min={1}
                max={200}
                value={state.settings.dailyQuestionGoal}
                onChange={(event) => store.updateSettings({ dailyQuestionGoal: Math.max(1, Number(event.target.value) || 1) })}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 font-semibold dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Flashcards por día</span>
              <input
                type="number"
                min={1}
                max={400}
                value={state.settings.dailyFlashcardGoal}
                onChange={(event) => store.updateSettings({ dailyFlashcardGoal: Math.max(1, Number(event.target.value) || 1) })}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 font-semibold dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          </div>

          <label className="mt-5 flex items-center justify-between gap-4 rounded-md bg-stone-100 p-3 dark:bg-slate-800">
            <span>
              <span className="block font-bold">Mostrar explicación al responder</span>
              <span className="block text-sm text-slate-600 dark:text-slate-300">Si se desactiva, aparece el botón Comprobar respuesta.</span>
            </span>
            <input
              type="checkbox"
              checked={state.settings.explanationsImmediately}
              onChange={(event) => store.updateSettings({ explanationsImmediately: event.target.checked })}
              className="size-5 accent-violet-600"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-bold">Tema visual</span>
            <select
              value={state.settings.theme}
              onChange={(event) => store.updateSettings({ theme: event.target.value as 'light' | 'dark' | 'system' })}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 font-semibold dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="system">Sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          </label>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 grid size-11 place-items-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Database size={22} />
          </div>
          <h3 className="font-bold">Datos locales y respaldos</h3>
          <dl className="mt-4 grid gap-2 text-sm">
            <Row label="Versión de esquema" value={String(status.status === 'ok' || status.status === 'migrated' ? state.schemaVersion : state.schemaVersion) + ' (actual: ' + String(SCHEMA_VERSION) + ')'} />
            <Row label="Estado de carga" value={status.status} />
            <Row label="Almacenamiento" value={status.persistenceAvailable ? (status.persistenceBlocked ? 'Disponible pero bloqueado' : 'Disponible') : 'No disponible'} />
            <Row label="Clave de estado" value={storageKeys.state} />
            <Row label="Intentos" value={String(state.attempts.length)} />
            <Row label="Errores" value={String(state.errors.length)} />
            <Row label="Flashcards" value={String(state.flashcards.length)} />
          </dl>
          <p className="mt-3 rounded-md bg-stone-100 p-3 text-sm dark:bg-slate-800">{status.message}</p>
          {status.appliedMigrations.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
              {status.appliedMigrations.map((item) => (
                <li key={item}>Migración aplicada: {item}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
            >
              <Download size={17} /> Exportar JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700"
            >
              <Upload size={17} /> Importar JSON
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImportFile(file)
              event.target.value = ''
            }}
          />

          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            {confirmReset ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-3 text-sm font-bold text-white"
                >
                  <Trash2 size={17} /> Confirmar borrado
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex items-center justify-center gap-2 rounded-md border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-700 dark:text-rose-300"
              >
                <Trash2 size={17} /> Borrar datos locales
              </button>
            )}
          </div>

          <p aria-live="polite" className="mt-3 text-sm font-semibold text-violet-700 dark:text-violet-300">{dataStatus}</p>
        </article>
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        <ShieldCheck size={16} className="mr-1 inline" />
        Todo se guarda en el navegador de este dispositivo. Sin cuentas, sin claves reales y sin envío a servicios externos.
      </p>
    </Section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-stone-100 px-3 py-2 dark:bg-slate-800">
      <dt className="font-semibold text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}

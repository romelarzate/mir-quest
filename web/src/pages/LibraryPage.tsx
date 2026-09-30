import { FileText, RefreshCw, Search, Sparkles, Trash2, Upload, WandSparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Section } from '../components/Section'
import { demoCurriculumBundle } from '../data/curriculum'
import { demoQuestionBank } from '../data/questions'
import { createCurriculumIndex } from '../domain/content'
import { buildStudyContext } from '../domain/context'
import type { StudyContext } from '../domain/context'
import { documentStatusLabels } from '../domain/documents'
import type { DocumentRecord } from '../domain/documents'
import { generationNotConnectedMessage, generators } from '../domain/generation'
import { createMockDocumentSearchProvider, describeProviderStatus } from '../domain/retrieval'
import type { MockDocumentSearchProvider, RetrievalResult } from '../domain/retrieval'
import { createStudyWorkflow, markStepDone, workflowProgress } from '../domain/workflow'
import type { StudyWorkflowStepId } from '../domain/workflow'
import { useStudyState, useStudyStore } from '../repositories/useStudyStore'

/** Texto marcador: nunca se presenta como material clínico real. */
const demoDocumentBody =
  'Documento DEMO sin contenido clínico. Texto marcador para validar la indexación, la recuperación y las citas. No procede de ningún manual ni de ninguna convocatoria MIR.'

function unknownValue(value: string | number | null): string {
  if (value === null || value === '') return 'No consta'
  return String(value)
}

export function LibraryPage() {
  const state = useStudyState()
  const store = useStudyStore()
  const index = useMemo(() => createCurriculumIndex({ ...demoCurriculumBundle, questions: demoQuestionBank }), [])
  const providerRef = useRef<MockDocumentSearchProvider | null>(null)
  if (providerRef.current === null) providerRef.current = createMockDocumentSearchProvider()
  const provider = providerRef.current

  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('cardiologia')
  const [status, setStatus] = useState('Los documentos son marcadores DEMO: no hay material real cargado.')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [retrieval, setRetrieval] = useState<RetrievalResult | null>(null)
  const [context, setContext] = useState<StudyContext | null>(null)
  const [workflow, setWorkflow] = useState(() => createStudyWorkflow())

  useEffect(() => {
    async function hydrate() {
      for (const record of state.documents) {
        const existing = await provider.getDocument(record.id)
        if (existing) continue
        await provider.seedDocument({
          id: record.id,
          fileName: record.fileName,
          mimeType: record.mimeType,
          checksum: record.checksum,
          text: demoDocumentBody,
          subjectId: record.subjectId,
          sourceType: record.sourceType,
          metadata: record.metadata,
          isDemo: record.isDemo,
          status: record.status,
        })
      }
    }
    void hydrate()
  }, [provider, state.documents])

  const documents = state.documents
  const selected = documents.find((record) => record.id === selectedId) ?? null
  const progress = workflowProgress(workflow)

  function completeStep(id: StudyWorkflowStepId) {
    setWorkflow((current) => markStepDone(current, id))
  }

  async function addDocument() {
    const label = title.trim().length > 0 ? title.trim() : 'Documento DEMO sin título'
    const stamp = Date.now()
    const upload = await provider.uploadDocument({
      fileName: 'demo-' + String(stamp) + '.txt',
      mimeType: 'text/plain',
      checksum: 'demo-checksum-' + String(stamp),
      text: demoDocumentBody,
      subjectId,
      sourceType: 'demo',
      metadata: { title: label, notes: 'Marcador DEMO. Sin autor, edición ni año conocidos.' },
      isDemo: true,
    })
    if (!upload.ok || !upload.documentId) {
      setStatus('No se pudo añadir el documento: ' + String(upload.error ? upload.error.message : 'error desconocido'))
      return
    }
    const indexed = await provider.indexDocument(upload.documentId)
    const record = await provider.getDocument(upload.documentId)
    if (record) store.upsertDocument(record)
    setSelectedId(upload.documentId)
    setTitle('')
    completeStep('select-document')
    setStatus(
      'Documento DEMO añadido con ' + String(indexed.chunkCount) + ' fragmentos marcadores. No contiene material real.',
    )
  }

  async function reindex(record: DocumentRecord) {
    const result = await provider.indexDocument(record.id)
    const refreshed = await provider.getDocument(record.id)
    if (refreshed) store.upsertDocument(refreshed)
    setStatus(result.ok ? 'Documento reindexado.' : 'Error al indexar: ' + String(result.error ? result.error.message : ''))
  }

  async function remove(record: DocumentRecord) {
    await provider.deleteDocument(record.id)
    store.removeDocument(record.id)
    if (selectedId === record.id) setSelectedId(null)
    setStatus('Documento eliminado del registro local.')
  }

  async function runSearch(onlyDocumentId?: string) {
    const result = await provider.search({
      text: query,
      subjectId: onlyDocumentId ? null : subjectId.length > 0 ? subjectId : null,
      documentIds: onlyDocumentId ? [onlyDocumentId] : undefined,
      maxResults: 5,
    })
    setRetrieval(result)
    setContext(null)
    if (result.status === 'ok') completeStep('retrieve-context')
  }

  async function buildContext() {
    const built = await buildStudyContext(provider, {
      query,
      subjectId: subjectId.length > 0 ? subjectId : null,
      maxResults: 5,
    })
    setContext(built)
    completeStep('retrieve-context')
  }

  const summary = context ? generators.summary.generate({ context }) : null
  const questions = context ? generators.questions.generate({ context, count: 2 }) : []
  const flashcards = context ? generators.flashcards.generate({ context, count: 2 }) : []

  return (
    <Section eyebrow="Pipeline documental" title="Biblioteca">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Documentos" value={String(documents.length)} />
        <Stat label="Indexados" value={String(documents.filter((record) => record.status === 'indexed').length)} />
        <Stat label="Pendientes" value={String(documents.filter((record) => record.status === 'pending').length)} />
        <Stat label="Fallidos" value={String(documents.filter((record) => record.status === 'failed').length)} />
      </div>

      <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-400/10">
        <p className="font-bold">Proveedor documental: {provider.label}</p>
        <p className="mt-1 text-sm">{describeProviderStatus(provider)}</p>
        <p className="mt-1 text-sm font-semibold text-violet-800 dark:text-violet-200">
          IA no conectada: el resumen, las preguntas y las flashcards automáticas permanecen desactivados.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold">Añadir documento</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Registra un marcador DEMO con texto sin contenido clínico. No se sube ningún archivo ni se envía nada fuera del dispositivo.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Título del marcador</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Material DEMO"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Asignatura</span>
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                {Array.from(index.subjectsById.values()).map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void addDocument()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
          >
            <Upload size={17} /> Añadir documento DEMO
          </button>
          <p aria-live="polite" className="mt-3 text-sm font-semibold text-violet-700 dark:text-violet-300">{status}</p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold">Buscar y construir contexto</h3>
          <div className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en los fragmentos indexados"
              aria-label="Buscar en los fragmentos indexados"
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700"
            >
              <Search size={16} /> Buscar
            </button>
          </div>
          <button
            type="button"
            onClick={() => void buildContext()}
            className="mt-2 inline-flex items-center gap-2 rounded-md border border-violet-200 px-4 py-2 text-sm font-bold text-violet-700 dark:border-violet-700 dark:text-violet-200"
          >
            <WandSparkles size={16} /> Construir contexto
          </button>

          {retrieval ? (
            <div className="mt-4">
              <p className="text-sm font-semibold">
                Estado: {retrieval.status} · {String(retrieval.results.length)} fragmentos
              </p>
              <div className="mt-2 grid gap-2">
                {retrieval.results.map((hit) => (
                  <div key={hit.chunkId} className="rounded-md bg-stone-100 p-3 text-sm dark:bg-slate-800">
                    <p className="font-semibold">{hit.citation.label}</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{hit.text}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      score {String(hit.score)} · fragmento {hit.chunkId}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {context ? (
            <div className="mt-4 rounded-md bg-violet-50 p-3 text-sm dark:bg-violet-400/10">
              <p className="font-bold">Contexto construido</p>
              <p className="mt-1">
                {String(context.metadata.hitCount)} fragmentos · {String(context.citations.length)} citas ·{' '}
                {String(context.metadata.characters)} caracteres
              </p>
              {context.warnings.map((warning) => (
                <p key={warning} className="mt-1 text-xs text-violet-800 dark:text-violet-200">Aviso: {warning}</p>
              ))}
            </div>
          ) : null}
        </article>
      </div>

      <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-bold">Documentos registrados</h3>
        {documents.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Todavía no hay documentos registrados.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {documents.map((record) => (
              <div key={record.id} className="rounded-md bg-stone-100 p-3 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <FileText size={15} /> {record.metadata.title}
                  </span>
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold dark:bg-slate-700">
                    {documentStatusLabels[record.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {index.subjectsById.get(record.subjectId ? record.subjectId : '') ? index.subjectsById.get(record.subjectId ? record.subjectId : '')?.label : 'Sin asignatura'}
                  {' · '}Año: {unknownValue(record.metadata.year)}
                  {' · '}Edición: {unknownValue(record.metadata.edition)}
                  {' · '}Fragmentos: {String(record.chunkCount)}
                  {' · '}Indexado: {record.lastIndexedAt ? new Date(record.lastIndexedAt).toLocaleString('es-ES') : 'nunca'}
                </p>
                {record.error ? (
                  <p className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    Error: {record.error.message}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(record.id)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-700"
                  >
                    Ver documento
                  </button>
                  <button
                    type="button"
                    onClick={() => void reindex(record)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-700"
                  >
                    <RefreshCw size={14} /> Reindexar
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(record)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 dark:border-rose-700 dark:text-rose-300"
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selected ? (
          <div className="mt-4 rounded-md border border-slate-200 p-4 dark:border-slate-700">
            <h4 className="font-bold">Detalle: {selected.metadata.title}</h4>
            <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              <Row label="Autor" value={unknownValue(selected.metadata.author)} />
              <Row label="Año" value={unknownValue(selected.metadata.year)} />
              <Row label="Edición" value={unknownValue(selected.metadata.edition)} />
              <Row label="Editorial" value={unknownValue(selected.metadata.publisher)} />
              <Row label="Tipo de fuente" value={selected.sourceType} />
              <Row label="Versión" value={selected.versionLabel} />
              <Row label="Fragmentos" value={String(selected.chunkCount)} />
              <Row label="DEMO" value={selected.isDemo ? 'sí' : 'no'} />
            </dl>
            <button
              type="button"
              onClick={() => void runSearch(selected.id)}
              className="mt-3 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700"
            >
              Buscar solo en este documento
            </button>
          </div>
        ) : null}
      </article>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <article className="rounded-lg border border-dashed border-violet-300 bg-white p-5 dark:border-violet-700 dark:bg-slate-900">
          <div className="mb-3 grid size-10 place-items-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
            <Sparkles size={20} />
          </div>
          <h3 className="font-bold">Generación de contenido</h3>
          <p className="mt-1 text-sm font-semibold text-violet-700 dark:text-violet-300">{generationNotConnectedMessage}</p>
          <div className="mt-3 grid gap-2 text-sm">
            <GeneratorRow
              label="Resumen"
              status={summary ? summary.status : 'mock'}
              detail={summary ? 'sin texto · procedencia: ' + String(summary.provenance.chunkIds.length) + ' fragmentos' : 'necesita contexto'}
            />
            <GeneratorRow
              label="Preguntas"
              status={questions.length > 0 ? questions[0].status : 'mock'}
              detail={questions.length > 0 ? String(questions.length) + ' borradores vacíos · procedencia conservada' : 'necesita contexto'}
            />
            <GeneratorRow
              label="Flashcards"
              status={flashcards.length > 0 ? flashcards[0].status : 'mock'}
              detail={flashcards.length > 0 ? String(flashcards.length) + ' borradores vacíos · procedencia conservada' : 'necesita contexto'}
            />
          </div>
          {context ? (
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
              Toda generación futura conservará documento, fragmento y cita de origen. Hoy no se produce contenido clínico.
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Construye un contexto para ver la procedencia que se conservaría.</p>
          )}
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold">Flujo de estudio</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Documento → contenido → contexto → resumen → preguntas → flashcards → SRS. Progreso: {String(progress.done)}/{String(progress.total)}
          </p>
          <ol className="mt-3 grid gap-1 text-sm">
            {workflow.steps.map((step) => (
              <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-stone-100 px-3 py-2 dark:bg-slate-800">
                <span className={step.status === 'blocked' ? 'text-slate-500 dark:text-slate-400' : 'font-semibold'}>
                  {step.label}
                </span>
                <span className="text-xs font-bold">
                  {step.status === 'done' ? 'Hecho' : step.status === 'ready' ? 'Listo' : step.status === 'blocked' ? 'IA no conectada' : 'Bloqueado'}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            Los pasos de IA permanecen bloqueados hasta conectar el proveedor generativo.
          </p>
        </article>
      </div>
    </Section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-stone-100 px-3 py-1.5 dark:bg-slate-800">
      <dt className="font-semibold text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}

function GeneratorRow({ label, status, detail }: { label: string; status: string; detail: string }) {
  return (
    <div className="rounded-md bg-stone-100 px-3 py-2 dark:bg-slate-800">
      <p className="font-semibold">{label} · {status}</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">{detail}</p>
    </div>
  )
}

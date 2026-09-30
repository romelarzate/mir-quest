import { CornerDownLeft, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { demoCurriculumBundle } from '../data/curriculum'
import { demoQuestionBank } from '../data/questions'
import { createCurriculumIndex } from '../domain/content'
import { buildSearchIndex, groupSearchResults, searchDocuments } from '../domain/search'
import type { SearchResult, SearchResultType } from '../domain/search'
import { useStudyState } from '../repositories/useStudyStore'

const targetView: Record<SearchResultType, string> = {
  subject: 'subjects',
  topic: 'subjects',
  subtopic: 'subjects',
  question: 'questions',
  flashcard: 'flashcards',
  error: 'subject-detail',
  document: 'library',
}

export function GlobalSearch() {
  const state = useStudyState()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const documents = useMemo(() => {
    const curriculum = createCurriculumIndex({ ...demoCurriculumBundle, questions: demoQuestionBank })
    return buildSearchIndex({ curriculum, flashcards: state.flashcards, errors: state.errors })
  }, [state.flashcards, state.errors])

  const results = useMemo(() => searchDocuments(documents, query, 5), [documents, query])
  const groups = useMemo(() => groupSearchResults(results), [results])
  const flat = useMemo(() => groups.flatMap((group) => group.results), [groups])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isShortcut) {
        event.preventDefault()
        setOpen((value) => !value)
        return
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    } else {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function openResult(result: SearchResult) {
    window.location.hash = targetView[result.type]
    setOpen(false)
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((value) => Math.min(value + 1, Math.max(flat.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((value) => Math.max(value - 1, 0))
      return
    }
    if (event.key === 'Enter' && flat[activeIndex]) {
      event.preventDefault()
      openResult(flat[activeIndex])
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500 shadow-sm transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        aria-label="Abrir búsqueda global"
      >
        <Search size={17} />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:inline">⌘K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-20">
          <div
            role="dialog"
            aria-label="Búsqueda global"
            className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <Search size={18} className="text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Buscar asignaturas, temas, preguntas, flashcards, errores o documentos"
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar búsqueda" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length === 0 ? (
                <p className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400">
                  Escribe para buscar. Atajos: ⌘K o Ctrl+K para abrir, Esc para cerrar, flechas y Enter para elegir.
                </p>
              ) : flat.length === 0 ? (
                <p className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400">Sin resultados para "{query}".</p>
              ) : (
                groups.map((group) => (
                  <section key={group.type} className="mb-2">
                    <p className="px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {group.label}
                    </p>
                    <ul>
                      {group.results.map((result) => {
                        const index = flat.indexOf(result)
                        const active = index === activeIndex
                        return (
                          <li key={result.type + result.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => openResult(result)}
                              className={
                                'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left ' +
                                (active ? 'bg-violet-100 dark:bg-violet-400/15' : 'hover:bg-slate-100 dark:hover:bg-slate-800')
                              }
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">{result.title}</span>
                                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                  {[...result.path, result.subtitle].filter(Boolean).join(' · ')}
                                </span>
                              </span>
                              {active ? <CornerDownLeft size={15} className="shrink-0 text-violet-600 dark:text-violet-300" /> : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>

            <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Índice local DEMO: {documents.length} elementos. Sin conexión a servicios externos.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}

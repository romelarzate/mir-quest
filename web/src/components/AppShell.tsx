import {
  BarChart3,
  Brain,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  Home,
  Library,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Route,
  Settings,
  Sparkles,
  Stethoscope,
  Sun,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { NavItem, ViewId } from '../types'
import { classNames } from '../lib/classNames'
import { nextBestAction } from '../data/demoData'
import { GlobalSearch } from './GlobalSearch'

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Inicio', icon: Home },
  { id: 'route', label: 'Ruta MIR', shortLabel: 'Ruta', icon: Route },
  { id: 'subjects', label: 'Asignaturas', shortLabel: 'Temas', icon: Stethoscope },
  { id: 'library', label: 'Biblioteca', shortLabel: 'Biblio', icon: Library },
  { id: 'questions', label: 'Preguntas', shortLabel: 'Test', icon: ClipboardList },
  { id: 'flashcards', label: 'Flashcards', shortLabel: 'Cards', icon: Brain },
  { id: 'mocks', label: 'Simulacros', shortLabel: 'MIR', icon: GraduationCap },
  { id: 'atlas', label: 'Tutor ATLAS', shortLabel: 'ATLAS', icon: MessageCircle },
  { id: 'stats', label: 'Estadísticas', shortLabel: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: Settings },
]

type AppShellProps = {
  activeView: ViewId
  darkMode: boolean
  onNavigate: (view: ViewId) => void
  onToggleTheme: () => void
  children: React.ReactNode
}

export function AppShell({ activeView, darkMode, onNavigate, onToggleTheme, children }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const primaryMobileItems = navItems.filter((item) => ['dashboard', 'route', 'subjects', 'library'].includes(item.id))
  const moreItems = navItems.filter((item) => ['questions', 'flashcards', 'mocks', 'atlas', 'stats', 'settings'].includes(item.id))
  const moreIsActive = moreItems.some((item) => item.id === activeView)

  function navigateMobile(view: ViewId) {
    setMoreOpen(false)
    onNavigate(view)
  }

  useEffect(() => {
    if (!moreOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false)
    }

    function onPointerDown(event: PointerEvent) {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [moreOpen])

  return (
    <div className="min-h-screen bg-stone-100 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-slate-200 bg-white/88 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88 lg:flex lg:flex-col">
        <button
          className="mb-6 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-950 p-3 text-left text-white shadow-xl shadow-slate-950/10 dark:border-slate-800 dark:bg-white dark:text-slate-950"
          onClick={() => onNavigate('dashboard')}
          type="button"
          aria-label="Ir al Dashboard de MIR Quest 2027"
        >
          <span className="grid size-11 place-items-center rounded-md bg-emerald-400 text-slate-950" aria-hidden="true">
            <FlaskConical size={24} />
          </span>
          <span>
            <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300 dark:text-emerald-700" aria-hidden="true">MIR Quest</span>
            <span className="block text-lg font-bold">MIR Quest 2027</span>
          </span>
        </button>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={classNames(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition',
                activeView === item.id
                  ? 'bg-violet-100 text-violet-950 shadow-sm dark:bg-violet-400/15 dark:text-violet-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white',
              )}
            >
              <item.icon size={19} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="rounded-lg border border-slate-200 bg-stone-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} className="text-amber-500" />
            Siguiente mejor acción
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{nextBestAction.description}</p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-stone-100/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:ml-72">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Prototipo v0.1 DEMO</p>
            <h1 className="text-xl font-bold sm:text-2xl">MIR Quest 2027</h1>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <button
            type="button"
            onClick={onToggleTheme}
            className="grid size-11 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-500"
            aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
            title={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="pb-32 lg:ml-72 lg:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </main>

      <nav ref={moreMenuRef} className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/94 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/94 lg:hidden">
        {moreOpen ? (
          <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Más módulos</p>
            <div className="grid grid-cols-2 gap-1">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateMobile(item.id)}
                  className={classNames(
                    'flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold',
                    activeView === item.id
                      ? 'bg-violet-100 text-violet-950 dark:bg-violet-400/15 dark:text-violet-100'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <item.icon size={17} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-5 gap-1">
          {primaryMobileItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateMobile(item.id)}
              className={classNames(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold',
                activeView === item.id
                  ? 'bg-violet-100 text-violet-950 dark:bg-violet-400/15 dark:text-violet-100'
                  : 'text-slate-500 dark:text-slate-400',
              )}
            >
              <item.icon size={19} />
              <span>{item.shortLabel}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={classNames(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold',
              moreIsActive || moreOpen
                ? 'bg-violet-100 text-violet-950 dark:bg-violet-400/15 dark:text-violet-100'
                : 'text-slate-500 dark:text-slate-400',
            )}
            aria-expanded={moreOpen}
            aria-label="Abrir más secciones"
          >
            <MoreHorizontal size={19} />
            <span>Más</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

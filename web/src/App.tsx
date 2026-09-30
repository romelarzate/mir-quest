import { useEffect, useMemo, useState } from 'react'
import { AppShell } from './components/AppShell'
import { AtlasPage } from './pages/AtlasPage'
import { Dashboard } from './pages/Dashboard'
import { FlashcardsPage } from './pages/FlashcardsPage'
import { LibraryPage } from './pages/LibraryPage'
import { MocksPage } from './pages/MocksPage'
import { QuestionsPage } from './pages/QuestionsPage'
import { RoutePage } from './pages/RoutePage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'
import { SubjectDetail } from './pages/SubjectDetail'
import { SubjectsPage } from './pages/SubjectsPage'
import { StudyProvider, useStudyState, useStudyStore } from './repositories/useStudyStore'
import type { ViewId } from './types'

const viewTitles: Record<ViewId, string> = {
  dashboard: 'Dashboard',
  route: 'Ruta MIR',
  subjects: 'Asignaturas',
  'subject-detail': 'Cardiología',
  library: 'Biblioteca',
  questions: 'Preguntas',
  flashcards: 'Flashcards',
  mocks: 'Simulacros',
  atlas: 'Tutor ATLAS',
  stats: 'Estadísticas',
  settings: 'Ajustes',
}

function getInitialView(): ViewId {
  const hash = window.location.hash.replace('#', '') as ViewId
  return Object.keys(viewTitles).includes(hash) ? hash : 'dashboard'
}

function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return prefersDark
}

function AppInner() {
  const [activeView, setActiveView] = useState<ViewId>(getInitialView)
  const [questionSubjectId, setQuestionSubjectId] = useState('all')
  const studyState = useStudyState()
  const store = useStudyStore()
  const systemPrefersDark = useSystemPrefersDark()

  const themeMode = studyState.settings.theme
  const darkMode = themeMode === 'system' ? systemPrefersDark : themeMode === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    const onHashChange = () => setActiveView(getInitialView())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigate(view: ViewId) {
    window.location.hash = view
    setActiveView(view)
  }

  function startCardiologySession() {
    setQuestionSubjectId('cardiologia')
    navigate('questions')
  }

  const page = useMemo(() => {
    switch (activeView) {
      case 'route':
        return <RoutePage />
      case 'subjects':
        return <SubjectsPage onOpenCardiology={() => navigate('subject-detail')} />
      case 'subject-detail':
        return <SubjectDetail onBack={() => navigate('subjects')} onPractice={startCardiologySession} />
      case 'library':
        return <LibraryPage />
      case 'questions':
        return <QuestionsPage initialSubjectId={questionSubjectId} />
      case 'flashcards':
        return <FlashcardsPage />
      case 'mocks':
        return <MocksPage />
      case 'atlas':
        return <AtlasPage />
      case 'stats':
        return <StatsPage />
      case 'settings':
        return <SettingsPage />
      case 'dashboard':
      default:
        return <Dashboard onStartSession={startCardiologySession} />
    }
  }, [activeView, questionSubjectId])

  return (
    <AppShell
      activeView={activeView}
      darkMode={darkMode}
      onNavigate={navigate}
      onToggleTheme={() => store.updateSettings({ theme: darkMode ? 'light' : 'dark' })}
    >
      {page}
    </AppShell>
  )
}

function App() {
  return (
    <StudyProvider>
      <AppInner />
    </StudyProvider>
  )
}

export default App

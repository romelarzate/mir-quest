import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { StudyState } from '../domain/types'
import { demoQuestionBank } from '../data/questions'
import { createStudyStore } from './studyStore'
import type { StudyStatus, StudyStore } from './studyStore'

const StudyContext = createContext<StudyStore | null>(null)

let sharedStore: StudyStore | null = null

export function getSharedStudyStore(): StudyStore {
  sharedStore ??= createStudyStore({ questions: demoQuestionBank })
  return sharedStore
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const store = getSharedStudyStore()
  return <StudyContext.Provider value={store}>{children}</StudyContext.Provider>
}

export function useStudyStore(): StudyStore {
  const store = useContext(StudyContext)
  if (!store) throw new Error('useStudyStore debe usarse dentro de StudyProvider')
  return store
}

export function useStudyState(): StudyState {
  const store = useStudyStore()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export function useStudyStatus(): StudyStatus {
  const store = useStudyStore()
  return store.getStatus()
}

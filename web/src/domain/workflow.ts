export type StudyWorkflowStepId =
  | 'select-document'
  | 'select-content'
  | 'retrieve-context'
  | 'generate-summary'
  | 'review-summary'
  | 'generate-questions'
  | 'review-questions'
  | 'generate-flashcards'
  | 'add-to-srs'

export type StudyWorkflowStepStatus = 'locked' | 'ready' | 'done' | 'blocked'

export type StudyWorkflowStep = {
  id: StudyWorkflowStepId
  label: string
  requiresAi: boolean
  status: StudyWorkflowStepStatus
  blockedReason: string | null
}

export type StudyWorkflow = {
  steps: StudyWorkflowStep[]
  currentIndex: number
  aiConnected: boolean
}

export const workflowStepDefinitions: Array<{ id: StudyWorkflowStepId; label: string; requiresAi: boolean }> = [
  { id: 'select-document', label: 'Seleccionar documento', requiresAi: false },
  { id: 'select-content', label: 'Seleccionar contenido', requiresAi: false },
  { id: 'retrieve-context', label: 'Recuperar contexto', requiresAi: false },
  { id: 'generate-summary', label: 'Generar resumen', requiresAi: true },
  { id: 'review-summary', label: 'Revisar resumen', requiresAi: false },
  { id: 'generate-questions', label: 'Generar preguntas', requiresAi: true },
  { id: 'review-questions', label: 'Revisar preguntas', requiresAi: false },
  { id: 'generate-flashcards', label: 'Generar flashcards', requiresAi: true },
  { id: 'add-to-srs', label: 'Añadir a SRS', requiresAi: false },
]

export const workflowBlockedReason = 'IA no conectada: este paso espera al proveedor generativo.'

export function createStudyWorkflow(options: { aiConnected?: boolean } = {}): StudyWorkflow {
  const aiConnected = options.aiConnected ?? false
  const steps: StudyWorkflowStep[] = workflowStepDefinitions.map((definition, index) => {
    if (definition.requiresAi && !aiConnected) {
      return {
        id: definition.id,
        label: definition.label,
        requiresAi: definition.requiresAi,
        status: 'blocked',
        blockedReason: workflowBlockedReason,
      }
    }
    return {
      id: definition.id,
      label: definition.label,
      requiresAi: definition.requiresAi,
      status: index === 0 ? 'ready' : 'locked',
      blockedReason: null,
    }
  })
  return { steps, currentIndex: 0, aiConnected }
}

export function workflowStep(workflow: StudyWorkflow, id: StudyWorkflowStepId): StudyWorkflowStep | undefined {
  return workflow.steps.find((step) => step.id === id)
}

export function nextActionableIndex(workflow: StudyWorkflow, from: number): number {
  for (let index = from; index < workflow.steps.length; index += 1) {
    if (workflow.steps[index].status !== 'blocked') return index
  }
  return -1
}

export function markStepDone(workflow: StudyWorkflow, id: StudyWorkflowStepId): StudyWorkflow {
  const index = workflow.steps.findIndex((step) => step.id === id)
  if (index === -1) return workflow
  const step = workflow.steps[index]
  if (step.status === 'blocked') return workflow

  const steps = workflow.steps.slice()
  steps[index] = { ...step, status: 'done', blockedReason: null }
  const next = nextActionableIndex({ ...workflow, steps }, index + 1)
  if (next !== -1 && steps[next].status === 'locked') {
    steps[next] = { ...steps[next], status: 'ready' }
  }
  return { ...workflow, steps, currentIndex: next === -1 ? index : next }
}

export function workflowProgress(workflow: StudyWorkflow): { done: number; total: number; percent: number } {
  const total = workflow.steps.length
  const done = workflow.steps.filter((step) => step.status === 'done').length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export function workflowBlockedSteps(workflow: StudyWorkflow): StudyWorkflowStep[] {
  return workflow.steps.filter((step) => step.status === 'blocked')
}

export function workflowIsComplete(workflow: StudyWorkflow): boolean {
  return workflow.steps.every((step) => step.status === 'done' || step.status === 'blocked')
}

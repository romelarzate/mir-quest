import { describe, expect, it } from 'vitest'
import {
  createStudyWorkflow,
  markStepDone,
  workflowBlockedReason,
  workflowBlockedSteps,
  workflowIsComplete,
  workflowProgress,
  workflowStep,
} from './workflow'
import type { StudyWorkflowStepId } from './workflow'

describe('createStudyWorkflow', () => {
  it('define los nueve pasos del flujo de estudio', () => {
    const workflow = createStudyWorkflow()
    expect(workflow.steps.length).toBe(9)
    expect(workflow.steps[0].status).toBe('ready')
    expect(workflow.currentIndex).toBe(0)
  })

  it('bloquea los pasos de IA cuando no hay proveedor', () => {
    const workflow = createStudyWorkflow()
    expect(workflow.aiConnected).toBe(false)
    const blocked = workflowBlockedSteps(workflow)
    expect(blocked.length).toBe(3)
    expect(blocked.every((step) => step.blockedReason === workflowBlockedReason)).toBe(true)
    expect(blocked.map((step) => step.id)).toEqual(['generate-summary', 'generate-questions', 'generate-flashcards'])
  })

  it('deja los pasos de IA listos si hay proveedor', () => {
    const workflow = createStudyWorkflow({ aiConnected: true })
    expect(workflowBlockedSteps(workflow).length).toBe(0)
    expect(workflowStep(workflow, 'generate-summary')?.status).toBe('locked')
  })
})

describe('avance del flujo', () => {
  it('marca un paso como hecho y desbloquea el siguiente', () => {
    const workflow = createStudyWorkflow()
    const advanced = markStepDone(workflow, 'select-document')
    expect(workflowStep(advanced, 'select-document')?.status).toBe('done')
    expect(workflowStep(advanced, 'select-content')?.status).toBe('ready')
  })

  it('salta los pasos bloqueados al buscar el siguiente', () => {
    let workflow = createStudyWorkflow()
    workflow = markStepDone(workflow, 'select-document')
    workflow = markStepDone(workflow, 'select-content')
    workflow = markStepDone(workflow, 'retrieve-context')
    expect(workflowStep(workflow, 'retrieve-context')?.status).toBe('done')
    expect(workflowStep(workflow, 'review-summary')?.status).toBe('ready')
    expect(workflow.currentIndex).toBe(4)
  })

  it('no permite marcar como hecho un paso bloqueado', () => {
    const workflow = createStudyWorkflow()
    const attempted = markStepDone(workflow, 'generate-summary')
    expect(workflowStep(attempted, 'generate-summary')?.status).toBe('blocked')
    expect(workflowProgress(attempted).done).toBe(0)
  })

  it('ignora un paso inexistente', () => {
    const workflow = createStudyWorkflow()
    const broken = markStepDone(workflow, 'no-existe' as StudyWorkflowStepId)
    expect(broken.steps.length).toBe(9)
  })

  it('calcula el progreso', () => {
    let workflow = createStudyWorkflow()
    expect(workflowProgress(workflow).percent).toBe(0)
    workflow = markStepDone(workflow, 'select-document')
    expect(workflowProgress(workflow).done).toBe(1)
    expect(workflowProgress(workflow).total).toBe(9)
  })

  it('considera completo el flujo cuando todo está hecho o bloqueado', () => {
    let workflow = createStudyWorkflow()
    expect(workflowIsComplete(workflow)).toBe(false)
    const manualSteps: StudyWorkflowStepId[] = ['select-document', 'select-content', 'retrieve-context', 'review-summary', 'review-questions', 'add-to-srs']
    for (const id of manualSteps) {
      workflow = markStepDone(workflow, id)
    }
    expect(workflowIsComplete(workflow)).toBe(true)
  })
})

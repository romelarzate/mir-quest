import type { Citation } from './citations'
import { contextSourceIds } from './context'
import type { StudyContext } from './context'

export type GenerationStatus = 'mock' | 'not-implemented' | 'ready'

export const generationNotConnectedMessage = 'IA no conectada: no se genera contenido.'

/**
 * Procedencia obligatoria de cualquier contenido generado.
 * Permite responder: de qué fragmentos salió esta pregunta.
 */
export type GenerationProvenance = {
  sourceIds: string[]
  documentIds: string[]
  chunkIds: string[]
  citations: Citation[]
}

export function provenanceFromContext(context: StudyContext): GenerationProvenance {
  const documentIds = Array.from(new Set(context.chunks.map((hit) => hit.documentId)))
  const chunkIds = context.chunks.map((hit) => hit.chunkId)
  const citations = context.citations.slice()
  return {
    sourceIds: contextSourceIds(context),
    documentIds,
    chunkIds,
    citations,
  }
}

export function provenanceIsEmpty(provenance: GenerationProvenance): boolean {
  return provenance.documentIds.length === 0 && provenance.chunkIds.length === 0
}

export function describeProvenance(provenance: GenerationProvenance): string {
  return (
    String(provenance.chunkIds.length) +
    ' fragmentos de ' +
    String(provenance.documentIds.length) +
    ' documentos y ' +
    String(provenance.citations.length) +
    ' citas'
  )
}

/**
 * Comprueba que toda cita del resultado apunte a un fragmento realmente
 * recuperado. Evita contenido generado con procedencia ficticia.
 */
export function provenanceIsTraceable(provenance: GenerationProvenance): boolean {
  const chunks = new Set(provenance.chunkIds)
  const documents = new Set(provenance.documentIds)
  return provenance.citations.every((citation) => chunks.has(citation.chunkId) && documents.has(citation.documentId))
}

export type GenerationRequest = {
  context: StudyContext
  subjectId?: string | null
  topicId?: string | null
  count?: number
  now?: Date
}

export type GeneratedSummary = {
  kind: 'summary'
  text: string
  bullets: string[]
  provenance: GenerationProvenance
  status: GenerationStatus
  warnings: string[]
}

export type GeneratedQuestion = {
  kind: 'question'
  id: string
  stem: string
  options: string[]
  correctOptionIndex: number | null
  explanation: string
  provenance: GenerationProvenance
  status: GenerationStatus
  warnings: string[]
}

export type GeneratedFlashcard = {
  kind: 'flashcard'
  front: string
  back: string
  provenance: GenerationProvenance
  status: GenerationStatus
  warnings: string[]
}

export type GeneratedAtlasReply = {
  kind: 'atlas'
  text: string
  provenance: GenerationProvenance
  status: GenerationStatus
  warnings: string[]
}

export type SummaryGenerator = {
  id: string
  label: string
  status: GenerationStatus
  requiresAi: boolean
  generate: (request: GenerationRequest) => GeneratedSummary
}

export type QuestionGenerator = {
  id: string
  label: string
  status: GenerationStatus
  requiresAi: boolean
  generate: (request: GenerationRequest) => GeneratedQuestion[]
}

export type FlashcardGenerator = {
  id: string
  label: string
  status: GenerationStatus
  requiresAi: boolean
  generate: (request: GenerationRequest) => GeneratedFlashcard[]
}

export type AtlasGenerator = {
  id: string
  label: string
  status: GenerationStatus
  requiresAi: boolean
  generate: (request: GenerationRequest) => GeneratedAtlasReply
}

function baseWarnings(context: StudyContext): string[] {
  const warnings = [generationNotConnectedMessage]
  if (context.metadata.status !== 'ok') {
    warnings.push('Contexto no válido para generar: estado de recuperación ' + context.metadata.status + '.')
  }
  if (context.metadata.hitCount === 0) {
    warnings.push('No hay fragmentos recuperados, así que no habría material de origen.')
  }
  return warnings
}

/**
 * Generadores mock: fijan el contrato y la procedencia sin producir
 * contenido clínico. No hay llamadas a red ni a ningún modelo.
 */
export const mockSummaryGenerator: SummaryGenerator = {
  id: 'mock-summary',
  label: 'Resumen (mock, IA no conectada)',
  status: 'mock',
  requiresAi: true,
  generate: (request) => ({
    kind: 'summary',
    text: '',
    bullets: [],
    provenance: provenanceFromContext(request.context),
    status: 'mock',
    warnings: baseWarnings(request.context),
  }),
}

export const mockQuestionGenerator: QuestionGenerator = {
  id: 'mock-questions',
  label: 'Preguntas (mock, IA no conectada)',
  status: 'mock',
  requiresAi: true,
  generate: (request) => {
    const count = Math.max(1, request.count ?? 1)
    const provenance = provenanceFromContext(request.context)
    const created: GeneratedQuestion[] = []
    for (let index = 0; index < count; index += 1) {
      created.push({
        kind: 'question',
        id: 'mock-question-' + String(index + 1),
        stem: '',
        options: [],
        correctOptionIndex: null,
        explanation: '',
        provenance,
        status: 'mock',
        warnings: baseWarnings(request.context),
      })
    }
    return created
  },
}

export const mockFlashcardGenerator: FlashcardGenerator = {
  id: 'mock-flashcards',
  label: 'Flashcards (mock, IA no conectada)',
  status: 'mock',
  requiresAi: true,
  generate: (request) => {
    const count = Math.max(1, request.count ?? 1)
    const provenance = provenanceFromContext(request.context)
    const created: GeneratedFlashcard[] = []
    for (let index = 0; index < count; index += 1) {
      created.push({
        kind: 'flashcard',
        front: '',
        back: '',
        provenance,
        status: 'mock',
        warnings: baseWarnings(request.context),
      })
    }
    return created
  },
}

export const mockAtlasGenerator: AtlasGenerator = {
  id: 'mock-atlas',
  label: 'ATLAS (mock, IA no conectada)',
  status: 'mock',
  requiresAi: true,
  generate: (request) => ({
    kind: 'atlas',
    text: '',
    provenance: provenanceFromContext(request.context),
    status: 'mock',
    warnings: baseWarnings(request.context),
  }),
}

export const generators = {
  summary: mockSummaryGenerator,
  questions: mockQuestionGenerator,
  flashcards: mockFlashcardGenerator,
  atlas: mockAtlasGenerator,
}

export function generatorStatusLabel(status: GenerationStatus): string {
  if (status === 'mock') return 'Mock (IA no conectada)'
  if (status === 'not-implemented') return 'No implementado'
  return 'Listo'
}

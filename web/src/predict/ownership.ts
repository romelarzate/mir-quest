/**
 * Ownership de datos entre los dos dominios.
 *
 * study:     MIR Quest (progreso del usuario).
 * knowledge: Predict / Knowledge Core (material histórico y resultados del motor).
 *
 * Regla: ningún dominio escribe sobre entidades del otro. La lectura cruzada
 * solo ocurre a través de los DTO de src/predict/dto.ts.
 */

export type DomainId = 'study' | 'knowledge'

export type EntityOwnership = {
  entity: string
  owner: DomainId
  readableBy: DomainId[]
  notes: string
}

export const studyEntities: string[] = [
  'StudyState',
  'Attempt',
  'ErrorEntry',
  'Flashcard',
  'SRS',
  'XP',
  'streak',
  'ExamAttempt',
  'userSettings',
]

export const knowledgeEntities: string[] = [
  'HistoricalExam',
  'HistoricalQuestion',
  'SourceDocument',
  'DocumentChunk',
  'CurriculumMapping',
  'Classification',
  'QuestionFeatures',
  'TopicFeatures',
  'HistoricalExamDistribution',
  'PredictionResult',
  'PredictionFeature',
  'PredictionEvidence',
  'Backtest',
  'ModelVersion',
  'DatasetVersion',
]

function entry(entity: string, owner: DomainId, readableBy: DomainId[], notes: string): EntityOwnership {
  return { entity, owner, readableBy, notes }
}

export const ownershipCatalog: EntityOwnership[] = [
  ...studyEntities.map((entity) =>
    entry(entity, 'study', ['study'], 'El usuario es dueño de su progreso. Predict solo lo consulta por DTO y nunca lo escribe.'),
  ),
  ...knowledgeEntities.map((entity) =>
    entry(entity, 'knowledge', ['knowledge'], 'Predict es dueño del material histórico y de los resultados del motor.'),
  ),
]

export function ownerOf(entity: string): DomainId | null {
  const found = ownershipCatalog.find((item) => item.entity === entity)
  return found ? found.owner : null
}

export function canWrite(entity: string, domain: DomainId): boolean {
  return ownerOf(entity) === domain
}

export function canRead(entity: string, domain: DomainId): boolean {
  const found = ownershipCatalog.find((item) => item.entity === entity)
  if (!found) return false
  return found.readableBy.includes(domain)
}

export type WriteDecision = { allowed: boolean; reason: string }

export function checkWrite(entity: string, domain: DomainId): WriteDecision {
  const owner = ownerOf(entity)
  if (owner === null) {
    return { allowed: false, reason: 'Entidad desconocida en el catálogo de ownership: ' + entity }
  }
  if (owner === domain) {
    return { allowed: true, reason: 'Escritura permitida: ' + entity + ' pertenece a ' + domain }
  }
  return {
    allowed: false,
    reason: entity + ' pertenece a ' + owner + '; ' + domain + ' no puede escribir sobre ella.',
  }
}

export function assertWriteAllowed(entity: string, domain: DomainId): void {
  const decision = checkWrite(entity, domain)
  if (!decision.allowed) throw new Error(decision.reason)
}

/** Comprobación explícita del límite más sensible: Predict nunca toca el SRS. */
export function knowledgeCanWriteStudyEntities(): string[] {
  return ownershipCatalog
    .filter((item) => item.owner === 'study')
    .filter((item) => canWrite(item.entity, 'knowledge'))
    .map((item) => item.entity)
}

export const ownershipRules: string[] = [
  'Predict no escribe StudyState, Attempt, ErrorEntry, Flashcard, SRS, XP, streak ni ExamAttempt.',
  'MIR Quest no escribe HistoricalExam, HistoricalQuestion, SourceDocument, DocumentChunk, CurriculumMapping, Classification, QuestionFeatures, HistoricalExamDistribution, PredictionResult, PredictionFeature, Backtest, ModelVersion ni DatasetVersion.',
  'La comunicación entre dominios ocurre solo por DTO serializables.',
  'React nunca accede a la base de datos del motor de conocimiento.',
]

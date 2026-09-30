import type {
  ContentBlock,
  Curriculum,
  ExamVersion,
  Question,
  SourceReference,
  Subject,
  SubjectBlockId,
  SubjectBlockOption,
  Subtopic,
  Tag,
  Topic,
} from './types'

export const subjectBlockOptions: SubjectBlockOption[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'medicina', label: 'Medicina' },
  { value: 'clinica', label: 'Clínica' },
  { value: 'quirurgica', label: 'Quirúrgica' },
  { value: 'salud-publica', label: 'Salud pública' },
  { value: 'basicas', label: 'Básicas' },
  { value: 'diagnostico', label: 'Diagnóstico' },
  { value: 'transversal', label: 'Transversal' },
]

export const subjectBlockLabels: Record<string, string> = Object.fromEntries(
  subjectBlockOptions.map((option) => [option.value, option.label]),
)

export function blockLabel(blockId: SubjectBlockId): string {
  return subjectBlockLabels[blockId] ?? blockId
}

/** Paquete completo de contenido. Es la unidad que se importa, valida y busca. */
export type ContentBundle = {
  curriculum: Curriculum
  subjects: Subject[]
  topics: Topic[]
  subtopics: Subtopic[]
  contentBlocks: ContentBlock[]
  sources: SourceReference[]
  tags: Tag[]
  questions: Question[]
  examVersions: ExamVersion[]
}

export type CurriculumIndex = {
  curriculum: Curriculum
  subjectsById: Map<string, Subject>
  topicsById: Map<string, Topic>
  subtopicsById: Map<string, Subtopic>
  contentBlocksById: Map<string, ContentBlock>
  sourcesById: Map<string, SourceReference>
  tagsById: Map<string, Tag>
  questionsById: Map<string, Question>
  examVersionsById: Map<string, ExamVersion>
  topicsBySubject: Map<string, Topic[]>
  subtopicsByTopic: Map<string, Subtopic[]>
  contentBlocksByTopic: Map<string, ContentBlock[]>
  questionsByTopic: Map<string, Question[]>
  questionsBySubject: Map<string, Question[]>
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

function sorted<T extends { order: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.order - b.order)
}

export function createCurriculumIndex(bundle: ContentBundle): CurriculumIndex {
  const topicsBySubject = new Map<string, Topic[]>()
  for (const topic of sorted(bundle.topics)) pushTo(topicsBySubject, topic.subjectId, topic)

  const subtopicsByTopic = new Map<string, Subtopic[]>()
  for (const subtopic of sorted(bundle.subtopics)) pushTo(subtopicsByTopic, subtopic.topicId, subtopic)

  const contentBlocksByTopic = new Map<string, ContentBlock[]>()
  for (const block of bundle.contentBlocks) pushTo(contentBlocksByTopic, block.topicId, block)

  const questionsByTopic = new Map<string, Question[]>()
  const questionsBySubject = new Map<string, Question[]>()
  for (const question of bundle.questions) {
    if (question.topicId) pushTo(questionsByTopic, question.topicId, question)
    pushTo(questionsBySubject, question.subjectId, question)
  }

  return {
    curriculum: bundle.curriculum,
    subjectsById: indexBy(bundle.subjects),
    topicsById: indexBy(bundle.topics),
    subtopicsById: indexBy(bundle.subtopics),
    contentBlocksById: indexBy(bundle.contentBlocks),
    sourcesById: indexBy(bundle.sources),
    tagsById: indexBy(bundle.tags),
    questionsById: indexBy(bundle.questions),
    examVersionsById: indexBy(bundle.examVersions),
    topicsBySubject,
    subtopicsByTopic,
    contentBlocksByTopic,
    questionsByTopic,
    questionsBySubject,
  }
}

export function getSubjectTopics(index: CurriculumIndex, subjectId: string): Topic[] {
  return index.topicsBySubject.get(subjectId) ?? []
}

export function getTopicSubtopics(index: CurriculumIndex, topicId: string): Subtopic[] {
  return index.subtopicsByTopic.get(topicId) ?? []
}

export type CurriculumTreeNode = {
  subject: Subject
  topics: Array<{
    topic: Topic
    subtopics: Subtopic[]
    contentBlockCount: number
    questionCount: number
  }>
  questionCount: number
}

export function buildCurriculumTree(index: CurriculumIndex): CurriculumTreeNode[] {
  return sorted(Array.from(index.subjectsById.values())).map((subject) => {
    const topics = getSubjectTopics(index, subject.id).map((topic) => ({
      topic,
      subtopics: getTopicSubtopics(index, topic.id),
      contentBlockCount: (index.contentBlocksByTopic.get(topic.id) ?? []).length,
      questionCount: (index.questionsByTopic.get(topic.id) ?? []).length,
    }))
    return {
      subject,
      topics,
      questionCount: (index.questionsBySubject.get(subject.id) ?? []).length,
    }
  })
}

export function describePath(
  index: CurriculumIndex,
  ids: { subjectId?: string | null; topicId?: string | null; subtopicId?: string | null },
): string[] {
  const parts: string[] = []
  if (ids.subjectId) {
    const subject = index.subjectsById.get(ids.subjectId)
    if (subject) parts.push(subject.label)
  }
  if (ids.topicId) {
    const topic = index.topicsById.get(ids.topicId)
    if (topic) parts.push(topic.label)
  }
  if (ids.subtopicId) {
    const subtopic = index.subtopicsById.get(ids.subtopicId)
    if (subtopic) parts.push(subtopic.label)
  }
  return parts
}

export type ReferenceIssue = {
  entity: string
  entityId: string
  field: string
  value: string
  reason: string
}

/** Comprueba que todas las referencias del paquete apunten a entidades existentes. */
export function findBrokenReferences(bundle: ContentBundle): ReferenceIssue[] {
  const index = createCurriculumIndex(bundle)
  const issues: ReferenceIssue[] = []

  const checkSource = (entity: string, entityId: string, sourceId: string) => {
    if (!index.sourcesById.has(sourceId)) {
      issues.push({ entity, entityId, field: 'sourceIds', value: sourceId, reason: 'referencia inexistente' })
    }
  }

  for (const subject of bundle.subjects) {
    if (!subjectBlockLabels[subject.blockId]) {
      issues.push({ entity: 'subject', entityId: subject.id, field: 'blockId', value: subject.blockId, reason: 'bloque desconocido' })
    }
  }

  for (const topic of bundle.topics) {
    if (!index.subjectsById.has(topic.subjectId)) {
      issues.push({ entity: 'topic', entityId: topic.id, field: 'subjectId', value: topic.subjectId, reason: 'asignatura inexistente' })
    }
  }

  for (const subtopic of bundle.subtopics) {
    if (!index.topicsById.has(subtopic.topicId)) {
      issues.push({ entity: 'subtopic', entityId: subtopic.id, field: 'topicId', value: subtopic.topicId, reason: 'tema inexistente' })
    }
  }

  for (const block of bundle.contentBlocks) {
    if (!index.topicsById.has(block.topicId)) {
      issues.push({ entity: 'contentBlock', entityId: block.id, field: 'topicId', value: block.topicId, reason: 'tema inexistente' })
    }
    if (block.subtopicId && !index.subtopicsById.has(block.subtopicId)) {
      issues.push({ entity: 'contentBlock', entityId: block.id, field: 'subtopicId', value: block.subtopicId, reason: 'subtema inexistente' })
    }
    for (const sourceId of block.sourceIds) checkSource('contentBlock', block.id, sourceId)
  }

  for (const question of bundle.questions) {
    if (!index.subjectsById.has(question.subjectId)) {
      issues.push({ entity: 'question', entityId: question.id, field: 'subjectId', value: question.subjectId, reason: 'asignatura inexistente' })
    }
    if (question.topicId && !index.topicsById.has(question.topicId)) {
      issues.push({ entity: 'question', entityId: question.id, field: 'topicId', value: question.topicId, reason: 'tema inexistente' })
    }
    if (question.subtopicId && !index.subtopicsById.has(question.subtopicId)) {
      issues.push({ entity: 'question', entityId: question.id, field: 'subtopicId', value: question.subtopicId, reason: 'subtema inexistente' })
    }
    if (!question.options.some((option) => option.id === question.correctOptionId)) {
      issues.push({
        entity: 'question',
        entityId: question.id,
        field: 'correctOptionId',
        value: question.correctOptionId,
        reason: 'la opción correcta no existe entre las opciones',
      })
    }
    for (const sourceId of question.sourceIds) checkSource('question', question.id, sourceId)
    if (question.examVersionId && !index.examVersionsById.has(question.examVersionId)) {
      issues.push({ entity: 'question', entityId: question.id, field: 'examVersionId', value: question.examVersionId, reason: 'versión de examen inexistente' })
    }
    for (const tagId of question.tags) {
      if (!index.tagsById.has(tagId)) {
        issues.push({ entity: 'question', entityId: question.id, field: 'tags', value: tagId, reason: 'etiqueta inexistente' })
      }
    }
  }

  return issues
}

/** Una pregunta DEMO nunca debe declarar año ni versión de examen real. */
export function findUnsourcedProvenance(bundle: ContentBundle): ReferenceIssue[] {
  return bundle.questions
    .filter((question) => question.sourceType === 'demo' && (question.year !== null || question.examVersionId !== null))
    .map((question) => ({
      entity: 'question',
      entityId: question.id,
      field: 'year/examVersionId',
      value: String(question.year ?? question.examVersionId),
      reason: 'contenido DEMO con procedencia histórica declarada',
    }))
}

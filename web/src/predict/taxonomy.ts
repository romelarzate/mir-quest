import type { TaxonomyVersion } from './versioning'

/**
 * Capa adicional de dominios clínicos del motor de conocimiento.
 * NO sustituye a las 36 asignaturas MIR de MIR Quest: se superpone a ellas.
 *
 * Los nombres reales deben llegar del análisis aprobado del Hito 0;
 * aquí solo hay marcadores estructurales DEMO.
 */

export type ClinicalDomain = {
  id: string
  label: string
  order: number
  isDemo: boolean
  sourceVersion: string
}

export const clinicalDomainCount = 20

export const clinicalDomainLayer: ClinicalDomain[] = Array.from({ length: clinicalDomainCount }, (_, index) => ({
  id: 'clinical-domain-' + String(index + 1).padStart(2, '0'),
  label: 'Dominio clínico ' + String(index + 1).padStart(2, '0') + ' (pendiente de nombrar)',
  order: index + 1,
  isDemo: true,
  sourceVersion: 'taxonomy-demo-1',
}))

export type MappingSource = 'demo' | 'manual' | 'authorized'

export type CurriculumMapping = {
  subjectId: string
  topicId: string | null
  subtopicId: string | null
  clinicalDomainId: string
  confidence: number | null
  source: MappingSource
  version: string
}

/** Mappings DEMO: estructura sin interpretación médica. La confianza queda a null. */
export const demoCurriculumMappings: CurriculumMapping[] = [
  { subjectId: 'cardiologia', topicId: 'topic-cardio-arritmias', subtopicId: 'subtopic-cardio-arritmias-fa', clinicalDomainId: 'clinical-domain-01', confidence: null, source: 'demo', version: 'taxonomy-demo-1' },
  { subjectId: 'cardiologia', topicId: 'topic-cardio-insuficiencia-cardiaca', subtopicId: null, clinicalDomainId: 'clinical-domain-01', confidence: null, source: 'demo', version: 'taxonomy-demo-1' },
  { subjectId: 'cardiologia', topicId: 'topic-cardio-cardiopatia-isquemica', subtopicId: null, clinicalDomainId: 'clinical-domain-02', confidence: null, source: 'demo', version: 'taxonomy-demo-1' },
  { subjectId: 'neumologia', topicId: 'topic-neumo-epoc', subtopicId: null, clinicalDomainId: 'clinical-domain-03', confidence: null, source: 'demo', version: 'taxonomy-demo-1' },
  { subjectId: 'infecciosas', topicId: 'topic-infecciosas-meningitis', subtopicId: null, clinicalDomainId: 'clinical-domain-04', confidence: null, source: 'demo', version: 'taxonomy-demo-1' },
  { subjectId: 'pediatria', topicId: 'topic-pediatria-fiebre-sin-foco', subtopicId: null, clinicalDomainId: 'clinical-domain-05', confidence: null, source: 'demo', version: 'taxonomy-demo-1' },
]

export function createTaxonomyVersion(input: {
  id: string
  label: string
  createdAt: string
  mappings: CurriculumMapping[]
}): TaxonomyVersion {
  return {
    id: input.id,
    label: input.label,
    createdAt: input.createdAt,
    clinicalDomainCount,
    mappingCount: input.mappings.length,
    hash: 'taxonomy-hash-' + input.id,
  }
}

export function mappingsForSubject(mappings: CurriculumMapping[], subjectId: string): CurriculumMapping[] {
  return mappings.filter((mapping) => mapping.subjectId === subjectId)
}

export function mappingsForTopic(mappings: CurriculumMapping[], topicId: string): CurriculumMapping[] {
  return mappings.filter((mapping) => mapping.topicId === topicId)
}

export function domainsForTopic(mappings: CurriculumMapping[], topicId: string): string[] {
  return Array.from(new Set(mappingsForTopic(mappings, topicId).map((mapping) => mapping.clinicalDomainId)))
}

export function mappingKey(mapping: CurriculumMapping): string {
  return [mapping.subjectId, mapping.topicId ?? '-', mapping.subtopicId ?? '-', mapping.clinicalDomainId].join('|')
}

export function describeMapping(mapping: CurriculumMapping): string {
  return (
    mapping.subjectId +
    (mapping.topicId ? ' > ' + mapping.topicId : '') +
    (mapping.subtopicId ? ' > ' + mapping.subtopicId : '') +
    ' => ' +
    mapping.clinicalDomainId +
    ' (' +
    mapping.source +
    ')'
  )
}

export type MappingValidation = { ok: boolean; issues: string[] }

export function validateMappings(input: {
  mappings: CurriculumMapping[]
  mirSubjectIds: string[]
  mirTopicIds: string[]
  mirSubtopicIds: string[]
}): MappingValidation {
  const issues: string[] = []
  const subjects = new Set(input.mirSubjectIds)
  const topics = new Set(input.mirTopicIds)
  const subtopics = new Set(input.mirSubtopicIds)
  const domains = new Set(clinicalDomainLayer.map((domain) => domain.id))
  const seen = new Set<string>()

  for (const mapping of input.mappings) {
    if (!subjects.has(mapping.subjectId)) issues.push('Asignatura MIR inexistente: ' + mapping.subjectId)
    if (mapping.topicId !== null && !topics.has(mapping.topicId)) issues.push('Tema MIR inexistente: ' + mapping.topicId)
    if (mapping.subtopicId !== null && !subtopics.has(mapping.subtopicId)) issues.push('Subtema MIR inexistente: ' + mapping.subtopicId)
    if (!domains.has(mapping.clinicalDomainId)) issues.push('Dominio clínico inexistente: ' + mapping.clinicalDomainId)
    if (mapping.confidence !== null && (mapping.confidence < 0 || mapping.confidence > 1)) {
      issues.push('Confianza fuera de rango en ' + mappingKey(mapping))
    }
    if (mapping.source !== 'demo' && mapping.confidence === null) {
      issues.push('Un mapping no DEMO exige confianza declarada: ' + mappingKey(mapping))
    }
    const key = mappingKey(mapping)
    if (seen.has(key)) issues.push('Mapping duplicado: ' + key)
    seen.add(key)
  }

  return { ok: issues.length === 0, issues }
}

export function mirSubjectLayerPreserved(mirSubjectIds: string[]): boolean {
  return mirSubjectIds.length === 36
}

export const taxonomyRules: string[] = [
  'La taxonomía MIR de MIR Quest (36 asignaturas) no se reemplaza.',
  'Los dominios clínicos son una capa adicional, no un sustituto.',
  'Sin mappings médicos inventados: los actuales son DEMO y su confianza es null.',
  'Todo mapping declara fuente y versión de taxonomía.',
]

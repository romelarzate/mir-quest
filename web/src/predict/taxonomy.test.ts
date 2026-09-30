import { describe, expect, it } from 'vitest'
import { curriculumSubjects, curriculumSubtopics, curriculumTopics } from '../data/curriculum'
import {
  clinicalDomainCount,
  clinicalDomainLayer,
  createTaxonomyVersion,
  demoCurriculumMappings,
  describeMapping,
  domainsForTopic,
  mappingKey,
  mappingsForSubject,
  mirSubjectLayerPreserved,
  taxonomyRules,
  validateMappings,
} from './taxonomy'

const subjectIds = curriculumSubjects.map((subject) => subject.id)
const topicIds = curriculumTopics.map((topic) => topic.id)
const subtopicIds = curriculumSubtopics.map((subtopic) => subtopic.id)

describe('capa de dominios clínicos', () => {
  it('declara veinte dominios adicionales marcados como DEMO', () => {
    expect(clinicalDomainLayer.length).toBe(20)
    expect(clinicalDomainCount).toBe(20)
    expect(clinicalDomainLayer.every((domain) => domain.isDemo)).toBe(true)
  })

  it('no reemplaza la taxonomía MIR de MIR Quest', () => {
    expect(mirSubjectLayerPreserved(subjectIds)).toBe(true)
    expect(subjectIds.length).toBe(36)
  })
})

describe('CurriculumMapping', () => {
  it('acepta los mappings DEMO contra el temario real', () => {
    const result = validateMappings({ mappings: demoCurriculumMappings, mirSubjectIds: subjectIds, mirTopicIds: topicIds, mirSubtopicIds: subtopicIds })
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('no declara confianza inventada en los mappings DEMO', () => {
    expect(demoCurriculumMappings.every((mapping) => mapping.confidence === null)).toBe(true)
    expect(demoCurriculumMappings.every((mapping) => mapping.source === 'demo')).toBe(true)
  })

  it('rechaza asignaturas inexistentes', () => {
    const mapping = { subjectId: 'no-existe', topicId: null, subtopicId: null, clinicalDomainId: 'clinical-domain-01', confidence: null, source: 'demo' as const, version: 'v1' }
    const result = validateMappings({ mappings: [mapping], mirSubjectIds: subjectIds, mirTopicIds: topicIds, mirSubtopicIds: subtopicIds })
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.indexOf('Asignatura MIR inexistente') !== -1)).toBe(true)
  })

  it('rechaza dominios clínicos inexistentes', () => {
    const mapping = { subjectId: 'cardiologia', topicId: null, subtopicId: null, clinicalDomainId: 'clinical-domain-99', confidence: null, source: 'demo' as const, version: 'v1' }
    const result = validateMappings({ mappings: [mapping], mirSubjectIds: subjectIds, mirTopicIds: topicIds, mirSubtopicIds: subtopicIds })
    expect(result.issues.some((issue) => issue.indexOf('Dominio clínico inexistente') !== -1)).toBe(true)
  })

  it('exige confianza cuando el mapping no es DEMO', () => {
    const mapping = { subjectId: 'cardiologia', topicId: null, subtopicId: null, clinicalDomainId: 'clinical-domain-01', confidence: null, source: 'authorized' as const, version: 'v1' }
    const result = validateMappings({ mappings: [mapping], mirSubjectIds: subjectIds, mirTopicIds: topicIds, mirSubtopicIds: subtopicIds })
    expect(result.issues.some((issue) => issue.indexOf('exige confianza') !== -1)).toBe(true)
  })

  it('detecta mappings duplicados', () => {
    const mapping = demoCurriculumMappings[0]
    const result = validateMappings({ mappings: [mapping, mapping], mirSubjectIds: subjectIds, mirTopicIds: topicIds, mirSubtopicIds: subtopicIds })
    expect(result.issues.some((issue) => issue.indexOf('duplicado') !== -1)).toBe(true)
  })

  it('consulta por asignatura y por tema', () => {
    expect(mappingsForSubject(demoCurriculumMappings, 'cardiologia').length).toBe(3)
    expect(domainsForTopic(demoCurriculumMappings, 'topic-cardio-arritmias')).toEqual(['clinical-domain-01'])
  })

  it('describe y marca cada mapping', () => {
    const described = describeMapping(demoCurriculumMappings[0])
    expect(described).toContain('cardiologia')
    expect(described).toContain('clinical-domain-01')
    expect(described).toContain('demo')
    expect(mappingKey(demoCurriculumMappings[0])).toContain('|')
  })

  it('crea la versión de taxonomía con conteos', () => {
    const version = createTaxonomyVersion({ id: 'taxonomy-demo-1', label: 'Taxonomía DEMO', createdAt: '2026-09-29T09:00:00.000Z', mappings: demoCurriculumMappings })
    expect(version.clinicalDomainCount).toBe(20)
    expect(version.mappingCount).toBe(demoCurriculumMappings.length)
  })

  it('documenta las reglas de taxonomía', () => {
    expect(taxonomyRules.length).toBe(4)
  })
})

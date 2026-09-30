import { describe, expect, it } from 'vitest'
import type { SimulationRequestDTO } from './dto'
import {
  filterCandidates,
  manifestSummary,
  planSimulation,
  seededShuffle,
  verifyManifest,
} from './reproducibility'
import type { CandidateQuestion } from './reproducibility'
import { createVersionBundle } from './versioning'

const versions = createVersionBundle({
  datasetVersion: 'dataset-demo-1',
  taxonomyVersion: 'taxonomy-demo-1',
  featureVersion: 'feature-demo-1',
  simulationVersion: 'simulation-demo-1',
})

function candidates(): CandidateQuestion[] {
  const list: CandidateQuestion[] = []
  for (let index = 1; index <= 12; index += 1) {
    list.push({
      questionId: 'hq-' + String(index).padStart(2, '0'),
      year: 2015 + (index % 5),
      validationStatus: index === 3 ? 'quarantined' : index === 4 ? 'rejected' : 'accepted',
      subjectId: index % 2 === 0 ? 'cardiologia' : 'neumologia',
      topicId: index % 2 === 0 ? 'topic-cardio-arritmias' : 'topic-neumo-epoc',
      clinicalDomainIds: index % 2 === 0 ? ['clinical-domain-01'] : ['clinical-domain-03'],
    })
  }
  return list
}

function request(overrides: Partial<SimulationRequestDTO> = {}): SimulationRequestDTO {
  return {
    requestId: 'sim-1',
    seed: 'semilla-estable',
    questionCount: 5,
    subjectIds: [],
    topicIds: [],
    clinicalDomainIds: [],
    versions,
    requestedAt: '2026-09-29T09:00:00.000Z',
    ...overrides,
  }
}

describe('reproducibilidad', () => {
  it('misma semilla y misma configuración devuelven el mismo conjunto ordenado', async () => {
    const first = await planSimulation(request(), candidates())
    const second = await planSimulation(request(), candidates())
    expect(first.questionIds).toEqual(second.questionIds)
    expect(first.manifest.hash).toBe(second.manifest.hash)
    expect(first.questionIds.length).toBe(5)
  })

  it('cambia el resultado cuando cambia la semilla', async () => {
    const first = await planSimulation(request({ seed: 'a' }), candidates())
    const second = await planSimulation(request({ seed: 'b' }), candidates())
    expect(first.manifest.hash).not.toBe(second.manifest.hash)
  })

  it('cambia el resultado cuando cambia el dataset', async () => {
    const first = await planSimulation(request(), candidates())
    const second = await planSimulation(
      request({ versions: { ...versions, datasetVersion: 'dataset-demo-2' } }),
      candidates(),
    )
    expect(first.manifest.hash).not.toBe(second.manifest.hash)
  })

  it('el manifiesto se puede verificar', async () => {
    const result = await planSimulation(request(), candidates())
    expect(await verifyManifest(result.manifest)).toBe(true)
  })

  it('detecta un manifiesto manipulado', async () => {
    const result = await planSimulation(request(), candidates())
    const tampered = { ...result.manifest, questionIds: [...result.manifest.questionIds, 'hq-99'] }
    expect(await verifyManifest(tampered)).toBe(false)
  })

  it('registra las versiones en el manifiesto', async () => {
    const result = await planSimulation(request(), candidates())
    expect(result.manifest.datasetVersion).toBe('dataset-demo-1')
    expect(result.manifest.taxonomyVersion).toBe('taxonomy-demo-1')
    expect(result.manifest.featureVersion).toBe('feature-demo-1')
    expect(result.manifest.modelVersion).toBeNull()
    expect(result.manifest.hashAlgorithm).toBe('sha-256')
    expect(result.manifest.secondaryHash).toBeNull()
  })

  it('nunca selecciona preguntas en cuarentena ni rechazadas', async () => {
    const result = await planSimulation(request({ questionCount: 12 }), candidates())
    expect(result.questionIds).not.toContain('hq-03')
    expect(result.questionIds).not.toContain('hq-04')
    expect(result.questionIds.length).toBe(10)
  })

  it('avisa cuando se piden más preguntas de las elegibles', async () => {
    const result = await planSimulation(request({ questionCount: 50 }), candidates())
    expect(result.warnings.some((warning) => warning.includes('elegibles'))).toBe(true)
  })

  it('filtra por asignatura y por dominio clínico', () => {
    const bySubject = filterCandidates(candidates(), { subjectIds: ['cardiologia'], topicIds: [], clinicalDomainIds: [] })
    expect(bySubject.every((candidate) => candidate.subjectId === 'cardiologia')).toBe(true)
    const byDomain = filterCandidates(candidates(), { subjectIds: [], topicIds: [], clinicalDomainIds: ['clinical-domain-03'] })
    expect(byDomain.every((candidate) => candidate.clinicalDomainIds.includes('clinical-domain-03'))).toBe(true)
  })

  it('ordena los candidatos de forma estable', () => {
    const ordered = filterCandidates(candidates(), { subjectIds: [], topicIds: [], clinicalDomainIds: [] })
    const ids = ordered.map((candidate) => candidate.questionId)
    expect(ids).toEqual(ids.slice().sort())
  })

  it('el barajado sembrado es determinista', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const first = seededShuffle(items, () => 0.5)
    const second = seededShuffle(items, () => 0.5)
    expect(first).toEqual(second)
    expect(first.slice().sort()).toEqual(items.slice().sort())
  })

  it('resume el manifiesto en texto', async () => {
    const result = await planSimulation(request(), candidates())
    const summary = manifestSummary(result.manifest)
    expect(summary).toContain('semilla-estable')
    expect(summary).toContain('dataset-demo-1')
    expect(summary).toContain('modelo ninguno')
  })
})

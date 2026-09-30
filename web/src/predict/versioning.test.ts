import { describe, expect, it } from 'vitest'
import { checkVersionCompatibility, createVersionBundle, describeVersionBundle, hashDataset, isCalibrationPossible } from './versioning'

describe('VersionBundle', () => {
  it('parte de versiones sin especificar y modelo nulo', () => {
    const bundle = createVersionBundle()
    expect(bundle.datasetVersion).toBe('dataset-unspecified')
    expect(bundle.modelVersion).toBeNull()
  })

  it('describe las cinco versiones', () => {
    const bundle = createVersionBundle({ datasetVersion: 'd1', taxonomyVersion: 't1', featureVersion: 'f1', modelVersion: 'm1', simulationVersion: 's1' })
    const text = describeVersionBundle(bundle)
    expect(text).toContain('dataset=d1')
    expect(text).toContain('taxonomy=t1')
    expect(text).toContain('feature=f1')
    expect(text).toContain('model=m1')
    expect(text).toContain('simulation=s1')
  })

  it('omite model cuando no hay modelo', () => {
    expect(describeVersionBundle(createVersionBundle({ modelVersion: null }))).toContain('model=ninguno')
  })
})

describe('compatibilidad de versiones', () => {
  it('acepta cuando todo coincide', () => {
    const bundle = createVersionBundle({ datasetVersion: 'd1', featureVersion: 'f1' })
    expect(checkVersionCompatibility(bundle, { datasetVersion: 'd1', featureVersion: 'f1' }).ok).toBe(true)
  })

  it('detecta discrepancias indicando el tipo', () => {
    const bundle = createVersionBundle({ datasetVersion: 'd1' })
    const result = checkVersionCompatibility(bundle, { datasetVersion: 'd2' })
    expect(result.ok).toBe(false)
    expect(result.issues[0].code).toBe('version-mismatch')
    expect(result.issues[0].message).toContain('dataset')
  })

  it('ignora los requisitos no informados', () => {
    const bundle = createVersionBundle({ datasetVersion: 'd1' })
    expect(checkVersionCompatibility(bundle, {}).ok).toBe(true)
  })
})

describe('calibración', () => {
  it('solo es posible con modelo registrado y calibrado', () => {
    expect(isCalibrationPossible(createVersionBundle({ modelVersion: null }), true)).toBe(false)
    expect(isCalibrationPossible(createVersionBundle({ modelVersion: 'm1' }), false)).toBe(false)
    expect(isCalibrationPossible(createVersionBundle({ modelVersion: 'm1' }), true)).toBe(true)
  })
})

describe('hash de dataset', () => {
  it('es estable ante el orden de las listas', async () => {
    const first = await hashDataset({ sourceDocumentIds: ['b', 'a'], historicalQuestionIds: ['q2', 'q1'], taxonomyVersion: 't1' })
    const second = await hashDataset({ sourceDocumentIds: ['a', 'b'], historicalQuestionIds: ['q1', 'q2'], taxonomyVersion: 't1' })
    expect(first).toBe(second)
    expect(first.length).toBe(64)
  })

  it('cambia si cambia la taxonomía', async () => {
    const first = await hashDataset({ sourceDocumentIds: [], historicalQuestionIds: [], taxonomyVersion: 't1' })
    const second = await hashDataset({ sourceDocumentIds: [], historicalQuestionIds: [], taxonomyVersion: 't2' })
    expect(first).not.toBe(second)
  })
})

import { describe, expect, it } from 'vitest'
import {
  describeFeatureAvailability,
  emptyQuestionFeatures,
  emptyTopicFeatures,
  featureKeys,
  featureMatrix,
  featureStoreRules,
  hasNoRealValues,
  validateFeatureCells,
} from './features'

describe('QuestionFeatures', () => {
  it('crea la matriz completa con valores nulos', () => {
    const features = emptyQuestionFeatures({ questionId: 'hq-1', featureVersion: 'feature-demo-1' })
    expect(features.cells.length).toBe(6)
    expect(features.cells.map((cell) => cell.key)).toEqual([...featureKeys])
    expect(features.cells.every((cell) => cell.value === null)).toBe(true)
    expect(features.cells.every((cell) => cell.available === false)).toBe(true)
    expect(features.computedAt).toBeNull()
    expect(features.availability).toBe('demo')
    expect(features.isDemo).toBe(true)
  })

  it('cumple la invariante de ausencia de valores reales', () => {
    const features = emptyQuestionFeatures({ questionId: 'hq-1', featureVersion: 'feature-demo-1' })
    expect(hasNoRealValues(features)).toBe(true)
    expect(validateFeatureCells(features).ok).toBe(true)
  })

  it('explica por qué no hay valores', () => {
    const features = emptyQuestionFeatures({ questionId: 'hq-1', featureVersion: 'feature-demo-1' })
    expect(describeFeatureAvailability(features)).toContain('sin valores históricos')
    const unavailable = emptyQuestionFeatures({ questionId: 'hq-2', featureVersion: 'feature-demo-1', availability: 'unavailable' })
    expect(describeFeatureAvailability(unavailable)).toContain('pendientes')
  })

  it('detecta un valor en una variable no disponible', () => {
    const features = emptyQuestionFeatures({ questionId: 'hq-1', featureVersion: 'feature-demo-1' })
    const tampered = { ...features, cells: features.cells.map((cell, index) => (index === 0 ? { ...cell, value: 5 } : cell)) }
    expect(validateFeatureCells(tampered).ok).toBe(false)
  })

  it('exige fecha de cálculo si la matriz está lista', () => {
    const features = emptyQuestionFeatures({ questionId: 'hq-1', featureVersion: 'feature-demo-1', availability: 'ready' })
    expect(validateFeatureCells(features).ok).toBe(false)
  })

  it('produce una matriz de filas nulas', () => {
    const rows = featureMatrix([emptyQuestionFeatures({ questionId: 'hq-1', featureVersion: 'v1' })])
    expect(rows.length).toBe(1)
    expect(Object.values(rows[0]).every((value) => value === null)).toBe(true)
  })
})

describe('TopicFeatures', () => {
  it('hereda la estructura y admite dominios clínicos', () => {
    const features = emptyTopicFeatures({ topicId: 'topic-cardio-arritmias', subjectId: 'cardiologia', clinicalDomainIds: ['clinical-domain-01'], featureVersion: 'feature-demo-1' })
    expect(features.clinicalDomainIds).toEqual(['clinical-domain-01'])
    expect(hasNoRealValues(features)).toBe(true)
    expect(features.cells.length).toBe(6)
  })

  it('documenta las reglas del almacén de features', () => {
    expect(featureStoreRules.length).toBe(3)
    expect(featureStoreRules.some((rule) => rule.indexOf('cuarentena') !== -1)).toBe(true)
  })
})

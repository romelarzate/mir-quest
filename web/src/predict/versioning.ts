import { sha256Hex, stableHashInput } from './hashing'

export type DatasetVersion = {
  id: string
  label: string
  createdAt: string
  sourceDocumentIds: string[]
  historicalQuestionCount: number
  hash: string
  isDemo: boolean
}

export type TaxonomyVersion = {
  id: string
  label: string
  createdAt: string
  clinicalDomainCount: number
  mappingCount: number
  hash: string
}

export type FeatureVersion = {
  id: string
  label: string
  createdAt: string
  featureKeys: string[]
  hash: string
}

export type ModelKind = 'statistical' | 'ml' | 'hybrid' | 'none'

export type ModelVersion = {
  id: string
  label: string
  createdAt: string
  kind: ModelKind
  calibrated: boolean
  notes: string
}

export type SimulationVersion = {
  id: string
  label: string
  createdAt: string
  algorithm: string
  usesSeed: boolean
}

export const versionKinds = ['dataset', 'taxonomy', 'feature', 'model', 'simulation'] as const
export type VersionKind = (typeof versionKinds)[number]

export type VersionBundle = {
  datasetVersion: string
  taxonomyVersion: string
  featureVersion: string
  modelVersion: string | null
  simulationVersion: string
}

/**
 * Una predicción debe registrar exactamente las versiones que la produjeron.
 * Si falta modelVersion el resultado no puede presentarse como calibrado.
 */
export function createVersionBundle(input: Partial<VersionBundle> = {}): VersionBundle {
  return {
    datasetVersion: input.datasetVersion ?? 'dataset-unspecified',
    taxonomyVersion: input.taxonomyVersion ?? 'taxonomy-unspecified',
    featureVersion: input.featureVersion ?? 'feature-unspecified',
    modelVersion: input.modelVersion ?? null,
    simulationVersion: input.simulationVersion ?? 'simulation-unspecified',
  }
}

export function describeVersionBundle(bundle: VersionBundle): string {
  return [
    'dataset=' + bundle.datasetVersion,
    'taxonomy=' + bundle.taxonomyVersion,
    'feature=' + bundle.featureVersion,
    'model=' + (bundle.modelVersion ?? 'ninguno'),
    'simulation=' + bundle.simulationVersion,
  ].join(' ')
}

export type CompatibilityIssue = { code: string; message: string }

export type CompatibilityResult = { ok: boolean; issues: CompatibilityIssue[] }

export function checkVersionCompatibility(
  provided: VersionBundle,
  required: Partial<VersionBundle>,
): CompatibilityResult {
  const issues: CompatibilityIssue[] = []
  for (const kind of versionKinds) {
    const expected = required[kind === 'dataset' ? 'datasetVersion' : kind === 'taxonomy' ? 'taxonomyVersion' : kind === 'feature' ? 'featureVersion' : kind === 'model' ? 'modelVersion' : 'simulationVersion']
    const actual = kind === 'dataset' ? provided.datasetVersion : kind === 'taxonomy' ? provided.taxonomyVersion : kind === 'feature' ? provided.featureVersion : kind === 'model' ? provided.modelVersion : provided.simulationVersion
    if (expected === undefined || expected === null) continue
    if (actual !== expected) {
      issues.push({ code: 'version-mismatch', message: kind + ': se esperaba ' + expected + ' y se recibió ' + String(actual) })
    }
  }
  return { ok: issues.length === 0, issues }
}

export function isCalibrationPossible(bundle: VersionBundle, modelCalibrated: boolean): boolean {
  return bundle.modelVersion !== null && modelCalibrated
}

export async function hashDataset(input: {
  sourceDocumentIds: string[]
  historicalQuestionIds: string[]
  taxonomyVersion: string
}): Promise<string> {
  return sha256Hex(stableHashInput({
    sourceDocumentIds: input.sourceDocumentIds.slice().sort(),
    historicalQuestionIds: input.historicalQuestionIds.slice().sort(),
    taxonomyVersion: input.taxonomyVersion,
  }))
}

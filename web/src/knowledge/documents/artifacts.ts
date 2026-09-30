import { sha256, shortenId, stableStringify } from '../ids'
import type { ArtifactType, DocumentArtifact } from './types'

export const markdownGeneratorId = 'mir-document-skill'
export const markdownGeneratorVersion = '1.0.0'
export const markdownNormalizerVersion = 'normalizer-1'
export const artifactHashAlgorithm = 'sha256'

export const artifactTypeLabels: Record<ArtifactType, string> = {
  pdf: 'PDF original',
  markdown: 'Markdown canonico',
  json: 'JSON intermedio',
  'extraction-result': 'Resultado de extraccion',
  snapshot: 'Snapshot de dataset',
}

export const artifactRules: string[] = [
  'Todo artefacto declara origen, version, generador y hash.',
  'El hash no incluye fechas: mismo origen y misma configuracion dan el mismo sha256.',
  'Un Markdown derivado de un PDF conserva documento, version y artefacto padre.',
  'Un cambio del normalizador produce una version nueva, nunca reescribe el pasado.',
  'Un cambio del extractor no altera retroactivamente un Markdown ya generado.',
]

export type ArtifactHashInput = {
  sourceDocumentId: string
  documentVersionId: string
  artifactType: ArtifactType
  version: number
  generator: string
  generatorVersion: string
  parentArtifactId: string | null
  metadata: Record<string, string | number | null>
  contentSha256: string
}

export function computeArtifactSha256(input: ArtifactHashInput): string {
  return sha256(
    stableStringify({
      sourceDocumentId: input.sourceDocumentId,
      documentVersionId: input.documentVersionId,
      artifactType: input.artifactType,
      version: input.version,
      generator: input.generator,
      generatorVersion: input.generatorVersion,
      parentArtifactId: input.parentArtifactId,
      metadata: input.metadata,
      contentSha256: input.contentSha256,
      algorithm: artifactHashAlgorithm,
    }),
  )
}

export type CreateArtifactInput = {
  sourceDocumentId: string
  documentVersionId: string
  artifactType: ArtifactType
  content: string
  createdAt: string
  generator?: string
  generatorVersion?: string
  version?: number
  parentArtifactId?: string | null
  metadata?: Record<string, string | number | null>
  contentRef?: string
}

export function createDocumentArtifact(input: CreateArtifactInput): DocumentArtifact {
  const generator = input.generator ?? markdownGeneratorId
  const generatorVersion = input.generatorVersion ?? markdownGeneratorVersion
  const version = input.version ?? 1
  const parentArtifactId = input.parentArtifactId ?? null
  const metadata = input.metadata ?? {}
  const contentSha256 = sha256(input.content)
  const sha = computeArtifactSha256({
    sourceDocumentId: input.sourceDocumentId,
    documentVersionId: input.documentVersionId,
    artifactType: input.artifactType,
    version,
    generator,
    generatorVersion,
    parentArtifactId,
    metadata,
    contentSha256,
  })
  return {
    artifactId: shortenId('art', sha, 24),
    sourceDocumentId: input.sourceDocumentId,
    documentVersionId: input.documentVersionId,
    artifactType: input.artifactType,
    version,
    sha256: sha,
    contentSha256,
    createdAt: input.createdAt,
    generator,
    generatorVersion,
    parentArtifactId,
    metadata,
    contentRef: input.contentRef ?? input.sourceDocumentId + '/' + input.documentVersionId + '/' + input.artifactType + '/v' + String(version),
  }
}

export function verifyDocumentArtifact(artifact: DocumentArtifact, content: string): boolean {
  if (sha256(content) !== artifact.contentSha256) return false
  const recomputed = computeArtifactSha256({
    sourceDocumentId: artifact.sourceDocumentId,
    documentVersionId: artifact.documentVersionId,
    artifactType: artifact.artifactType,
    version: artifact.version,
    generator: artifact.generator,
    generatorVersion: artifact.generatorVersion,
    parentArtifactId: artifact.parentArtifactId,
    metadata: artifact.metadata,
    contentSha256: artifact.contentSha256,
  })
  return recomputed === artifact.sha256
}

export function describeArtifact(artifact: DocumentArtifact): string {
  return [
    artifact.artifactType,
    'v' + String(artifact.version),
    artifact.generator + '@' + artifact.generatorVersion,
    artifact.parentArtifactId === null ? 'sin padre' : 'padre ' + artifact.parentArtifactId,
    artifact.sha256.slice(0, 12),
  ].join(' · ')
}

export function artifactIdentity(artifact: DocumentArtifact): string {
  return [artifact.sourceDocumentId, artifact.documentVersionId, artifact.artifactType, String(artifact.version)].join('|')
}

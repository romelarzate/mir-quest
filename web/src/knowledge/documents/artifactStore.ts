import { verifyDocumentArtifact } from './artifacts'
import type { ArtifactType, DocumentArtifact } from './types'

export type ArtifactFilter = {
  sourceDocumentId?: string
  documentVersionId?: string
  artifactType?: ArtifactType
}

export type DocumentArtifactStore = {
  id: string
  label: string
  scope: 'local-memory' | 'cloud-not-implemented'
  put: (artifact: DocumentArtifact, content: string) => Promise<void>
  get: (artifactId: string) => Promise<{ artifact: DocumentArtifact; content: string } | null>
  exists: (artifactId: string) => Promise<boolean>
  getMetadata: (artifactId: string) => Promise<DocumentArtifact | null>
  list: (filter?: ArtifactFilter) => Promise<DocumentArtifact[]>
}

export const artifactStoreRules: string[] = [
  'El contrato de almacen esta definido; no hay implementacion cloud.',
  'La implementacion local existe solo para pruebas y uso en el dispositivo.',
  'Un artefacto se guarda con su contenido y se puede verificar con su hash.',
]

export function createLocalArtifactStore(id = 'local-artifact-store'): DocumentArtifactStore {
  const artifacts = new Map<string, DocumentArtifact>()
  const contents = new Map<string, string>()
  return {
    id,
    label: 'Almacen local de artefactos (memoria)',
    scope: 'local-memory',
    put: async (artifact, content) => {
      artifacts.set(artifact.artifactId, artifact)
      contents.set(artifact.artifactId, content)
    },
    get: async (artifactId) => {
      const artifact = artifacts.get(artifactId)
      const content = contents.get(artifactId)
      if (!artifact || content === undefined) return null
      return { artifact, content }
    },
    exists: async (artifactId) => artifacts.has(artifactId),
    getMetadata: async (artifactId) => artifacts.get(artifactId) ?? null,
    list: async (filter) =>
      Array.from(artifacts.values()).filter((artifact) => {
        if (filter?.sourceDocumentId && artifact.sourceDocumentId !== filter.sourceDocumentId) return false
        if (filter?.documentVersionId && artifact.documentVersionId !== filter.documentVersionId) return false
        if (filter?.artifactType && artifact.artifactType !== filter.artifactType) return false
        return true
      }),
  }
}

export const cloudArtifactStore: DocumentArtifactStore = {
  id: 'cloud-artifact-store',
  label: 'Almacen cloud (no implementado)',
  scope: 'cloud-not-implemented',
  put: async () => {
    throw new Error('Almacen cloud no implementado: esta fase solo define el contrato.')
  },
  get: async () => {
    throw new Error('Almacen cloud no implementado: esta fase solo define el contrato.')
  },
  exists: async () => false,
  getMetadata: async () => null,
  list: async () => [],
}

export function describeArtifactStore(storeToDescribe: DocumentArtifactStore): string {
  return storeToDescribe.id + ' · alcance ' + storeToDescribe.scope
}

export async function verifyStoredArtifacts(storeToCheck: DocumentArtifactStore): Promise<string[]> {
  const failing: string[] = []
  const listed = await storeToCheck.list()
  for (const artifact of listed) {
    const stored = await storeToCheck.get(artifact.artifactId)
    if (!stored) {
      failing.push(artifact.artifactId)
      continue
    }
    if (!verifyDocumentArtifact(stored.artifact, stored.content)) failing.push(artifact.artifactId)
  }
  return failing
}

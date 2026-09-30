import { sha256 } from '../ids'
import { createDocumentArtifact, markdownGeneratorId, markdownGeneratorVersion, markdownNormalizerVersion } from './artifacts'
import { normalizeDocumentText } from './normalize'
import type { CanonicalDocument, MarkdownBlock } from './types'

export const uncertainMarker = '<!-- uncertain -->'
export const uninterpretedFence = 'uninterpreted'

export function blockIdFor(documentId: string, versionId: string, page: number, index: number): string {
  return [documentId, versionId, 'p' + String(page), 'b' + String(index)].join(':')
}

export function renderBlock(block: MarkdownBlock): string {
  if (block.kind === 'page-break') return '<!-- page ' + String(block.page) + ' -->'
  if (block.kind === 'uninterpreted') {
    return ['```' + uninterpretedFence, block.sourceText, '```'].join(String.fromCharCode(10))
  }
  if (block.kind === 'title') return '# ' + block.text
  if (block.kind === 'heading') return '#'.repeat(block.level === null ? 2 : block.level) + ' ' + block.text
  if (block.kind === 'list-item') return '- ' + block.text
  return block.text
}

export function renderCanonicalMarkdown(blocks: MarkdownBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.uncertain) parts.push(uncertainMarker)
    parts.push(renderBlock(block))
  }
  return parts.join(String.fromCharCode(10))
}

export type BuildCanonicalInput = {
  sourceDocumentId: string
  versionId: string
  blocks: MarkdownBlock[]
  createdAt: string
  parentArtifactId?: string | null
  sourceSha256?: string | null
}

export type CanonicalBuildResult = {
  document: CanonicalDocument
  normalizationChanges: string[]
}

export function buildCanonicalDocument(input: BuildCanonicalInput): CanonicalBuildResult {
  const raw = renderCanonicalMarkdown(input.blocks)
  const normalized = normalizeDocumentText(raw)
  const artifact = createDocumentArtifact({
    sourceDocumentId: input.sourceDocumentId,
    documentVersionId: input.versionId,
    artifactType: 'markdown',
    content: normalized.text,
    createdAt: input.createdAt,
    generator: markdownGeneratorId,
    generatorVersion: markdownGeneratorVersion,
    parentArtifactId: input.parentArtifactId ?? null,
    metadata: {
      blocks: input.blocks.length,
      normalizerVersion: markdownNormalizerVersion,
      sourceSha256: input.sourceSha256 ?? null,
    },
  })
  return {
    document: {
      documentId: input.sourceDocumentId,
      versionId: input.versionId,
      markdownArtifactId: artifact.artifactId,
      generator: markdownGeneratorId,
      generatorVersion: markdownGeneratorVersion,
      normalizerVersion: markdownNormalizerVersion,
      markdown: normalized.text,
      blocks: input.blocks,
      pageMap: [],
      sha256: artifact.sha256,
      createdAt: input.createdAt,
    },
    normalizationChanges: normalized.changes,
  }
}

export function markdownContentHash(document: CanonicalDocument): string {
  return sha256(document.markdown)
}

export function describeCanonicalDocument(document: CanonicalDocument): string {
  return [
    String(document.blocks.length) + ' bloques',
    document.generator + '@' + document.generatorVersion,
    document.normalizerVersion,
    'sha ' + document.sha256.slice(0, 12),
  ].join(' · ')
}

export function markdownLineCount(document: CanonicalDocument): number {
  return document.markdown.split(String.fromCharCode(10)).filter((line) => line.length > 0).length
}

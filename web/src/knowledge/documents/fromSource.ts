import { markdownGeneratorVersion, markdownNormalizerVersion } from './artifacts'
import { blockIdFor, buildCanonicalDocument } from './markdown'
import { buildPageMap } from './pageMap'
import { normalizeForComparison } from './normalize'
import type { DocumentVersionRef, PdfPage, SourceDocumentRef } from '../extraction/types'
import type { CanonicalDocument, MarkdownBlock, MarkdownBlockKind } from './types'

const nl = String.fromCharCode(10)
const headingPattern = new RegExp('^(#{1,6})\\s+(.+)$')
const emptyHeadingPattern = new RegExp('^(#{1,6})\\s*$')
const optionPattern = new RegExp('^([A-Ea-e])\\s*[.)\\-]\\s+\\S')
const numberedPattern = new RegExp('^\\d{1,3}\\s*[.)\\-]\\s+\\S')
const listPattern = new RegExp('^\\s*[-*•]\\s+\\S')
const allCapsPattern = new RegExp('^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,.()-]{3,79}$')

export const lossGuardRule =
  'Ninguna linea de la fuente puede desaparecer: todo lo no interpretado se conserva como bloque.'

export type LineClassification = {
  kind: MarkdownBlockKind
  level: number | null
  uncertain: boolean
  reason: string | null
  text: string
}

export function anomalousRatio(text: string): number {
  if (text.length === 0) return 0
  let anomalous = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code < 0x20 && char !== String.fromCharCode(9)) anomalous += 1
    else if (char === String.fromCharCode(0xfffd)) anomalous += 1
    else if (code >= 0xe000 && code <= 0xf8ff) anomalous += 1
  }
  return Math.round((anomalous / text.length) * 10000) / 10000
}

export function classifySourceLine(line: string, isFirstHeading: boolean): LineClassification {
  const trimmed = line.trim()

  if (anomalousRatio(trimmed) >= 0.2) {
    return { kind: 'uninterpreted', level: null, uncertain: true, reason: 'caracteres anomalos', text: trimmed }
  }
  const emptyHeading = emptyHeadingPattern.exec(trimmed)
  if (emptyHeading) {
    return { kind: 'heading', level: emptyHeading[1].length, uncertain: true, reason: 'encabezado sin texto', text: '' }
  }
  const heading = headingPattern.exec(trimmed)
  if (heading) {
    return { kind: isFirstHeading ? 'title' : 'heading', level: heading[1].length, uncertain: false, reason: null, text: heading[2].trim() }
  }
  const pipeCount = trimmed.split('|').length - 1
  if (pipeCount >= 2) return { kind: 'table-row', level: null, uncertain: false, reason: null, text: trimmed }
  if (trimmed.indexOf('[figura]') !== -1 || trimmed.indexOf('[imagen]') !== -1) {
    return { kind: 'figure', level: null, uncertain: false, reason: null, text: trimmed }
  }
  if (optionPattern.test(trimmed)) return { kind: 'option', level: null, uncertain: false, reason: null, text: trimmed }
  if (listPattern.test(trimmed)) return { kind: 'list-item', level: null, uncertain: false, reason: null, text: trimmed.replace(listPattern, '') }
  if (numberedPattern.test(trimmed)) return { kind: 'paragraph', level: null, uncertain: false, reason: null, text: trimmed }
  if (allCapsPattern.test(trimmed)) {
    return { kind: isFirstHeading ? 'title' : 'heading', level: 2, uncertain: false, reason: null, text: trimmed }
  }
  if (trimmed.startsWith('§') || trimmed.indexOf('???') !== -1) {
    return { kind: 'uninterpreted', level: null, uncertain: true, reason: 'estructura no reconocida', text: trimmed }
  }
  return { kind: 'paragraph', level: null, uncertain: false, reason: null, text: trimmed }
}

export function buildBlocksFromPages(
  pages: PdfPage[],
  input: { documentId: string; versionId: string },
): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let hasHeading = false

  for (const page of pages) {
    const streams = page.columnTexts && page.columnTexts.length > 0 ? page.columnTexts : [page.text]
    let index = 0
    if (page.pageNumber > 1) {
      blocks.push({
        blockId: blockIdFor(input.documentId, input.versionId, page.pageNumber, -1),
        kind: 'page-break',
        text: '',
        sourceText: '',
        level: null,
        page: page.pageNumber,
        uncertain: false,
        reason: null,
      })
    }
    for (const stream of streams) {
      for (const rawLine of stream.split(nl)) {
        const trimmed = rawLine.trim()
        if (trimmed.length === 0) continue
        const classified = classifySourceLine(trimmed, !hasHeading)
        if (classified.kind === 'title' || classified.kind === 'heading') hasHeading = true
        blocks.push({
          blockId: blockIdFor(input.documentId, input.versionId, page.pageNumber, index),
          kind: classified.kind,
          text: classified.text,
          sourceText: trimmed,
          level: classified.level,
          page: page.pageNumber,
          uncertain: classified.uncertain,
          reason: classified.reason,
        })
        index += 1
      }
    }
  }
  return blocks
}

export type CanonicalBuildFromSource = {
  document: CanonicalDocument
  normalizationChanges: string[]
}

export function buildCanonicalFromPages(
  pages: PdfPage[],
  input: { document: SourceDocumentRef; version: DocumentVersionRef; createdAt: string; parentArtifactId?: string | null },
): CanonicalBuildFromSource {
  const blocks = buildBlocksFromPages(pages, { documentId: input.document.id, versionId: input.version.id })
  const built = buildCanonicalDocument({
    sourceDocumentId: input.document.id,
    versionId: input.version.id,
    blocks,
    createdAt: input.createdAt,
    parentArtifactId: input.parentArtifactId ?? null,
    sourceSha256: input.document.sha256,
  })
  const pageMap = buildPageMap({
    sourceDocumentId: input.document.id,
    documentVersionId: input.version.id,
    blocks,
  })
  return {
    document: { ...built.document, pageMap },
    normalizationChanges: built.normalizationChanges,
  }
}

/** Guarda anti-perdida: devuelve las lineas de la fuente ausentes del documento. */
export function findLostSourceText(pages: PdfPage[], document: CanonicalDocument): string[] {
  const preserved = new Set(
    normalizeForComparison(document.blocks.map((block) => block.sourceText).join(nl)).split(nl),
  )
  const lost: string[] = []
  for (const page of pages) {
    const streams = page.columnTexts && page.columnTexts.length > 0 ? page.columnTexts : [page.text]
    for (const stream of streams) {
      for (const rawLine of stream.split(nl)) {
        const trimmed = rawLine.trim()
        if (trimmed.length === 0) continue
        if (!preserved.has(normalizeForComparison(trimmed))) lost.push(trimmed)
      }
    }
  }
  return lost
}

export function documentSkillVersions(): { generator: string; generatorVersion: string; normalizerVersion: string } {
  return { generator: 'mir-document-skill', generatorVersion: markdownGeneratorVersion, normalizerVersion: markdownNormalizerVersion }
}

import { describe, expect, it } from 'vitest'
import {
  artifactRules,
  artifactTypeLabels,
  computeArtifactSha256,
  createDocumentArtifact,
  describeArtifact,
  verifyDocumentArtifact,
} from './artifacts'
import { artifactTypes } from './types'
import { cloudArtifactStore, createLocalArtifactStore, describeArtifactStore, artifactStoreRules, verifyStoredArtifacts } from './artifactStore'
import { normalizeDocumentText, countLines } from './normalize'
import { buildCanonicalDocument, describeCanonicalDocument, markdownContentHash, renderCanonicalMarkdown, uncertainMarker } from './markdown'
import { buildPageMap, buildTraceabilityChain, describeTrace, missingPageMapEntries, pageRangeForBlock, traceChainFromBlocks } from './pageMap'
import { findLostSourceText, buildBlocksFromPages, buildCanonicalFromPages, classifySourceLine, lossGuardRule } from './fromSource'
import { canonicalDocumentToPages, createMarkdownTextSource, markdownSourceRules } from './markdownSource'
import { assertSkillResponsibility, describeSkill, forbiddenActions, skillBoundaries, skillCan, skillCannot, skillConsumers } from './skill'
import { documentFixtureDisclaimer, documentFixtures, findDocumentFixture, reuseExtractionPages } from './fixtures'
import { validateCanonicalDocument, documentValidatorCatalog, documentValidationRules, summarizeDocumentIssues } from './documentValidators'
import type { MarkdownBlock } from './types'

const now = '2026-09-29T09:00:00.000Z'

function block(partial: Partial<MarkdownBlock> & { blockId: string; page: number }): MarkdownBlock {
  return {
    blockId: partial.blockId,
    kind: partial.kind ?? 'paragraph',
    text: partial.text ?? 'texto',
    sourceText: partial.sourceText ?? partial.text ?? 'texto',
    level: partial.level ?? null,
    page: partial.page,
    uncertain: partial.uncertain ?? false,
    reason: partial.reason ?? null,
  }
}

describe('artefacto documental', () => {
  it('declara los cinco tipos de artefacto', () => {
    expect(artifactTypes.length).toBe(5)
    expect(Object.keys(artifactTypeLabels).length).toBe(5)
    expect(artifactRules.length).toBe(5)
  })

  it('crea un artefacto con hash reproducible', () => {
    const first = createDocumentArtifact({ sourceDocumentId: 'doc-1', documentVersionId: 'v1', artifactType: 'markdown', content: '# Titulo', createdAt: now })
    const second = createDocumentArtifact({ sourceDocumentId: 'doc-1', documentVersionId: 'v1', artifactType: 'markdown', content: '# Titulo', createdAt: '2027-01-01T00:00:00.000Z' })
    expect(first.sha256).toBe(second.sha256)
    expect(first.artifactId).toBe(second.artifactId)
    expect(first.contentSha256.length).toBe(64)
    expect(verifyDocumentArtifact(first, '# Titulo')).toBe(true)
    expect(verifyDocumentArtifact(first, '# Otro')).toBe(false)
  })

  it('cambia el hash si cambia generador, configuracion o contenido', () => {
    const base = { sourceDocumentId: 'doc-1', documentVersionId: 'v1', artifactType: 'markdown' as const, content: '# Titulo', createdAt: now }
    const reference = createDocumentArtifact(base)
    expect(createDocumentArtifact({ ...base, content: '# Titulo 2' }).sha256).not.toBe(reference.sha256)
    expect(createDocumentArtifact({ ...base, generatorVersion: '9.9.9' }).sha256).not.toBe(reference.sha256)
    expect(createDocumentArtifact({ ...base, parentArtifactId: 'art-padre' }).sha256).not.toBe(reference.sha256)
    expect(computeArtifactSha256({ sourceDocumentId: 'doc-1', documentVersionId: 'v1', artifactType: 'markdown', version: 1, generator: reference.generator, generatorVersion: reference.generatorVersion, parentArtifactId: null, metadata: {}, contentSha256: reference.contentSha256 })).toBe(reference.sha256)
    expect(describeArtifact(reference)).toContain('markdown')
  })

  it('conserva el artefacto padre en un markdown derivado', () => {
    const pdfArtifact = createDocumentArtifact({ sourceDocumentId: 'doc-1', documentVersionId: 'v1', artifactType: 'pdf', content: 'binario', createdAt: now })
    const markdown = createDocumentArtifact({ sourceDocumentId: 'doc-1', documentVersionId: 'v1', artifactType: 'markdown', content: '# Titulo', createdAt: now, parentArtifactId: pdfArtifact.artifactId })
    expect(markdown.parentArtifactId).toBe(pdfArtifact.artifactId)
  })
})

describe('normalizador', () => {
  it('es determinista y no reinterpreta contenido', () => {
    const input = 'linea con acentos: cardiologia, arritmia.' + String.fromCharCode(13) + String.fromCharCode(10) + 'segunda linea   '
    const first = normalizeDocumentText(input)
    const second = normalizeDocumentText(input)
    expect(first.text).toBe(second.text)
    expect(first.changes.length).toBeGreaterThan(0)
    expect(first.text).toContain('cardiologia, arritmia.')
    expect(first.text.indexOf(String.fromCharCode(13))).toBe(-1)
    expect(countLines(first.text)).toBe(3)
  })

  it('no cambia un texto ya normalizado', () => {
    const result = normalizeDocumentText('una linea' + String.fromCharCode(10))
    expect(result.text).toBe('una linea' + String.fromCharCode(10))
  })
})

describe('markdown canonico', () => {
  it('renderiza cada tipo de bloque de forma determinista', () => {
    const blocks = [
      block({ blockId: 'b1', page: 1, kind: 'title', text: 'Titulo' }),
      block({ blockId: 'b2', page: 1, kind: 'heading', text: 'Seccion', level: 2 }),
      block({ blockId: 'b3', page: 1, kind: 'option', text: 'A) Opcion A' }),
      block({ blockId: 'b4', page: 2, kind: 'page-break', text: '' }),
      block({ blockId: 'b5', page: 2, kind: 'uninterpreted', text: 'dato raro', sourceText: 'dato raro' }),
      block({ blockId: 'b6', page: 2, kind: 'table-row', text: '| a | b |' }),
      block({ blockId: 'b7', page: 2, kind: 'figure', text: '[figura] grafico' }),
    ]
    const markdown = renderCanonicalMarkdown(blocks)
    expect(markdown).toContain('# Titulo')
    expect(markdown).toContain('## Seccion')
    expect(markdown).toContain('A) Opcion A')
    expect(markdown).toContain('<!-- page 2 -->')
    expect(markdown).toContain('```uninterpreted')
    expect(markdown).toContain('| a | b |')
    expect(markdown).toContain('[figura] grafico')
    expect(uncertainMarker).toContain('uncertain')
  })

  it('construye el documento canonico con hash y page map', () => {
    const blocks = [block({ blockId: 'b1', page: 1, kind: 'title', text: 'Titulo' }), block({ blockId: 'b2', page: 1, text: 'Parrafo.' })]
    const built = buildCanonicalDocument({ sourceDocumentId: 'doc-1', versionId: 'v1', blocks, createdAt: now })
    expect(built.document.sha256.length).toBe(64)
    expect(built.document.markdownArtifactId).toContain('art_')
    expect(markdownContentHash(built.document).length).toBe(64)
    expect(describeCanonicalDocument(built.document)).toContain('bloques')
    const pageMap = buildPageMap({ sourceDocumentId: 'doc-1', documentVersionId: 'v1', blocks })
    expect(pageMap.length).toBe(2)
    expect(pageMap[0].sourceOffsetStart).toBeNull()
    expect(missingPageMapEntries(pageMap, blocks)).toEqual([])
    expect(pageRangeForBlock(pageMap, 'b2')).toEqual({ start: 1, end: 1 })
    expect(pageRangeForBlock(pageMap, 'inexistente')).toBeNull()
  })
})

describe('trazabilidad', () => {
  it('construye una cadena completa y describe lo que falta', () => {
    const complete = buildTraceabilityChain({
      sourceDocumentId: 'doc-1',
      documentVersionId: 'v1',
      markdownArtifactId: 'art_1',
      markdownBlockId: 'doc-1:v1:p1:b0',
      sourcePageStart: 1,
      sourcePageEnd: 1,
      extractedQuestionNumber: 1,
    })
    expect(complete.complete).toBe(true)
    expect(describeTrace(complete)).toContain('cadena completa')
    const incomplete = buildTraceabilityChain({
      sourceDocumentId: 'doc-1',
      documentVersionId: 'v1',
      markdownArtifactId: 'art_1',
      markdownBlockId: 'doc-1:v1:p1:b0',
      sourcePageStart: null,
      sourcePageEnd: null,
    })
    expect(incomplete.complete).toBe(false)
    expect(incomplete.missing).toContain('sourcePageStart')
  })

  it('genera cadenas por pagina', () => {
    const blocks = [block({ blockId: 'b1', page: 1 }), block({ blockId: 'b2', page: 2 })]
    const pageMap = buildPageMap({ sourceDocumentId: 'doc', documentVersionId: 'v', blocks })
    const chain = traceChainFromBlocks(blocks, pageMap, { sourceDocumentId: 'doc', documentVersionId: 'v', markdownArtifactId: 'art_1', page: 2 })
    expect(chain.length).toBe(1)
    expect(chain[0].sourcePageStart).toBe(2)
  })
})

describe('store de artefactos', () => {
  it('guarda, recupera y verifica en local', async () => {
    const store = createLocalArtifactStore()
    const artifact = createDocumentArtifact({ sourceDocumentId: 'doc-1', documentVersionId: 'v1', artifactType: 'markdown', content: '# Titulo', createdAt: now })
    await store.put(artifact, '# Titulo')
    expect(await store.exists(artifact.artifactId)).toBe(true)
    expect((await store.getMetadata(artifact.artifactId))?.artifactId).toBe(artifact.artifactId)
    expect((await store.get(artifact.artifactId))?.content).toBe('# Titulo')
    expect((await store.list({ artifactType: 'markdown' })).length).toBe(1)
    expect((await store.list({ artifactType: 'pdf' })).length).toBe(0)
    expect(await verifyStoredArtifacts(store)).toEqual([])
    expect(await store.get('inexistente')).toBeNull()
    expect(describeArtifactStore(store)).toContain('local-memory')
    expect(artifactStoreRules.length).toBe(3)
  })

  it('el almacen cloud solo existe como contrato', async () => {
    expect(cloudArtifactStore.scope).toBe('cloud-not-implemented')
    await expect(cloudArtifactStore.put(createDocumentArtifact({ sourceDocumentId: 'd', documentVersionId: 'v', artifactType: 'markdown', content: 'x', createdAt: now }), 'x')).rejects.toThrow()
    expect(await cloudArtifactStore.exists('x')).toBe(false)
  })
})

describe('clasificacion de lineas de la fuente', () => {
  it('reconoce encabezados, opciones, tablas, figuras y listas', () => {
    expect(classifySourceLine('# Titulo', true).kind).toBe('title')
    expect(classifySourceLine('#### Nivel cuatro', false).kind).toBe('heading')
    expect(classifySourceLine('###', false).uncertain).toBe(true)
    expect(classifySourceLine('A) Opcion A', false).kind).toBe('option')
    expect(classifySourceLine('| a | b |', false).kind).toBe('table-row')
    expect(classifySourceLine('Observa la [figura]', false).kind).toBe('figure')
    expect(classifySourceLine('- elemento de lista', false).kind).toBe('list-item')
    expect(classifySourceLine('1. Enunciado numerado', false).kind).toBe('paragraph')
    expect(classifySourceLine('§§ 12-14 ??? bloque', false).kind).toBe('uninterpreted')
  })
})

describe('validacion documental', () => {
  it('declara los nueve validadores y su separacion de la validacion clinica', () => {
    expect(documentValidatorCatalog.length).toBe(9)
    expect(documentValidationRules.some((rule) => rule.indexOf('clinico') !== -1 || rule.indexOf('clinica') !== -1)).toBe(true)
  })

  it('detecta documento vacio', () => {
    const built = buildCanonicalDocument({ sourceDocumentId: 'doc-1', versionId: 'v1', blocks: [], createdAt: now })
    const report = validateCanonicalDocument(built.document)
    expect(report.ok).toBe(false)
    expect(report.issues.some((entry) => entry.code === 'empty-document')).toBe(true)
  })

  it('detecta page map incompleto', () => {
    const blocks = [block({ blockId: 'b1', page: 1, kind: 'title', text: 'Titulo' })]
    const built = buildCanonicalDocument({ sourceDocumentId: 'doc-1', versionId: 'v1', blocks, createdAt: now })
    const report = validateCanonicalDocument(built.document)
    expect(report.issues.some((entry) => entry.code === 'missing-page-map')).toBe(true)
  })
})

describe('fixtures documentales', () => {
  it('declara doce fixtures y un aviso de contenido sintetico', () => {
    expect(documentFixtures.length).toBe(12)
    expect(artifactTypes.length).toBe(5)
    expect(documentFixtureDisclaimer).toContain('sinteticos')
    expect(reuseExtractionPages('fixture-normal').length).toBe(2)
    expect(findDocumentFixture('doc-normal')?.label).toBe('Documento normal')
  })

  it('nunca pierde una linea de la fuente', () => {
    for (const fixture of documentFixtures) {
      const built = buildCanonicalFromPages(fixture.pages, {
        document: {
          id: 'doc-' + fixture.id,
          fileName: fixture.id + '.txt',
          title: fixture.label,
          sizeBytes: 1024,
          sha256: 'a'.repeat(64),
          declaredPages: fixture.pages.length,
          declaredOptionsPerQuestion: 4,
        },
        version: { id: 'v1-' + fixture.id, documentId: 'doc-' + fixture.id, versionLabel: 'v1', sha256: 'a'.repeat(64) },
        createdAt: now,
      })
      expect(fixture.expects.lossless, fixture.id).toBe(true)
      expect(findLostSourceText(fixture.pages, built.document), fixture.id).toEqual([])
      expect(built.document.blocks.length, fixture.id).toBeGreaterThanOrEqual(fixture.expects.minBlocks)
      expect(missingPageMapEntries(built.document.pageMap, built.document.blocks), fixture.id).toEqual([])
      if (fixture.expects.expectUninterpreted) {
        expect(built.document.blocks.some((entry) => entry.kind === 'uninterpreted'), fixture.id).toBe(true)
      }
      const report = validateCanonicalDocument(built.document)
      const codes = summarizeDocumentIssues(report)
      for (const expected of fixture.expects.expectedIssueCodes) {
        expect(Object.keys(codes), fixture.id + ' :: ' + expected).toContain(expected)
      }
    }
  })

  it('conserva todo el texto en el Markdown generado', () => {
    for (const fixture of documentFixtures) {
      const built = buildCanonicalFromPages(fixture.pages, {
        document: { id: 'doc-' + fixture.id, fileName: fixture.id + '.txt', title: fixture.label, sizeBytes: 1024, sha256: 'b'.repeat(64), declaredPages: fixture.pages.length, declaredOptionsPerQuestion: 4 },
        version: { id: 'v1-' + fixture.id, documentId: 'doc-' + fixture.id, versionLabel: 'v1', sha256: 'b'.repeat(64) },
        createdAt: now,
      })
      const markdownLines = new Set(built.document.markdown.split(String.fromCharCode(10)).map((line) => line.trim()).filter((line) => line.length > 0))
      for (const page of fixture.pages) {
        for (const line of page.text.split(String.fromCharCode(10))) {
          const trimmed = line.trim()
          if (trimmed.length === 0) continue
          const present = markdownLines.has(trimmed) || built.document.markdown.indexOf(trimmed) !== -1
          expect(present, fixture.id + ' :: ' + trimmed.slice(0, 40)).toBe(true)
        }
      }
    }
  })
})

describe('MIR Document Skill', () => {
  it('declara alcance y prohibiciones', () => {
    expect(describeSkill()).toContain('mir-document-skill')
    expect(skillCan.length).toBe(6)
    expect(skillCannot.length).toBe(7)
    expect(forbiddenActions).toContain('write-study-entities')
    expect(assertSkillResponsibility('produce-markdown').allowed).toBe(true)
    expect(assertSkillResponsibility('modify-study-state').allowed).toBe(false)
    expect(skillBoundaries.length).toBe(4)
    expect(Object.keys(skillConsumers).length).toBe(3)
    expect(skillCan.some((entry) => entry.indexOf('Markdown') !== -1)).toBe(true)
    expect(lossGuardRule).toContain('desaparecer')
  })
})

describe('adaptador Markdown para el extractor existente', () => {
  it('convierte el documento canonico en paginas de texto', () => {
    const fixture = findDocumentFixture('doc-normal')!
    const built = buildCanonicalFromPages(fixture.pages, {
      document: { id: 'doc-normal', fileName: 'doc-normal.txt', title: fixture.label, sizeBytes: 1024, sha256: 'c'.repeat(64), declaredPages: 2, declaredOptionsPerQuestion: 4 },
      version: { id: 'v1', documentId: 'doc-normal', versionLabel: 'v1', sha256: 'c'.repeat(64) },
      createdAt: now,
    })
    const pages = canonicalDocumentToPages(built.document)
    expect(pages.length).toBe(2)
    expect(pages[0].text).toContain('Respuesta correcta: B')
    expect(pages[0].width).toBeNull()
    expect(createMarkdownTextSource(built.document).id).toBe('markdown-text-source')
    expect(markdownSourceRules.length).toBe(3)
  })
})

describe('bloques desde paginas', () => {
  it('marca incertidumbre sin inventar contenido', () => {
    const pages = reuseExtractionPages('fixture-normal')
    const blocks = buildBlocksFromPages(pages, { documentId: 'doc-x', versionId: 'v1' })
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.filter((entry) => entry.kind === 'page-break').length).toBe(1)
    expect(blocks.every((entry) => entry.blockId.indexOf('doc-x:v1:p') === 0)).toBe(true)
  })
})

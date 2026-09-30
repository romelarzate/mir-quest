import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPdfjsAdapter, detectColumns, detectTableCandidates, loadPdfjs, pdfLibrary, readingOrderFor } from './pdfjsAdapter'
import { PdfAdapterFailure, createPdfError, errorFromUnknown, pdfErrorMessages, securityRules } from './errors'
import { bridgeRules, createRealPdfTextSource, describeRichPage, richDocumentToPages, segmentsToText, toPdfPage } from './bridge'
import { defaultPdfLimits } from './types'
import { buildCanonicalFromPages, findLostSourceText } from '../fromSource'
import { buildPageMap, missingPageMapEntries } from '../pageMap'
import { validateCanonicalDocument } from '../documentValidators'
import { createTextLayerExtractionService } from '../../extraction/pdfExtractionService'
import type { PdfTextSegment, RichPdfDocument } from './types'

const fixtureDir = join(process.cwd(), 'src', 'knowledge', 'documents', 'pdf', '__fixtures__')
const adapter = createPdfjsAdapter()
const createdAt = '2026-09-29T09:00:00.000Z'

const fixtureFiles = [
  'one-page.pdf',
  'multi-page.pdf',
  'two-columns.pdf',
  'options-a-e.pdf',
  'table.pdf',
  'image.pdf',
  'header-footer.pdf',
  'special-chars.pdf',
  'split-question.pdf',
  'empty-page.pdf',
]

function inspect(file: string, limits?: { maxBytes?: number; maxPages?: number }) {
  return adapter.inspect({ filePath: join(fixtureDir, file), limits })
}

function documentRefs(id: string) {
  return {
    document: {
      id,
      fileName: id + '.pdf',
      title: 'Fixture PDF ' + id,
      sizeBytes: 2048,
      sha256: 'a'.repeat(64),
      declaredPages: null,
      declaredOptionsPerQuestion: 4,
    },
    version: { id: id + '-v1', documentId: id, versionLabel: 'v1', sha256: 'a'.repeat(64) },
  }
}

describe('libreria y limites', () => {
  it('documenta la version y la licencia', () => {
    expect(pdfLibrary.name).toBe('pdfjs-dist')
    expect(pdfLibrary.version).toBe('6.3.289')
    expect(pdfLibrary.license).toBe('Apache-2.0')
    expect(defaultPdfLimits.maxBytes).toBeGreaterThan(0)
    expect(defaultPdfLimits.maxPages).toBeGreaterThan(0)
    expect(securityRules.length).toBe(5)
  })

  it('carga la libreria desde el punto de entrada de Node', async () => {
    const loaded = await loadPdfjs()
    expect(loaded.entry).toContain('pdfjs-dist')
    expect(typeof loaded.module.getDocument).toBe('function')
  })
})

describe('lectura binaria', () => {
  it('lee un PDF de una pagina y extrae texto', async () => {
    const document = await inspect('one-page.pdf')
    expect(document.pageCount).toBe(1)
    expect(document.pages.length).toBe(1)
    expect(document.pages[0].text).toContain('Enunciado DEMO')
    expect(document.pages[0].text).toContain('Respuesta correcta: B')
    expect(document.sha256.length).toBe(64)
    expect(document.sizeBytes).toBeGreaterThan(0)
    expect(document.encrypted).toBe(false)
  })

  it('cuenta las paginas de un PDF multipagina', async () => {
    const document = await inspect('multi-page.pdf')
    expect(document.pageCount).toBe(3)
    expect(document.pages.length).toBe(3)
    expect(document.pages[2].text).toContain('pagina tres')
  })

  it('es determinista: dos inspecciones producen el mismo resultado', async () => {
    const first = await inspect('multi-page.pdf')
    const second = await inspect('multi-page.pdf')
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })
})

describe('geometria', () => {
  it('expone dimensiones y coordenadas reales', async () => {
    const document = await inspect('one-page.pdf')
    const page = document.pages[0]
    expect(page.width).toBeCloseTo(595, 0)
    expect(page.height).toBeCloseTo(842, 0)
    const withCoords = page.textSegments.filter((segment) => segment.x !== null && segment.y !== null)
    expect(withCoords.length).toBeGreaterThan(0)
    expect(page.textSegments[0].pageNumber).toBe(1)
    expect(page.sourceOffsetsAvailable).toBe(false)
  })

  it('conserva todos los segmentos con su texto', async () => {
    const document = await inspect('options-a-e.pdf')
    const segments = document.pages[0].textSegments
    expect(segments.length).toBeGreaterThanOrEqual(7)
    expect(segmentsToText(segments)).toContain('E) Quinta opcion')
  })
})

describe('imagenes y tablas', () => {
  it('detecta presencia de imagen sin interpretarla', async () => {
    const document = await inspect('image.pdf')
    const images = document.pages[0].images
    expect(images.length).toBe(1)
    expect(images[0].boundingBox).toBeNull()
    expect(images[0].confidence).toBeNull()
    expect(images[0].note).toContain('no se interpreta')
  })

  it('no declara imagenes donde no las hay', async () => {
    const document = await inspect('one-page.pdf')
    expect(document.pages[0].images).toEqual([])
  })

  it('declara candidatos a tabla sin destruir texto', async () => {
    const document = await inspect('table.pdf')
    const candidates = document.pages[0].tables
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].confidence).toBeNull()
    expect(candidates[0].text.join(' ')).toContain('Valor 1')
    expect(document.pages[0].text).toContain('| Valor 1 | Valor 2 |')
  })

  it('detecta tablas por geometria en texto sin separadores', () => {
    const segments: PdfTextSegment[] = []
    const columns = [50, 150, 250, 350]
    for (let row = 0; row < 4; row += 1) {
      columns.forEach((x, index) => {
        segments.push({ segmentId: 's' + String(row) + '-' + String(index), pageNumber: 1, text: 'dato' + String(row) + String(index), x, y: 700 - row * 20, width: 40, height: 10, hasEol: false })
      })
    }
    const candidates = detectTableCandidates(segments, 1)
    expect(candidates.length).toBe(1)
    expect(candidates[0].columnCount).toBe(4)
  })
})

describe('columnas y orden de lectura', () => {
  it('detecta dos columnas por agrupacion de X y lo marca sin verificar', async () => {
    const document = await inspect('two-columns.pdf')
    const columns = document.pages[0].columns
    expect(columns.detected).toBeGreaterThanOrEqual(2)
    expect(columns.method).toBe('x-cluster')
    expect(columns.confidence).toBeNull()
    expect(columns.note).toContain('orden de lectura')
    expect(document.pages[0].readingOrder.order).toBe('content-stream')
    expect(document.pages[0].readingOrder.confidence).toBeNull()
  })

  it('no inventa columnas ni orden de lectura', () => {
    expect(detectColumns([]).detected).toBeNull()
    expect(readingOrderFor({ detected: null, method: null, confidence: null, note: '' }).confidence).toBeNull()
    expect(readingOrderFor({ detected: 1, method: 'x-cluster', confidence: null, note: '' }).order).toBe('content-stream')
  })

  it('no asume que el orden del flujo sea el visual', async () => {
    const document = await inspect('two-columns.pdf')
    expect(document.pages[0].readingOrder.note).toContain('no coincidir')
    const page = toPdfPage(document.pages[0])
    expect(page.declaredColumns).toBeGreaterThanOrEqual(2)
    expect(page.columnTexts).toBeNull()
  })
})

describe('pagina vacia y caracteres especiales', () => {
  it('marca la pagina vacia sin inventar contenido', async () => {
    const document = await inspect('empty-page.pdf')
    expect(document.pageCount).toBe(2)
    expect(document.pages[0].hasText).toBe(false)
    expect(document.pages[0].textSegments).toEqual([])
    expect(document.pages[0].text).toBe('')
    expect(document.pages[1].hasText).toBe(true)
  })

  it('conserva caracteres acentuados', async () => {
    const document = await inspect('special-chars.pdf')
    expect(document.pages[0].text).toContain('cardiologia')
    expect(document.pages[0].text.length).toBeGreaterThan(40)
  })

  it('conserva cabecera y pie como texto normal', async () => {
    const document = await inspect('header-footer.pdf')
    expect(document.pages[0].text).toContain('CABECERA')
    expect(document.pages[0].text).toContain('PIE DEMO')
  })
})

describe('errores tipados', () => {
  const temp = mkdtempSync(join(tmpdir(), 'mir-pdf-'))

  it('rechaza un archivo inexistente', async () => {
    await expect(adapter.inspect({ filePath: join(temp, 'no-existe.pdf') })).rejects.toThrow(PdfAdapterFailure)
    try {
      await adapter.inspect({ filePath: join(temp, 'no-existe.pdf') })
    } catch (error) {
      expect((error as PdfAdapterFailure).code).toBe('file-not-found')
    }
  })

  it('rechaza un archivo que no es PDF', async () => {
    const path = join(temp, 'falso.pdf')
    writeFileSync(path, 'esto no es un pdf', 'utf8')
    try {
      await adapter.inspect({ filePath: path })
      throw new Error('deberia haber fallado')
    } catch (error) {
      expect((error as PdfAdapterFailure).code).toBe('not-a-pdf')
    }
  })

  it('rechaza un PDF corrupto con error tipado', async () => {
    const path = join(temp, 'corrupto.pdf')
    writeFileSync(path, '%PDF-1.4' + String.fromCharCode(10) + 'basura sin estructura', 'latin1')
    try {
      await adapter.inspect({ filePath: path })
      throw new Error('deberia haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(PdfAdapterFailure)
      expect((error as PdfAdapterFailure).code).toBe('corrupted-pdf')
    }
  })

  it('rechaza un archivo por encima del limite sin leerlo entero', async () => {
    try {
      await inspect('one-page.pdf', { maxBytes: 10 })
      throw new Error('deberia haber fallado')
    } catch (error) {
      expect((error as PdfAdapterFailure).code).toBe('too-large')
    }
  })

  it('rechaza por limite de paginas', async () => {
    try {
      await inspect('multi-page.pdf', { maxPages: 1 })
      throw new Error('deberia haber fallado')
    } catch (error) {
      expect((error as PdfAdapterFailure).code).toBe('too-large')
    }
  })

  it('mapea errores de la libreria a codigos tipados', () => {
    expect(errorFromUnknown({ name: 'PasswordException', message: 'x' }).code).toBe('encrypted-pdf')
    expect(errorFromUnknown({ name: 'InvalidPDFException', message: 'x' }).code).toBe('corrupted-pdf')
    expect(errorFromUnknown({ name: 'MissingPDFException', message: 'x' }).code).toBe('file-not-found')
    expect(errorFromUnknown(new Error('otra cosa')).code).toBe('unknown')
    const encrypted = createPdfError('encrypted-pdf')
    expect(encrypted.recoverable).toBe(true)
    expect(pdfErrorMessages['too-large']).toContain('limite')
  })
})

describe('puente con MIR Document Skill', () => {
  it('convierte el documento enriquecido en paginas del contrato existente', async () => {
    const document = await inspect('image.pdf')
    const pages = richDocumentToPages(document)
    expect(pages.length).toBe(1)
    expect(pages[0].hasImages).toBe(true)
    const source = createRealPdfTextSource(document)
    expect(source.status).toBe('real-pdf')
    expect(bridgeRules.length).toBe(4)
    expect(describeRichPage(document.pages[0])).toContain('pagina 1')
    const loaded = await source.loadPages(documentRefs('x').document, documentRefs('x').version)
    expect(loaded.length).toBe(1)
  })

  it('no pierde ni una linea entre el PDF y el Markdown canonico', async () => {
    for (const file of fixtureFiles) {
      const document = await inspect(file)
      const refs = documentRefs(file.replace('.pdf', ''))
      const built = buildCanonicalFromPages(richDocumentToPages(document), {
        document: { ...refs.document, sha256: document.sha256, declaredPages: document.pageCount },
        version: refs.version,
        createdAt,
      })
      const lost = findLostSourceText(richDocumentToPages(document), built.document)
      expect(lost, file).toEqual([])
      expect(built.document.blocks.length, file).toBeGreaterThan(0)
      expect(missingPageMapEntries(built.document.pageMap, built.document.blocks), file).toEqual([])
      const report = validateCanonicalDocument(built.document)
      expect(report.issues.filter((entry) => entry.severity === 'error'), file).toEqual([])
    }
  })

  it('alimenta al extractor existente sin duplicar validacion', async () => {
    const document = await inspect('one-page.pdf')
    const refs = documentRefs('one-page')
    const source = createRealPdfTextSource(document)
    const run = await createTextLayerExtractionService().extract({ document: refs.document, version: refs.version, source })
    expect(run.questions.length).toBeGreaterThanOrEqual(1)
    expect(run.questions[0].validationStatus).toBe('accepted')
    expect(run.questions[0].options.length).toBeGreaterThanOrEqual(2)
    expect(run.questions[0].sourceDocumentId).toBe(refs.document.id)
  })

  it('el esquema de paginas ricas no inventa offsets', async () => {
    const document = await inspect('multi-page.pdf')
    expect(document.pages.every((page) => page.sourceOffsetsAvailable === false)).toBe(true)
    expect(document.pages.every((page) => page.tables.every((table) => table.boundingBox === null))).toBe(true)
    const pageMap = buildPageMap({ sourceDocumentId: 'd', documentVersionId: 'v', blocks: [] })
    expect(pageMap).toEqual([])
  })

  it('mantiene la procedencia documento, pagina y segmento', async () => {
    const document = await inspect('split-question.pdf')
    expect(document.pageCount).toBe(2)
    const withSegment = document.pages[1].textSegments[0]
    expect(withSegment.pageNumber).toBe(2)
    expect(withSegment.segmentId).toContain('p2')
    const rich = document.pages[1] as RichPdfDocument['pages'][number]
    expect(rich.text).toContain('Respuesta correcta: D')
  })
})

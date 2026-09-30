import { findFixture } from '../extraction/fixtures'
import type { PdfPage } from '../extraction/types'

export const documentFixtureDisclaimer =
  'Fixtures sinteticos escritos a mano: no representan PDFs ni examenes MIR reales.'

const nl = String.fromCharCode(10)
const replacement = String.fromCharCode(0xfffd)

export type DocumentFixtureExpectations = {
  minBlocks: number
  expectUninterpreted: boolean
  expectedIssueCodes: string[]
  lossless: boolean
}

export type DocumentFixture = {
  id: string
  label: string
  description: string
  pages: PdfPage[]
  expects: DocumentFixtureExpectations
}

function textPage(pageNumber: number, lines: string[], extra: Partial<PdfPage> = {}): PdfPage {
  return {
    pageNumber,
    text: lines.join(nl),
    width: extra.width === undefined ? 595 : extra.width,
    height: extra.height === undefined ? 842 : extra.height,
    declaredColumns: extra.declaredColumns === undefined ? 1 : extra.declaredColumns,
    columnTexts: extra.columnTexts === undefined ? null : extra.columnTexts,
    hasImages: extra.hasImages === undefined ? false : extra.hasImages,
  }
}

/** Reutiliza las paginas ya existentes de la Fase 5.5 en lugar de duplicarlas. */
export function reuseExtractionPages(fixtureId: string): PdfPage[] {
  const fixture = findFixture(fixtureId)
  if (!fixture) throw new Error('Fixture de extraccion inexistente: ' + fixtureId)
  return fixture.pages.map((page) => ({ ...page }))
}

export const documentFixtures: DocumentFixture[] = [
  {
    id: 'doc-normal',
    label: 'Documento normal',
    description: 'Reutiliza el examen sintetico normal de la Fase 5.5.',
    pages: reuseExtractionPages('fixture-normal'),
    expects: { minBlocks: 6, expectUninterpreted: false, expectedIssueCodes: [], lossless: true },
  },
  {
    id: 'doc-multi-page',
    label: 'Multiples paginas',
    description: 'Tres paginas con encabezado, seccion no interpretable y parrafo final.',
    pages: [
      textPage(1, ['# Examen piloto DEMO', '1. Enunciado DEMO de la primera pagina con longitud suficiente.', 'A) Opcion A', 'B) Opcion B', 'Respuesta correcta: A']),
      textPage(2, ['## Seccion segunda', '2. Enunciado DEMO de la segunda pagina con longitud suficiente.', 'A) Opcion A', 'B) Opcion B', 'Respuesta correcta: B']),
      textPage(3, ['## Anexo', '§§ datos 12-14 no interpretables §§', '3. Enunciado DEMO de la tercera pagina.', 'A) Opcion A', 'B) Opcion B', 'Respuesta correcta: A']),
    ],
    expects: { minBlocks: 12, expectUninterpreted: true, expectedIssueCodes: [], lossless: true },
  },
  {
    id: 'doc-split-question',
    label: 'Pregunta partida entre paginas',
    description: 'Reutiliza el fixture de pregunta partida.',
    pages: reuseExtractionPages('fixture-split-pages'),
    expects: { minBlocks: 5, expectUninterpreted: false, expectedIssueCodes: [], lossless: true },
  },
  {
    id: 'doc-options-a-e',
    label: 'Opciones A a E',
    description: 'Reutiliza el fixture de cinco opciones.',
    pages: reuseExtractionPages('fixture-five-options'),
    expects: { minBlocks: 7, expectUninterpreted: false, expectedIssueCodes: [], lossless: true },
  },
  {
    id: 'doc-table',
    label: 'Tabla',
    description: 'Reutiliza el fixture con marcadores de tabla.',
    pages: reuseExtractionPages('fixture-table'),
    expects: { minBlocks: 5, expectUninterpreted: false, expectedIssueCodes: [], lossless: true },
  },
  {
    id: 'doc-image',
    label: 'Imagen',
    description: 'Reutiliza el fixture con referencia a figura.',
    pages: reuseExtractionPages('fixture-image'),
    expects: { minBlocks: 6, expectUninterpreted: false, expectedIssueCodes: ['image-dependent-content'], lossless: true },
  },
  {
    id: 'doc-orphan-text',
    label: 'Texto huerfano',
    description: 'Parrafo antes del primer encabezado.',
    pages: [textPage(1, ['Texto suelto DEMO antes de cualquier encabezado.', '# Encabezado posterior', 'A) Opcion A', 'B) Opcion B'])],
    expects: { minBlocks: 4, expectUninterpreted: false, expectedIssueCodes: ['orphan-text'], lossless: true },
  },
  {
    id: 'doc-broken-heading',
    label: 'Encabezado roto',
    description: 'Salto de nivel y encabezado sin texto.',
    pages: [textPage(1, ['# Titulo del documento', '#### Nivel cuatro sin nivel intermedio', '###', 'Parrafo final del documento.'])],
    expects: { minBlocks: 4, expectUninterpreted: false, expectedIssueCodes: ['broken-heading'], lossless: true },
  },
  {
    id: 'doc-columns',
    label: 'Columnas',
    description: 'Reutiliza el fixture de dos columnas declaradas.',
    pages: reuseExtractionPages('fixture-two-columns'),
    expects: { minBlocks: 10, expectUninterpreted: false, expectedIssueCodes: [], lossless: true },
  },
  {
    id: 'doc-anomalous-chars',
    label: 'Caracteres anomalos',
    description: 'Linea danada que debe conservarse como no interpretada.',
    pages: [textPage(1, ['# Documento con dano', replacement + replacement + replacement + replacement + 'dato', 'Parrafo final intacto.'])],
    expects: { minBlocks: 3, expectUninterpreted: true, expectedIssueCodes: [], lossless: true },
  },
  {
    id: 'doc-empty-page',
    label: 'Pagina vacia',
    description: 'Primera pagina sin texto y segunda con contenido.',
    pages: [textPage(1, ['   ']), textPage(2, ['# Contenido en la segunda pagina', 'Parrafo DEMO final.'])],
    expects: { minBlocks: 3, expectUninterpreted: false, expectedIssueCodes: [], lossless: true },
  },
  {
    id: 'doc-uninterpretable',
    label: 'Contenido no interpretable',
    description: 'Bloque que el Skill no puede interpretar y debe conservar entero.',
    pages: [textPage(1, ['# Documento parcial', '§§ 12-14 ??? bloque no interpretable §§', 'Parrafo final intacto.'])],
    expects: { minBlocks: 3, expectUninterpreted: true, expectedIssueCodes: [], lossless: true },
  },
]

export function findDocumentFixture(id: string): DocumentFixture | undefined {
  return documentFixtures.find((fixture) => fixture.id === id)
}

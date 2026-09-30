import { buildDocumentId, sha256, shortenId } from '../ids'
import type { DocumentVersionRef, PdfPage, SourceDocumentRef } from './types'

export const fixtureDisclaimer =
  'Los fixtures son texto sintético escrito a mano. No representan PDFs reales ni preguntas MIR reales.'

const nl = String.fromCharCode(10)

export type ExtractionFixture = {
  id: string
  label: string
  description: string
  document: SourceDocumentRef
  version: DocumentVersionRef
  pages: PdfPage[]
  expectations: {
    totalPages: number
    expectedQuestions: number
    expectedAccepted: number
    expectedQuarantined: number
    expectedRejected: number
    expectedErrorCodes: string[]
  }
}

function page(input: Partial<PdfPage> & { pageNumber: number; text: string }): PdfPage {
  return {
    pageNumber: input.pageNumber,
    text: input.text,
    width: input.width === undefined ? 595 : input.width,
    height: input.height === undefined ? 842 : input.height,
    declaredColumns: input.declaredColumns === undefined ? 1 : input.declaredColumns,
    columnTexts: input.columnTexts === undefined ? null : input.columnTexts,
    hasImages: input.hasImages === undefined ? false : input.hasImages,
  }
}

function document(input: {
  id: string
  fileName: string
  pages: number
  optionsPerQuestion: number,
  sizeBytes?: number
}): { document: SourceDocumentRef; version: DocumentVersionRef } {
  const contents = input.id + '|' + input.fileName
  const documentId = buildDocumentId(input.fileName, sha256(contents))
  return {
    document: {
      id: documentId,
      fileName: input.fileName,
      title: 'Examen piloto DEMO (sintético)',
      sizeBytes: input.sizeBytes ?? 2048,
      sha256: sha256(contents),
      declaredPages: input.pages,
      declaredOptionsPerQuestion: input.optionsPerQuestion,
    },
    version: {
      id: shortenId('docv', documentId + '|v1', 20),
      documentId,
      versionLabel: 'v1',
      sha256: sha256(contents),
    },
  }
}

const normalText = [
  '1. Enunciado DEMO de la pregunta uno con longitud suficiente para pasar el minimo.',
  'A) Opcion A de la pregunta uno',
  'B) Opcion B de la pregunta uno',
  'C) Opcion C de la pregunta uno',
  'D) Opcion D de la pregunta uno',
  'Respuesta correcta: B',
  '',
  '2. Enunciado DEMO de la pregunta dos con longitud suficiente para pasar el minimo.',
  'A) Opcion A de la pregunta dos',
  'B) Opcion B de la pregunta dos',
  'C) Opcion C de la pregunta dos',
  'D) Opcion D de la pregunta dos',
  'Respuesta: C',
].join(nl)

const splitPageOne = [
  '1. Enunciado DEMO que empieza en la pagina uno y continua',
  'A) Opcion A de la pregunta partida',
  'B) Opcion B de la pregunta partida',
].join(nl)

const splitPageTwo = [
  'C) Opcion C de la pregunta partida',
  'D) Opcion D de la pregunta partida',
  'Respuesta correcta: D',
].join(nl)

const columnOne = [
  '1. Enunciado DEMO en la primera columna con longitud suficiente.',
  'A) Opcion A',
  'B) Opcion B',
  'C) Opcion C',
  'D) Opcion D',
  'Respuesta correcta: A',
].join(nl)

const columnTwo = [
  '2. Enunciado DEMO en la segunda columna con longitud suficiente.',
  'A) Opcion A',
  'B) Opcion B',
  'C) Opcion C',
  'D) Opcion D',
  'Respuesta correcta: B',
].join(nl)

const interleavedText = [
  '1. Enunciado DEMO con columnas mezcladas por un extractor ingenuo.',
  'A) Opcion A de la columna izquierda',
  'B) Opcion B de la columna izquierda',
  'A) Opcion A de la columna derecha',
  'B) Opcion B de la columna derecha',
  'Respuesta correcta: A',
].join(nl)

const tableText = [
  '1. Enunciado DEMO que incluye una tabla de datos.',
  '| Columna 1 | Columna 2 |',
  '| Valor A | Valor B |',
  'A) Opcion A',
  'B) Opcion B',
  'Respuesta correcta: A',
].join(nl)

const imageText = [
  '1. Observa la [figura] y responde.',
  'A) Opcion A',
  'B) Opcion B',
  'C) Opcion C',
  'D) Opcion D',
  'Respuesta correcta: C',
].join(nl)

const fiveOptionsText = [
  '1. Enunciado DEMO con cinco opciones y longitud suficiente para pasar el minimo.',
  'A) Opcion A',
  'B) Opcion B',
  'C) Opcion C',
  'D) Opcion D',
  'E) Opcion E',
  'Respuesta correcta: E',
].join(nl)

const missingAnswerText = [
  '1. Enunciado DEMO sin linea de respuesta correcta y longitud suficiente.',
  'A) Opcion A',
  'B) Opcion B',
  'C) Opcion C',
  'D) Opcion D',
].join(nl)

const missingNumberText = [
  'Enunciado DEMO sin numero de pregunta y con longitud suficiente para pasar el minimo.',
  'A) Opcion A',
  'B) Opcion B',
  'Respuesta correcta: A',
].join(nl)

const truncatedText = [
  '1. Enunciado DEMO que se corta a mitad de la frase y no termina',
  'A) Opcion A',
  'B) Opcion B',
  'Respuesta correcta: A',
  'En el siguiente apartado el texto continua sin puntuacion final',
].join(nl)

function baseFixture(input: {
  id: string
  label: string
  description: string
  pages: PdfPage[]
  optionsPerQuestion?: number
  expectations: ExtractionFixture['expectations']
}): ExtractionFixture {
  const refs = document({
    id: input.id,
    fileName: input.id + '.txt',
    pages: input.pages.length,
    optionsPerQuestion: input.optionsPerQuestion ?? 4,
    sizeBytes: 1024 + input.pages.length * 256,
  })
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    document: refs.document,
    version: refs.version,
    pages: input.pages,
    expectations: input.expectations,
  }
}

export const extractionFixtures: ExtractionFixture[] = [
  baseFixture({
    id: 'fixture-normal',
    label: 'Examen sintético normal',
    description: 'Dos páginas: la primera con dos preguntas completas y la segunda vacía.',
    pages: [
      page({ pageNumber: 1, text: normalText }),
      page({ pageNumber: 2, text: 'Esta página no contiene preguntas.' }),
    ],
    expectations: { totalPages: 2, expectedQuestions: 3, expectedAccepted: 2, expectedQuarantined: 1, expectedRejected: 0, expectedErrorCodes: ['invalid-question-number'] },
  }),
  baseFixture({
    id: 'fixture-two-columns',
    label: 'Dos columnas declaradas',
    description: 'La página declara dos columnas y entrega dos flujos de texto ordenados.',
    pages: [page({ pageNumber: 1, text: columnOne + nl + columnTwo, declaredColumns: 2, columnTexts: [columnOne, columnTwo] })],
    expectations: { totalPages: 1, expectedQuestions: 2, expectedAccepted: 2, expectedQuarantined: 0, expectedRejected: 0, expectedErrorCodes: [] },
  }),
  baseFixture({
    id: 'fixture-columns-merged',
    label: 'Columnas mezcladas',
    description: 'Un extractor ingenuo unió las columnas y las etiquetas quedaron intercaladas.',
    pages: [page({ pageNumber: 1, text: interleavedText, declaredColumns: 2 })],
    expectations: { totalPages: 1, expectedQuestions: 1, expectedAccepted: 0, expectedQuarantined: 1, expectedRejected: 0, expectedErrorCodes: ['possible-column-loss'] },
  }),
  baseFixture({
    id: 'fixture-split-pages',
    label: 'Pregunta partida entre páginas',
    description: 'La pregunta empieza en la página uno y termina en la dos.',
    pages: [page({ pageNumber: 1, text: splitPageOne }), page({ pageNumber: 2, text: splitPageTwo })],
    expectations: { totalPages: 2, expectedQuestions: 1, expectedAccepted: 1, expectedQuarantined: 0, expectedRejected: 0, expectedErrorCodes: [] },
  }),
  baseFixture({
    id: 'fixture-table',
    label: 'Página con tabla',
    description: 'Contiene filas tipo tabla que la maquetación lineal no soporta.',
    pages: [page({ pageNumber: 1, text: tableText })],
    expectations: { totalPages: 1, expectedQuestions: 1, expectedAccepted: 0, expectedQuarantined: 1, expectedRejected: 0, expectedErrorCodes: ['table-layout-unsupported'] },
  }),
  baseFixture({
    id: 'fixture-image',
    label: 'Pregunta que depende de una imagen',
    description: 'El enunciado remite a una figura y no se puede responder sin verla.',
    pages: [page({ pageNumber: 1, text: imageText, hasImages: true })],
    expectations: { totalPages: 1, expectedQuestions: 1, expectedAccepted: 0, expectedQuarantined: 1, expectedRejected: 0, expectedErrorCodes: ['image-dependent-question'] },
  }),
  baseFixture({
    id: 'fixture-five-options',
    label: 'Opciones A a E',
    description: 'Pregunta con cinco opciones y respuesta E.',
    pages: [page({ pageNumber: 1, text: fiveOptionsText })],
    optionsPerQuestion: 5,
    expectations: { totalPages: 1, expectedQuestions: 1, expectedAccepted: 1, expectedQuarantined: 0, expectedRejected: 0, expectedErrorCodes: [] },
  }),
  baseFixture({
    id: 'fixture-missing-answer',
    label: 'Pregunta sin respuesta',
    description: 'No aparece ninguna marca de respuesta correcta.',
    pages: [page({ pageNumber: 1, text: missingAnswerText })],
    expectations: { totalPages: 1, expectedQuestions: 1, expectedAccepted: 0, expectedQuarantined: 1, expectedRejected: 0, expectedErrorCodes: ['missing-answer'] },
  }),
  baseFixture({
    id: 'fixture-missing-number',
    label: 'Pregunta sin número',
    description: 'El bloque no tiene marcador numérico.',
    pages: [page({ pageNumber: 1, text: missingNumberText })],
    expectations: { totalPages: 1, expectedQuestions: 1, expectedAccepted: 0, expectedQuarantined: 1, expectedRejected: 0, expectedErrorCodes: ['invalid-question-number'] },
  }),
  baseFixture({
    id: 'fixture-truncated',
    label: 'Texto truncado',
    description: 'La frase final se corta a mitad.',
    pages: [page({ pageNumber: 1, text: truncatedText })],
    expectations: { totalPages: 1, expectedQuestions: 1, expectedAccepted: 0, expectedQuarantined: 1, expectedRejected: 0, expectedErrorCodes: ['truncated-question'] },
  }),
  baseFixture({
    id: 'fixture-empty',
    label: 'Página sin material',
    description: 'No hay texto utilizable: debe rechazarse sin inventar contenido.',
    pages: [page({ pageNumber: 1, text: '   ' })],
    expectations: { totalPages: 1, expectedQuestions: 1, expectedAccepted: 0, expectedQuarantined: 0, expectedRejected: 1, expectedErrorCodes: ['empty-question', 'page-without-questions'] },
  }),
]

export function findFixture(id: string): ExtractionFixture | undefined {
  return extractionFixtures.find((fixture) => fixture.id === id)
}

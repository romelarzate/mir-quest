import { describe, expect, it } from 'vitest'
import { demoCurriculumBundle } from '../data/curriculum'
import { demoQuestionBank } from '../data/questions'
import type { ContentBundle } from './content'
import {
  ContentImporter,
  CurriculumImporter,
  FlashcardImporter,
  QuestionImporter,
  parseCsvImport,
  parseJsonImport,
  parseMarkdownImport,
} from './importers'
import type { ImportValidationContext } from './importers'

const bundle: ContentBundle = { ...demoCurriculumBundle, questions: demoQuestionBank }
const context: ImportValidationContext = { bundle, expectedSchemaVersion: 2 }

const validQuestion = {
  id: 'q-imp-1',
  subjectId: 'cardiologia',
  topicId: 'topic-cardio-arritmias',
  stem: 'Pregunta importada DEMO',
  optionA: 'primera',
  optionB: 'segunda',
  correctOptionId: 'a',
  explanation: 'explicación',
  difficulty: 'Media',
  sourceIds: 'src-demo-bank',
  tags: 'tag-demo',
}

function json(payload: unknown) {
  return JSON.stringify(payload)
}

describe('parsers', () => {
  it('parsea JSON en forma de contenedor', () => {
    const parsed = parseJsonImport(json({ schemaVersion: 2, entity: 'questions', records: [validQuestion] }), 'questions')
    expect(parsed.schemaVersion).toBe(2)
    expect(parsed.records.length).toBe(1)
    expect(parsed.issues).toEqual([])
  })

  it('parsea JSON en forma de array', () => {
    const parsed = parseJsonImport(json([validQuestion]), 'questions')
    expect(parsed.records.length).toBe(1)
    expect(parsed.schemaVersion).toBeNull()
  })

  it('informa de JSON inválido', () => {
    const parsed = parseJsonImport('{no json', 'questions')
    expect(parsed.issues[0].code).toBe('invalid-json')
  })

  it('parsea CSV con campos entrecomillados', () => {
    const csv = ['id,subjectId,stem', 'q-1,cardiologia,"Enunciado, con coma"'].join('\n')
    const parsed = parseCsvImport(csv, 'questions')
    expect(parsed.records[0].stem).toBe('Enunciado, con coma')
  })

  it('parsea Markdown con cabecera y bloques', () => {
    const md = [
      '# mir-quest import',
      'schemaVersion: 2',
      'entity: questions',
      '',
      '## q-md-1',
      'subjectId: cardiologia',
      'stem: Enunciado markdown',
    ].join('\n')
    const parsed = parseMarkdownImport(md, 'questions')
    expect(parsed.schemaVersion).toBe(2)
    expect(parsed.entity).toBe('questions')
    expect(parsed.records[0].id).toBe('q-md-1')
    expect(parsed.records[0].stem).toBe('Enunciado markdown')
  })

  it('informa de Markdown sin bloques', () => {
    const parsed = parseMarkdownImport('# solo cabecera', 'questions')
    expect(parsed.issues.some((entry) => entry.code === 'no-records')).toBe(true)
  })
})

describe('QuestionImporter', () => {
  it('importa una pregunta válida', () => {
    const result = QuestionImporter.import(json({ schemaVersion: 2, entity: 'questions', records: [validQuestion] }), 'json', context)
    expect(result.ok).toBe(true)
    expect(result.recordCount).toBe(1)
    expect(result.issues).toEqual([])
  })

  it('acepta CSV', () => {
    const csv = ['id,subjectId,stem,optionA,optionB,correctOptionId,difficulty', 'q-csv-1,cardiologia,Enunciado,uno,dos,a,Media'].join('\n')
    const result = QuestionImporter.import(csv, 'csv', context)
    expect(result.ok).toBe(true)
    expect(result.recordCount).toBe(1)
  })

  it('detecta identificadores duplicados en el archivo', () => {
    const result = QuestionImporter.import(
      json({ schemaVersion: 2, entity: 'questions', records: [validQuestion, validQuestion] }),
      'json',
      context,
    )
    expect(result.ok).toBe(false)
    expect(result.issues.some((entry) => entry.code === 'duplicate-id')).toBe(true)
  })

  it('detecta identificadores ya existentes', () => {
    const result = QuestionImporter.import(json({ schemaVersion: 2, entity: 'questions', records: [validQuestion] }), 'json', {
      ...context,
      existingIds: ['q-imp-1'],
    })
    expect(result.ok).toBe(false)
    expect(result.issues.some((entry) => entry.code === 'duplicate-id')).toBe(true)
  })

  it('detecta campos obligatorios ausentes', () => {
    const incomplete = { ...validQuestion, stem: '' }
    const result = QuestionImporter.import(json({ schemaVersion: 2, entity: 'questions', records: [incomplete] }), 'json', context)
    expect(result.ok).toBe(false)
    expect(result.issues.some((entry) => entry.code === 'invalid-record')).toBe(true)
  })

  it('detecta referencias inexistentes', () => {
    const broken = { ...validQuestion, id: 'q-imp-2', subjectId: 'no-existe' }
    const result = QuestionImporter.import(json({ schemaVersion: 2, entity: 'questions', records: [broken] }), 'json', context)
    expect(result.ok).toBe(false)
    expect(result.issues.some((entry) => entry.code === 'invalid-reference')).toBe(true)
  })

  it('detecta una versión de esquema no soportada', () => {
    const result = QuestionImporter.import(json({ schemaVersion: 99, entity: 'questions', records: [validQuestion] }), 'json', context)
    expect(result.issues.some((entry) => entry.code === 'unsupported-version')).toBe(true)
  })

  it('detecta una opción correcta que no existe', () => {
    const bad = { ...validQuestion, id: 'q-imp-3', correctOptionId: 'zz' }
    const result = QuestionImporter.import(json({ schemaVersion: 2, entity: 'questions', records: [bad] }), 'json', context)
    expect(result.issues.some((entry) => entry.code === 'invalid-correct-option')).toBe(true)
  })

  it('declara los campos obligatorios', () => {
    expect(QuestionImporter.requiredFields).toContain('subjectId')
    expect(QuestionImporter.requiredFields).toContain('correctOptionId')
  })
})

describe('FlashcardImporter', () => {
  it('importa una flashcard válida', () => {
    const card = { id: 'card-imp-1', subjectId: 'cardiologia', topicId: 'topic-cardio-arritmias', front: 'anverso', back: 'reverso' }
    const result = FlashcardImporter.import(json({ schemaVersion: 2, entity: 'flashcards', records: [card] }), 'json', context)
    expect(result.ok).toBe(true)
    expect(result.recordCount).toBe(1)
  })

  it('rechaza una flashcard sin reverso', () => {
    const card = { id: 'card-imp-2', subjectId: 'cardiologia', front: 'anverso' }
    const result = FlashcardImporter.import(json({ schemaVersion: 2, entity: 'flashcards', records: [card] }), 'json', context)
    expect(result.ok).toBe(false)
    expect(result.issues.some((entry) => entry.code === 'invalid-record')).toBe(true)
  })
})

describe('CurriculumImporter', () => {
  it('importa una asignatura nueva', () => {
    const subject = { id: 'nueva-asignatura', label: 'Asignatura nueva', blockId: 'medicina' }
    const result = CurriculumImporter.import(json({ schemaVersion: 2, entity: 'curriculum', records: [subject] }), 'json', context)
    expect(result.ok).toBe(true)
  })

  it('rechaza un bloque desconocido', () => {
    const subject = { id: 'asignatura-rara', label: 'Rara', blockId: 'inexistente' }
    const result = CurriculumImporter.import(json({ schemaVersion: 2, entity: 'curriculum', records: [subject] }), 'json', context)
    expect(result.issues.some((entry) => entry.code === 'invalid-block')).toBe(true)
  })

  it('valida la asignatura de un tema importado', () => {
    const topic = { id: 'topic-nuevo', subjectId: 'no-existe', label: 'Tema nuevo' }
    const result = CurriculumImporter.import(json({ schemaVersion: 2, entity: 'curriculum', records: [topic] }), 'json', context)
    expect(result.issues.some((entry) => entry.code === 'invalid-reference')).toBe(true)
  })
})

describe('ContentImporter', () => {
  it('enruta preguntas y bloques de contenido por su forma', () => {
    const block = {
      id: 'block-imp-1',
      subjectId: 'cardiologia',
      topicId: 'topic-cardio-arritmias',
      kind: 'summary',
      title: 'Bloque importado',
      body: 'cuerpo',
    }
    const result = ContentImporter.import(json({ schemaVersion: 2, entity: 'content', records: [validQuestion, block] }), 'json', context)
    expect(result.ok).toBe(true)
    expect(result.recordCount).toBe(2)
  })

  it('rechaza registros que no encajan en ninguna entidad', () => {
    const result = ContentImporter.import(json({ schemaVersion: 2, entity: 'content', records: [{ id: 'x' }] }), 'json', context)
    expect(result.ok).toBe(false)
  })
})

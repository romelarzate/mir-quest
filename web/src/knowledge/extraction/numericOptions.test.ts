import { describe, expect, it } from 'vitest'
import { classifyNumberedLine, numericOptionRules, parseTextSegments } from './textExtractor'

const nl = String.fromCharCode(10)

function parse(lines: string[]) {
  return parseTextSegments(lines.join(nl))
}

describe('reglas de opciones numericas', () => {
  it('documenta las reglas y no infiere respuestas', () => {
    expect(numericOptionRules.length).toBe(6)
    expect(numericOptionRules.some((rule) => rule.indexOf('no infiere respuestas') !== -1)).toBe(true)
  })
})

describe('Parte B: opciones numericas 1-4', () => {
  it('caso 3 y 4: pregunta numerica con opciones numericas', () => {
    const segments = parse([
      '1. Enunciado de la pregunta.',
      'Cuerpo del enunciado.',
      '1. Primera opcion.',
      '2. Segunda opcion.',
      '3. Tercera opcion.',
      '4. Cuarta opcion.',
    ])
    expect(segments.length).toBe(1)
    expect(segments[0].questionNumber).toBe(1)
    expect(segments[0].options.map((option) => option.label)).toEqual(['1', '2', '3', '4'])
    expect(segments[0].options[0].text).toBe('Primera opcion.')
    expect(segments[0].detectedAnswer).toBeNull()
  })

  it('caso 5 y 6: la siguiente pregunta no se confunde con las opciones', () => {
    const segments = parse([
      '1. Pregunta uno.',
      '1. Opcion uno.',
      '2. Opcion dos.',
      '3. Opcion tres.',
      '4. Opcion cuatro.',
      '2. Pregunta dos.',
      '1. Opcion uno de dos.',
      '2. Opcion dos de dos.',
      '3. Opcion tres de dos.',
      '4. Opcion cuatro de dos.',
    ])
    expect(segments.length).toBe(2)
    expect(segments[0].questionNumber).toBe(1)
    expect(segments[1].questionNumber).toBe(2)
    expect(segments[0].options.length).toBe(4)
    expect(segments[1].options.length).toBe(4)
    expect(segments[1].rawText).toContain('Pregunta dos')
  })

  it('caso 7: las opciones alfabeticas siguen funcionando igual', () => {
    const segments = parse(['1. Uno', 'A) primera', '2. Dos', 'B) segunda'])
    expect(segments.length).toBe(2)
    expect(segments[0].questionNumber).toBe(1)
    expect(segments[0].options.map((option) => option.label)).toEqual(['A'])
    expect(segments[1].questionNumber).toBe(2)
    expect(segments[1].options.map((option) => option.label)).toEqual(['B'])
  })

  it('retiene las continuaciones de línea dentro de cada opción y no añade el pie numerado', () => {
    const segments = parse([
      '1. Pregunta.',
      '1. Primera parte',
      'continuación de la primera opción.',
      '2. Segunda opción.',
      '3. Tercera opción.',
      '4. Cuarta parte',
      'continuación de la cuarta opción.',
      '- 1-',
    ])
    expect(segments).toHaveLength(1)
    expect(segments[0].options.map((option) => option.label)).toEqual(['1', '2', '3', '4'])
    expect(segments[0].options[0].text).toBe('Primera parte continuación de la primera opción.')
    expect(segments[0].options[3].text).toBe('Cuarta parte continuación de la cuarta opción.')
    expect(segments[0].options[3].text).not.toContain('1-')
  })

  it('admite A-E completa sin cambios', () => {
    const segments = parse(['1. Pregunta.', 'A) a', 'B) b', 'C) c', 'D) d', 'E) e'])
    expect(segments[0].options.map((option) => option.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('una opcion numerica nunca abre una pregunta nueva', () => {
    const segments = parse(['1. Pregunta.', '1. a', '2. b', '3. c', '4. d'])
    expect(segments.length).toBe(1)
    expect(segments[0].questionNumber).toBe(1)
  })

  it('caso 8: cabecera y pie no son preguntas', () => {
    const segments = parse(['- 1-', 'FSE MEDICINA 2019/20', '1. Pregunta.', '1. a', '2. b'])
    const withMarker = segments.filter((segment) => segment.hasMarker)
    expect(withMarker.length).toBe(1)
    expect(withMarker[0].questionNumber).toBe(1)
    expect(withMarker[0].rawText).not.toContain('FSE MEDICINA 2019/20')
    expect(segments.some((segment) => segment.rawText.indexOf('FSE MEDICINA 2019/20') !== -1 && segment.questionNumber === null)).toBe(true)
    expect(segments.some((segment) => segment.questionNumber === null)).toBe(true)
  })

  it('caso 9: dos pasadas identicas producen resultado identico', () => {
    const lines = ['1. Pregunta.', '1. a', '2. b', '3. c', '4. d', '2. Siguiente.', '1. a', '2. b', '3. c', '4. d']
    expect(JSON.stringify(parse(lines))).toBe(JSON.stringify(parse(lines)))
  })

  it('clasificador contextual explicito', () => {
    expect(classifyNumberedLine('1. Pregunta', { lastQuestionNumber: null, numericRun: false, numericOptions: 0 }).kind).toBe('question')
    expect(classifyNumberedLine('1. Opcion', { lastQuestionNumber: 1, numericRun: false, numericOptions: 0 }).kind).toBe('option-numeric')
    expect(classifyNumberedLine('2. Opcion', { lastQuestionNumber: 1, numericRun: true, numericOptions: 1 }).kind).toBe('option-numeric')
    expect(classifyNumberedLine('2. Pregunta', { lastQuestionNumber: 1, numericRun: true, numericOptions: 4 }).kind).toBe('question')
    expect(classifyNumberedLine('A) Otra', { lastQuestionNumber: 1, numericRun: true, numericOptions: 1 }).kind).toBe('option-letter')
    expect(classifyNumberedLine('texto suelto', { lastQuestionNumber: 1, numericRun: false, numericOptions: 0 }).kind).toBe('text')
  })

  it('Parte C: no hay inferencia de respuesta', () => {
    const segments = parse(['1. Pregunta sin clave.', '1. a', '2. b', '3. c', '4. d'])
    expect(segments[0].detectedAnswer).toBeNull()
    expect(segments[0].answerKind).toBe('none')
  })
})

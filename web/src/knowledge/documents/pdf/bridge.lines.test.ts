import { describe, expect, it } from 'vitest'
import {
  lineReconstructionRules,
  lineToleranceMax,
  lineToleranceMin,
  reconstructLines,
  segmentsToText,
  spaceGapMin,
} from './bridge'
import type { PdfTextSegment } from './types'

const nl = String.fromCharCode(10)

function seg(x: number | null, y: number | null, text: string, width: number | null = null, height: number | null = 11): PdfTextSegment {
  return { segmentId: 's-' + text.slice(0, 6), pageNumber: 1, text, x, y, width, height, hasEol: false }
}

describe('reglas de reconstruccion', () => {
  it('documenta tolerancias y politica de espacio', () => {
    expect(lineReconstructionRules.length).toBe(9)
    expect(lineToleranceMin).toBe(1.5)
    expect(lineToleranceMax).toBe(4)
    expect(spaceGapMin).toBe(0.75)
  })
})

describe('Parte A: reconstruccion de lineas visuales', () => {
  it('caso 1 y 10: une varios segmentos del mismo Y en una linea y respeta X variables', () => {
    const lines = reconstructLines([
      seg(112.64, 783.6, 'con obesidad'),
      seg(72.36, 783.6, 'Mujer de 40 anos'),
      seg(180.5, 783.6, 'morbida'),
    ])
    expect(lines).toEqual(['Mujer de 40 anos con obesidad morbida'])
  })

  it('caso 2: mantiene el orden vertical de varias lineas', () => {
    const lines = reconstructLines([
      seg(72.36, 766.09, 'segunda linea'),
      seg(72.36, 783.6, 'primera linea'),
      seg(72.36, 754.55, 'tercera linea'),
    ])
    expect(lines).toEqual(['primera linea', 'segunda linea', 'tercera linea'])
  })

  it('acepta pequenas diferencias de Y dentro de la tolerancia y separa por encima', () => {
    const sameLine = reconstructLines([seg(50, 783.6, 'parte A'), seg(120, 785.0, 'parte B')])
    expect(sameLine.length).toBe(1)
    const otherLine = reconstructLines([seg(50, 783.6, 'linea A'), seg(50, 766.0, 'linea B')])
    expect(otherLine.length).toBe(2)
  })

  it('caso 3 y 4: conserva numeracion de pregunta y opciones numericas como texto', () => {
    const lines = reconstructLines([
      seg(42.59, 783.6, '1.'),
      seg(72.36, 783.6, 'Enunciado de la pregunta'),
      seg(75.84, 697.09, '1.'),
      seg(92.76, 697.09, 'Primera opcion.'),
    ])
    expect(lines[0]).toBe('1. Enunciado de la pregunta')
    expect(lines[1]).toBe('1. Primera opcion.')
  })

  it('caso 5 y 6: conserva pregunta, opciones 1-4 y la siguiente pregunta', () => {
    const lines = reconstructLines([
      seg(42.59, 700, '1.'), seg(72.36, 700, 'Pregunta uno'),
      seg(75.84, 690, '1.'), seg(92.76, 690, 'Opcion uno'),
      seg(75.84, 680, '2.'), seg(92.76, 680, 'Opcion dos'),
      seg(42.59, 670, '2.'), seg(72.36, 670, 'Pregunta dos'),
    ])
    expect(lines).toEqual(['1. Pregunta uno', '1. Opcion uno', '2. Opcion dos', '2. Pregunta dos'])
  })

  it('caso 8: conserva cabecera y pie de pagina', () => {
    const lines = reconstructLines([
      seg(50, 810, 'EXAMEN DEMO - CABECERA'),
      seg(50, 780, 'Cuerpo de la pagina'),
      seg(50, 40, 'FSE MEDICINA 2019/20'),
    ])
    expect(lines).toEqual(['EXAMEN DEMO - CABECERA', 'Cuerpo de la pagina', 'FSE MEDICINA 2019/20'])
    expect(lines[lines.length - 1]).toContain('FSE')
  })

  it('caso 9: dos pasadas identicas producen resultado identico', () => {
    const input = [seg(112.64, 783.6, 'con obesidad'), seg(72.36, 783.6, 'Mujer'), seg(72.36, 766.09, 'otra linea')]
    expect(reconstructLines(input)).toEqual(reconstructLines(input))
    expect(segmentsToText(input)).toBe(segmentsToText(input))
  })

  it('caso 11: no se pierde texto', () => {
    const input = [
      seg(50, 800, 'primera'), seg(90, 800, 'linea visual'),
      seg(50, 780, 'segunda'), seg(120, 780, 'linea'),
      seg(null, null, 'sin geometria'),
    ]
    const text = segmentsToText(input)
    for (const segment of input) expect(text).toContain(segment.text)
    expect(text.split(nl).length).toBe(3)
  })

  it('geometria degenerada: todos en el mismo punto vuelven al orden de flujo', () => {
    const lines = reconstructLines([seg(0, 0, 'linea uno'), seg(0, 0, 'linea dos'), seg(0, 0, 'linea tres')])
    expect(lines).toEqual(['linea uno', 'linea dos', 'linea tres'])
  })

  it('un segmento sin geometria nunca se fusiona a ciegas', () => {
    const lines = reconstructLines([seg(50, 800, 'con geometria'), seg(null, null, 'sin geometria')])
    expect(lines.length).toBe(2)
    expect(lines[1]).toBe('sin geometria')
  })

  it('caso 12: dos columnas NO se resuelven en esta iteracion (limitacion declarada)', () => {
    const lines = reconstructLines([seg(50, 800, 'izquierda'), seg(320, 800, 'derecha')])
    expect(lines.length).toBe(1)
    expect(lines[0]).toBe('izquierda derecha')
  })

  it('reconstruye una pagina geometrica de dos columnas en orden columna a columna', () => {
    const columns = [
      seg(50, 800, 'Pregunta 1', 112), seg(315, 800, 'Pregunta 4', 112),
      seg(50, 780, 'Texto izquierda A', 112), seg(315, 780, 'Texto derecha A', 112),
      seg(50, 760, 'Pregunta 2', 112), seg(315, 760, 'Pregunta 5', 112),
      seg(50, 740, 'Texto izquierda B', 112), seg(315, 740, 'Texto derecha B', 112),
    ]
    expect(reconstructLines(columns)).toEqual([
      'Pregunta 1', 'Texto izquierda A', 'Pregunta 2', 'Texto izquierda B',
      'Pregunta 4', 'Texto derecha A', 'Pregunta 5', 'Texto derecha B',
    ])
  })

  it('mantiene texto centrado en el gutter aislado para que no se mezcle con el cuerpo de columna', () => {
    const columns = [
      seg(50, 800, 'Izquierda 1', 230), seg(315, 800, 'Derecha 1', 100),
      seg(50, 780, 'Izquierda 2', 230), seg(315, 780, 'Derecha 2', 100),
      seg(50, 760, 'Izquierda 3', 230), seg(315, 760, 'Derecha 3', 100),
      seg(50, 740, 'Izquierda 4', 230), seg(315, 740, 'Derecha 4', 100),
      seg(304, 720, 'FSE MEDICINA 2019/20', 317),
    ]
    expect(reconstructLines(columns)).toEqual([
      'FSE MEDICINA 2019/20',
      'Izquierda 1', 'Izquierda 2', 'Izquierda 3', 'Izquierda 4',
      'Derecha 1', 'Derecha 2', 'Derecha 3', 'Derecha 4',
    ])
  })
})

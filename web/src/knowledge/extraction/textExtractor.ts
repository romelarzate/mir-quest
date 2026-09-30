import type { ExtractedOption, PdfPage } from './types'

export const newline = String.fromCharCode(10)
export const replacementCharacter = String.fromCharCode(0xfffd)

export type AnswerDetectionKind = 'explicit' | 'parenthetical' | 'bare' | 'none'

export type ParsedSegment = {
  questionNumber: number | null
  hasMarker: boolean
  options: ExtractedOption[]
  lines: string[]
  rawText: string
  detectedAnswer: string | null
  answerKind: AnswerDetectionKind
  endsCleanly: boolean
  mixedMarkers: boolean
  hasTableMarkers: boolean
  imageDependent: boolean
  interleavedOptions: boolean
  anomalousCharacterRatio: number
}

const questionPatterns = [
  new RegExp('^(\\d{1,3})\\s*[.)\\-]\\s+\\S'),
  new RegExp('^pregunta\\s+(\\d{1,3})\\b', 'i'),
]

const optionPattern = new RegExp('^([A-Ea-e])\\s*[.)\\-]\\s+\\S')
const explicitAnswerPatterns = [
  new RegExp('respuesta\\s+correcta\\s*:?\\s*([A-Ea-e])\\b', 'i'),
  new RegExp('correcta\\s*:\\s*([A-Ea-e])\\b', 'i'),
]
const bareAnswerPattern = new RegExp('respuesta\\s*:?\\s*([A-Ea-e])\\b', 'i')
const parentheticalAnswerPattern = new RegExp('\\(\\s*([A-Ea-e])\\s*\\)\\s*$')

export function detectQuestionMarker(line: string): number | null {
  const trimmed = line.trim()
  if (trimmed.length === 0) return null
  for (const pattern of questionPatterns) {
    const match = pattern.exec(trimmed)
    if (match) {
      const parsed = Number(match[1])
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
  }
  return null
}

export function detectOptionLabel(line: string): string | null {
  const match = optionPattern.exec(line.trim())
  return match ? match[1].toUpperCase() : null
}

export function detectAnswer(text: string): { label: string | null; kind: AnswerDetectionKind } {
  for (const pattern of explicitAnswerPatterns) {
    const match = pattern.exec(text)
    if (match) return { label: match[1].toUpperCase(), kind: 'explicit' }
  }
  const bare = bareAnswerPattern.exec(text)
  if (bare) return { label: bare[1].toUpperCase(), kind: 'bare' }
  const parenthetical = parentheticalAnswerPattern.exec(text.trim())
  if (parenthetical) return { label: parenthetical[1].toUpperCase(), kind: 'parenthetical' }
  return { label: null, kind: 'none' }
}

export function anomalousCharacterRatio(text: string): number {
  if (text.length === 0) return 0
  let anomalous = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    const isControl = code < 0x20 && char !== newline && char !== String.fromCharCode(9)
    const isReplacement = char === replacementCharacter
    const isPrivateUse = code >= 0xe000 && code <= 0xf8ff
    if (isControl || isReplacement || isPrivateUse) anomalous += 1
  }
  return Math.round((anomalous / text.length) * 10000) / 10000
}

export function hasTableMarkers(text: string): boolean {
  const lines = text.split(newline)
  const pipeLines = lines.filter((line) => (line.match(/\|/g) ?? []).length >= 2).length
  return pipeLines >= 2
}

export function optionsInterleaved(labels: string[]): boolean {
  let highest = ''
  const seen = new Set<string>()
  for (const label of labels) {
    if (label > highest) highest = label
    else if (label < highest && seen.has(label)) return true
    seen.add(label)
  }
  return false
}

export function endsCleanly(text: string): boolean {
  const lines = text.split(newline).map((line) => line.trim()).filter((line) => line.length > 0)
  if (lines.length === 0) return false
  const last = lines[lines.length - 1]
  if (detectOptionLabel(last) !== null) return true
  if (/[.?!:]$/.test(last)) return true
  if (detectAnswer(last).kind !== 'none') return true
  return false
}

export const numericOptionRules: string[] = [
  'Las opciones numericas (1-4) se aceptan ademas de las alfabeticas (A-E).',
  'La ambiguedad pregunta/opcion se resuelve por contexto, no por geometria: el parser solo ve texto.',
  'Una linea numerada abre pregunta si aun no hay pregunta, si continua la numeracion de pregunta o si supera la ultima.',
  'Una linea numerada es opcion si inicia una ronda numerica con 1 o si continua la ronda con C+1 y aun quedan menos de 4 opciones.',
  'Una opcion numerica nunca se interpreta como nueva pregunta.',
  'Este clasificador no infiere respuestas: no toca detectAnswer.',
]

const numericLinePattern = new RegExp('^(\\d{1,3})\\s*[.)\\-]\\s+')

export type LineClassification =
  | { kind: 'question'; number: number }
  | { kind: 'option-numeric'; number: number }
  | { kind: 'option-letter'; label: string }
  | { kind: 'text' }

export type ClassifierState = {
  lastQuestionNumber: number | null
  numericRun: boolean
  numericOptions: number
}

export function classifyNumberedLine(line: string, state: ClassifierState): LineClassification {
  const trimmed = line.trim()
  if (trimmed.length === 0) return { kind: 'text' }
  const letter = detectOptionLabel(trimmed)
  if (letter !== null) return { kind: 'option-letter', label: letter }
  const marker = detectQuestionMarker(trimmed)
  if (marker === null) return { kind: 'text' }
  if (state.lastQuestionNumber === null) return { kind: 'question', number: marker }
  if (state.numericRun && marker === state.numericOptions + 1 && marker <= 9 && state.numericOptions < 4) {
    return { kind: 'option-numeric', number: marker }
  }
  if (!state.numericRun && marker === 1 && state.numericOptions === 0) return { kind: 'option-numeric', number: marker }
  if (marker === state.lastQuestionNumber + 1) return { kind: 'question', number: marker }
  if (marker > state.lastQuestionNumber) return { kind: 'question', number: marker }
  return { kind: 'text' }
}

type LineGroup = {
  questionNumber: number | null
  hasMarker: boolean
  lines: string[]
  options: ExtractedOption[]
  currentOptionIndex: number | null
}

function isPageNumberDecoration(line: string): boolean {
  const trimmed = line.trim()
  return /^-?\s*\d+\s*-?$/.test(trimmed) || /^-+$/.test(trimmed)
}

export function parseTextSegments(text: string): ParsedSegment[] {
  const lines = text.split(newline)
  const groups: LineGroup[] = []
  let current: LineGroup | null = null
  const state: ClassifierState = { lastQuestionNumber: null, numericRun: false, numericOptions: 0 }

  function closeCurrent() {
    if (current) groups.push(current)
  }

  for (const line of lines) {
    const classification = classifyNumberedLine(line, state)
    if (classification.kind === 'question') {
      closeCurrent()
      current = { questionNumber: classification.number, hasMarker: true, lines: [line], options: [], currentOptionIndex: null }
      state.lastQuestionNumber = classification.number
      state.numericRun = false
      state.numericOptions = 0
      continue
    }
    if (classification.kind === 'option-numeric') {
      if (current === null) current = { questionNumber: null, hasMarker: false, lines: [], options: [], currentOptionIndex: null }
      current.lines.push(line)
      current.options.push({ label: String(classification.number), text: line.trim().replace(numericLinePattern, '').trim() })
      current.currentOptionIndex = current.options.length - 1
      state.numericRun = true
      state.numericOptions += 1
      continue
    }
    if (classification.kind === 'option-letter') {
      if (current === null) current = { questionNumber: null, hasMarker: false, lines: [], options: [], currentOptionIndex: null }
      current.lines.push(line)
      current.options.push({ label: classification.label, text: line.trim().replace(optionPattern, '').trim() })
      current.currentOptionIndex = current.options.length - 1
      continue
    }
    if (current === null) {
      current = { questionNumber: null, hasMarker: false, lines: [line], options: [], currentOptionIndex: null }
      continue
    }
    current.lines.push(line)
    if (current.currentOptionIndex !== null && !isPageNumberDecoration(line)) {
      const option = current.options[current.currentOptionIndex]
      if (option !== undefined && line.trim().length > 0) option.text = (option.text + ' ' + line.trim()).trim()
    }
  }
  closeCurrent()

  return groups.map((group) => {
    const rawText = group.lines.join(newline).trim()
    const labels = group.options.map((option) => option.label)
    const answer = detectAnswer(rawText)
    const markersInside = group.hasMarker ? 1 : 0
    return {
      questionNumber: group.questionNumber,
      hasMarker: group.hasMarker,
      options: group.options,
      lines: group.lines,
      rawText,
      detectedAnswer: answer.label,
      answerKind: answer.kind,
      endsCleanly: endsCleanly(rawText),
      mixedMarkers: markersInside > 1,
      hasTableMarkers: hasTableMarkers(rawText),
      imageDependent: /\[figura\]|\[imagen\]/i.test(rawText),
      interleavedOptions: optionsInterleaved(labels),
      anomalousCharacterRatio: anomalousCharacterRatio(rawText),
    }
  })
}
export function parsePage(page: PdfPage): ParsedSegment[] {
  const streams =
    page.columnTexts && page.columnTexts.length > 0 ? page.columnTexts : [page.text]
  const segments: ParsedSegment[] = []
  for (const stream of streams) segments.push(...parseTextSegments(stream))
  return segments
}

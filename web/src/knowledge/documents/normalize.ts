import type { NormalizationResult } from './types'

export const markdownNormalizerVersion = 'normalizer-1'

const newline = String.fromCharCode(10)
const carriage = String.fromCharCode(13)

export function normalizeDocumentText(input: string): NormalizationResult {
  const changes: string[] = []
  let text = input

  if (text.indexOf(carriage + newline) !== -1) {
    text = text.split(carriage + newline).join(newline)
    changes.push('CRLF convertido a LF')
  }
  if (text.indexOf(carriage) !== -1) {
    text = text.split(carriage).join(newline)
    changes.push('CR convertido a LF')
  }

  const lines = text.split(newline)
  const trimmed = lines.map((line) => line.replace(/[ \t]+$/, ''))
  if (trimmed.some((line, index) => line !== lines[index])) changes.push('espacios finales eliminados')

  const collapsed: string[] = []
  let blankRun = 0
  for (const line of trimmed) {
    if (line.trim().length === 0) {
      blankRun += 1
      if (blankRun > 1) continue
      collapsed.push('')
      continue
    }
    blankRun = 0
    collapsed.push(line)
  }
  if (collapsed.length !== trimmed.length) changes.push('lineas en blanco repetidas colapsadas')

  let output = collapsed.join(newline)
  if (output.endsWith(newline)) output = output.replace(/\n+$/, '') + newline
  else output = output + newline

  return { text: output, changes, changed: changes.length > 0 }
}

export function normalizeForComparison(text: string): string {
  return normalizeDocumentText(text)
    .text.split(newline)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(newline)
}

export function countLines(text: string): number {
  return text.split(newline).length
}

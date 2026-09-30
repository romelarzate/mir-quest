import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const newline = String.fromCharCode(10)
const srcRoot = join(process.cwd(), 'src')

function listFiles(directory: string, skipTests: boolean): string[] {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const isTest = entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')
    if (skipTests && isTest) continue
    const full = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(full, skipTests))
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(full)
  }
  return files
}

const forbiddenInPredict = [
  'from ' + String.fromCharCode(39) + 'react' + String.fromCharCode(39),
  'from ' + String.fromCharCode(39) + 'react-dom' + String.fromCharCode(39),
  String.fromCharCode(39) + '../repositories',
  String.fromCharCode(39) + '../storage',
  String.fromCharCode(39) + '../domain/srs',
  String.fromCharCode(39) + '../domain/selectors',
  String.fromCharCode(39) + 'better-sqlite3',
  String.fromCharCode(39) + 'sqlite3',
]

describe('frontera arquitectónica', () => {
  it('los contratos de Predict no dependen de React ni del estado de estudio', () => {
    const files = listFiles(join(srcRoot, 'predict'), true)
    expect(files.length).toBeGreaterThan(10)
    const offenders: string[] = []
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(newline)
      for (const line of lines) {
        if (line.indexOf('import') === -1 && line.indexOf('require(') === -1) continue
        for (const pattern of forbiddenInPredict) {
          if (line.indexOf(pattern) !== -1) offenders.push(file + ' :: ' + line.trim())
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('el dominio de estudio no importa los contratos de Predict', () => {
    const files = listFiles(join(srcRoot, 'domain'), true)
    const offenders: string[] = []
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(newline)
      for (const line of lines) {
        if (line.indexOf('import') === -1) continue
        if (line.indexOf(String.fromCharCode(39) + '../predict') !== -1) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  it('no existe una segunda aplicación ni acceso directo a base de datos', () => {
    const predictFiles = listFiles(join(srcRoot, 'predict'), true)
    const contents = predictFiles.map((file) => readFileSync(file, 'utf8'))
    expect(contents.some((content) => content.indexOf('new Database(') !== -1)).toBe(false)
    expect(contents.some((content) => content.indexOf('createConnection(') !== -1)).toBe(false)
  })
})

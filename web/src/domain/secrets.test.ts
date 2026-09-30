import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const webRoot = process.cwd()
const repoRoot = join(webRoot, '..')
const keyPrefix = 'AI' + 'za'

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(directory, entry.name)
    const isTest = entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')
    if (entry.isDirectory()) files.push(...listSourceFiles(full))
    else if (!isTest && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) files.push(full)
  }
  return files
}

function looksLikeApiKey(line: string): boolean {
  const index = line.indexOf(keyPrefix)
  if (index === -1) return false
  const tail = line.slice(index + keyPrefix.length, index + keyPrefix.length + 20)
  if (tail.length < 20) return false
  const allowed = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'.split(''))
  return tail.split('').every((char) => allowed.has(char))
}

function hasAssignedValue(line: string, name: string): boolean {
  const index = line.indexOf(name)
  if (index === -1) return false
  const rest = line.slice(index + name.length)
  const equals = rest.indexOf('=')
  if (equals === -1) return false
  return rest.slice(equals + 1).trim().length >= 8
}

describe('seguridad de credenciales', () => {
  it('ningún archivo fuente contiene una clave con formato de API', () => {
    const offenders: string[] = []
    for (const file of listSourceFiles(join(webRoot, 'src'))) {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const line of lines) {
        if (looksLikeApiKey(line)) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  it('ningún archivo fuente asigna un valor a una variable de clave', () => {
    const names = ['GEMINI' + '_API_KEY', 'GOOGLE' + '_API_KEY', 'FIREBASE' + '_API_KEY']
    const offenders: string[] = []
    for (const file of listSourceFiles(join(webRoot, 'src'))) {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const line of lines) {
        for (const name of names) {
          if (hasAssignedValue(line, name)) offenders.push(file + ':' + name)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('existe .env.example sin valores reales', () => {
    const candidates = [join(webRoot, '.env.example'), join(repoRoot, '.env.example')]
    expect(candidates.some((file) => existsSync(file))).toBe(true)
    for (const file of candidates) {
      if (!existsSync(file)) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (line.length === 0 || line.startsWith('#')) continue
        expect(line.endsWith('='), 'variable sin valor vacío en ' + file + ': ' + line).toBe(true)
      }
    }
  })

  it('el repositorio ignora los archivos .env', () => {
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
    expect(gitignore).toContain('.env')
    expect(gitignore).toContain('node_modules')
    expect(gitignore).toContain('dist')
  })

  it('el código no guarda credenciales en localStorage', () => {
    const offenders: string[] = []
    for (const file of listSourceFiles(join(webRoot, 'src'))) {
      const content = readFileSync(file, 'utf8')
      const lowered = content.toLowerCase()
      if (lowered.includes('localstorage.setitem') && lowered.includes('apikey')) offenders.push(file)
      if (lowered.includes('localstorage.setitem') && lowered.includes('api_key')) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})

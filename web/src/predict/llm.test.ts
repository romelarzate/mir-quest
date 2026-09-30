import { describe, expect, it } from 'vitest'
import {
  allLLMCapabilities,
  deepseekProvider,
  findProvider,
  geminiProvider,
  llmProviders,
  llmRules,
  llmStubMessage,
  ollamaProvider,
  openaiProvider,
  providerSupports,
} from './llm'

describe('proveedores LLM', () => {
  it('declara los cuatro adaptadores previstos como stub', () => {
    expect(llmProviders.map((provider) => provider.id)).toEqual(['ollama', 'gemini', 'deepseek', 'openai'])
    expect(llmProviders.every((provider) => provider.status === 'stub')).toBe(true)
  })

  it('declara capacidades distintas por proveedor', () => {
    expect(allLLMCapabilities.length).toBe(5)
    expect(ollamaProvider.capabilities).toEqual(['classify', 'extract', 'summarize'])
    expect(geminiProvider.capabilities.length).toBe(5)
    expect(openaiProvider.capabilities.length).toBe(5)
    expect(deepseekProvider.capabilities.length).toBe(5)
  })

  it('consulta proveedores y capacidades', () => {
    expect(findProvider('gemini')?.id).toBe('gemini')
    expect(findProvider('inexistente')).toBeUndefined()
    expect(providerSupports('ollama', 'summarize')).toBe(true)
    expect(providerSupports('ollama', 'generateQuestion')).toBe(false)
    expect(providerSupports('inexistente', 'classify')).toBe(false)
  })
})

describe('resultados stub', () => {
  it('ninguna capacidad produce salida', async () => {
    const summary = await geminiProvider.summarize({ capability: 'summarize', input: 'texto' })
    expect(summary.status).toBe('not-implemented')
    expect(summary.output).toBeNull()
    expect(summary.warnings).toContain(llmStubMessage)

    const classified = await geminiProvider.classify({ capability: 'classify', input: 'texto' })
    expect(classified.output).toBeNull()
    const extracted = await geminiProvider.extract({ capability: 'extract', input: 'texto' })
    expect(extracted.output).toBeNull()
    const question = await geminiProvider.generateQuestion({ capability: 'generateQuestion', input: 'texto' })
    expect(question.output).toBeNull()
    const flashcard = await geminiProvider.generateFlashcard({ capability: 'generateFlashcard', input: 'texto' })
    expect(flashcard.output).toBeNull()
  })

  it('identifica el proveedor en la respuesta', async () => {
    const result = await openaiProvider.summarize({ capability: 'summarize', input: 'x' })
    expect(result.providerId).toBe('openai')
    expect(result.capability).toBe('summarize')
  })

  it('documenta que no hay claves ni red', () => {
    expect(llmRules.length).toBe(4)
    expect(llmRules.some((rule) => rule.indexOf('claves') !== -1)).toBe(true)
    expect(llmRules.some((rule) => rule.indexOf('API') !== -1)).toBe(true)
  })
})

export type LLMCapability = 'classify' | 'extract' | 'summarize' | 'generateQuestion' | 'generateFlashcard'

export const allLLMCapabilities: LLMCapability[] = [
  'classify',
  'extract',
  'summarize',
  'generateQuestion',
  'generateFlashcard',
]

export type LLMStatus = 'stub'

export type LLMRequest = {
  capability: LLMCapability
  input: string
  context?: string[]
  modelHint?: string | null
}

export type LLMResult = {
  providerId: string
  capability: LLMCapability
  status: 'not-implemented'
  output: null
  warnings: string[]
}

export type LLMProvider = {
  id: string
  label: string
  status: LLMStatus
  capabilities: LLMCapability[]
  classify: (request: LLMRequest) => Promise<LLMResult>
  extract: (request: LLMRequest) => Promise<LLMResult>
  summarize: (request: LLMRequest) => Promise<LLMResult>
  generateQuestion: (request: LLMRequest) => Promise<LLMResult>
  generateFlashcard: (request: LLMRequest) => Promise<LLMResult>
}

export const llmStubMessage = 'Adaptador stub: sin SDK, sin claves y sin conexión de red.'

function stubResult(providerId: string, request: LLMRequest): LLMResult {
  return {
    providerId,
    capability: request.capability,
    status: 'not-implemented',
    output: null,
    warnings: [llmStubMessage, 'Proveedor ' + providerId + ' no conectado.'],
  }
}

export function createStubProvider(id: string, label: string, capabilities: LLMCapability[]): LLMProvider {
  return {
    id,
    label,
    status: 'stub',
    capabilities,
    classify: async (request) => stubResult(id, request),
    extract: async (request) => stubResult(id, request),
    summarize: async (request) => stubResult(id, request),
    generateQuestion: async (request) => stubResult(id, request),
    generateFlashcard: async (request) => stubResult(id, request),
  }
}

export const ollamaProvider = createStubProvider('ollama', 'Ollama (stub)', ['classify', 'extract', 'summarize'])
export const geminiProvider = createStubProvider('gemini', 'Gemini (stub)', allLLMCapabilities)
export const deepseekProvider = createStubProvider('deepseek', 'DeepSeek (stub)', allLLMCapabilities)
export const openaiProvider = createStubProvider('openai', 'OpenAI (stub)', allLLMCapabilities)

export const llmProviders: LLMProvider[] = [ollamaProvider, geminiProvider, deepseekProvider, openaiProvider]

export function findProvider(id: string): LLMProvider | undefined {
  return llmProviders.find((provider) => provider.id === id)
}

export function providerSupports(id: string, capability: LLMCapability): boolean {
  const provider = findProvider(id)
  return provider ? provider.capabilities.includes(capability) : false
}

export const llmRules: string[] = [
  'Solo existen interfaces y adaptadores stub: no se conecta ninguna API.',
  'No se usan claves ni variables de entorno en esta fase.',
  'Ningún proveedor se importa desde la interfaz de React.',
  'La generación de contenido clínico permanece desactivada.',
]

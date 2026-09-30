import type { PdfAdapterError, PdfAdapterErrorCode } from './types'

export const pdfErrorMessages: Record<PdfAdapterErrorCode, string> = {
  'file-not-found': 'El archivo no existe o no se puede leer.',
  'not-a-pdf': 'El archivo no empieza por la firma PDF.',
  'corrupted-pdf': 'El PDF esta danado o no se puede interpretar.',
  'encrypted-pdf': 'El PDF esta protegido con contrasena.',
  'unsupported-pdf': 'El PDF usa una estructura no soportada.',
  'too-large': 'El archivo supera el limite configurado.',
  'empty-document': 'El PDF no contiene paginas.',
  'library-unavailable': 'La libreria de PDF no esta disponible.',
  unknown: 'Error desconocido al leer el PDF.',
}

export function createPdfError(code: PdfAdapterErrorCode, detail?: string): PdfAdapterError {
  const base = pdfErrorMessages[code]
  return {
    code,
    message: detail === undefined || detail.length === 0 ? base : base + ' Detalle: ' + detail,
    recoverable: code === 'file-not-found' || code === 'too-large' || code === 'encrypted-pdf',
  }
}

export class PdfAdapterFailure extends Error {
  readonly code: PdfAdapterErrorCode
  constructor(code: PdfAdapterErrorCode, detail?: string) {
    const error = createPdfError(code, detail)
    super(error.message)
    this.name = 'PdfAdapterFailure'
    this.code = code
  }
}

export function errorFromUnknown(error: unknown): PdfAdapterError {
  if (error instanceof PdfAdapterFailure) return createPdfError(error.code)
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : ''
  const message = error instanceof Error ? error.message : String(error)
  if (name === 'PasswordException') return createPdfError('encrypted-pdf')
  if (name === 'InvalidPDFException') return createPdfError('corrupted-pdf')
  if (name === 'MissingPDFException') return createPdfError('file-not-found')
  if (message.toLowerCase().indexOf('cancelled') !== -1) return createPdfError('unsupported-pdf', message)
  return createPdfError('unknown', message.slice(0, 160))
}

export const securityRules: string[] = [
  'Un archivo que no empieza por %PDF- se rechaza sin intentar interpretarlo.',
  'Un PDF corrupto produce un error tipado, nunca una excepcion sin capturar.',
  'Un PDF con contrasena no se fuerza: se declara encrypted-pdf.',
  'Un tamano por encima del limite se rechaza antes de leerlo entero.',
  'Los limites son contratos de esta fase, no limites de produccion.',
]

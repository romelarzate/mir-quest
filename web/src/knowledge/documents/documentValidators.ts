import type { DocumentValidationCode, DocumentValidationIssue, DocumentValidationReport, DocumentValidationSeverity, CanonicalDocument, MarkdownBlock } from './types'
import { missingPageMapEntries } from './pageMap'

export const documentValidatorCatalog: Array<{
  code: DocumentValidationCode
  description: string
  severity: DocumentValidationSeverity
}> = [
  { code: 'empty-document', description: 'documento sin contenido util', severity: 'error' },
  { code: 'missing-page-map', description: 'bloque sin entrada en el page map', severity: 'error' },
  { code: 'duplicated-block', description: 'bloque repetido', severity: 'warning' },
  { code: 'broken-heading', description: 'encabezado roto o salto de nivel', severity: 'warning' },
  { code: 'broken-option-sequence', description: 'secuencia de opciones rota', severity: 'warning' },
  { code: 'suspicious-table', description: 'tabla con filas inconsistentes', severity: 'warning' },
  { code: 'orphan-text', description: 'texto suelto sin anclaje', severity: 'warning' },
  { code: 'image-dependent-content', description: 'contenido que depende de imagen sin leyenda', severity: 'warning' },
  { code: 'suspicious-page-transition', description: 'transicion de pagina anomala', severity: 'warning' },
]

export const documentValidationRules: string[] = [
  'La validacion documental es estructural: no afirma nada clinico.',
  'Una pregunta clinicamente dudosa se valida en la capa de extraccion, no aqui.',
  'Una anomalia documental nunca se convierte en una afirmacion clinica.',
  'Los avisos no bloquean: informan y quedan registrados con su bloque y pagina.',
]

function issue(
  code: DocumentValidationCode,
  severity: DocumentValidationSeverity,
  message: string,
  blockId: string | null,
  page: number | null,
): DocumentValidationIssue {
  return { code, severity, message, blockId, page }
}

export function validateCanonicalDocument(document: CanonicalDocument): DocumentValidationReport {
  const issues: DocumentValidationIssue[] = []
  const contentBlocks = document.blocks.filter((block) => block.kind !== 'page-break' && block.text.trim().length > 0)

  if (contentBlocks.length === 0) {
    issues.push(issue('empty-document', 'error', 'El documento no tiene contenido util.', null, null))
  }

  for (const blockId of missingPageMapEntries(document.pageMap, document.blocks)) {
    issues.push(issue('missing-page-map', 'error', 'Bloque sin entrada en el page map.', blockId, null))
  }

  const seen = new Map<string, MarkdownBlock>()
  for (const block of document.blocks) {
    const key = [block.kind, block.text.trim(), String(block.page)].join('|')
    const previous = seen.get(key)
    if (previous && block.text.trim().length > 0) {
      issues.push(issue('duplicated-block', 'warning', 'Bloque repetido en la misma pagina.', block.blockId, block.page))
      continue
    }
    seen.set(key, block)
  }

  let previousHeadingLevel: number | null = null
  for (const block of document.blocks) {
    if (block.kind !== 'heading' && block.kind !== 'title') continue
    const level = block.kind === 'title' ? 1 : block.level === null ? 2 : block.level
    if (block.text.trim().length === 0) {
      issues.push(issue('broken-heading', 'warning', 'Encabezado sin texto.', block.blockId, block.page))
    }
    if (previousHeadingLevel !== null && level > previousHeadingLevel + 1) {
      issues.push(issue('broken-heading', 'warning', 'Salto de nivel de encabezado.', block.blockId, block.page))
    }
    previousHeadingLevel = level
  }

  const optionsByPage = new Map<number, MarkdownBlock[]>()
  for (const block of document.blocks) {
    if (block.kind !== 'option') continue
    const list = optionsByPage.get(block.page) ?? []
    list.push(block)
    optionsByPage.set(block.page, list)
  }
  for (const entry of optionsByPage.values()) {
    for (let index = 1; index < entry.length; index += 1) {
      const previous = entry[index - 1].text.trim().charAt(0).toUpperCase()
      const current = entry[index].text.trim().charAt(0).toUpperCase()
      if (previous.length === 0 || current.length === 0) continue
      if (current.charCodeAt(0) !== previous.charCodeAt(0) + 1) {
        issues.push(
          issue('broken-option-sequence', 'warning', 'Secuencia de opciones rota: ' + previous + ' -> ' + current, entry[index].blockId, entry[index].page),
        )
      }
    }
  }

  const tableRows = document.blocks.filter((block) => block.kind === 'table-row')
  for (let index = 1; index < tableRows.length; index += 1) {
    const previousCells = tableRows[index - 1].text.split('|').length
    const currentCells = tableRows[index].text.split('|').length
    if (previousCells !== currentCells) {
      issues.push(issue('suspicious-table', 'warning', 'Filas de tabla con distinto numero de columnas.', tableRows[index].blockId, tableRows[index].page))
    }
  }

  const firstAnchor = document.blocks.findIndex((block) => block.kind === 'title' || block.kind === 'heading')
  if (firstAnchor > 0) {
    for (const block of document.blocks.slice(0, firstAnchor)) {
      if (block.kind !== 'paragraph' && block.kind !== 'list-item') continue
      issues.push(issue('orphan-text', 'warning', 'Texto suelto antes del primer encabezado.', block.blockId, block.page))
    }
  }

  for (const block of document.blocks) {
    if (block.kind !== 'figure') continue
    const cleaned = block.text.replace(/\[/g, '').replace(/\]/g, '').trim().toLowerCase()
    const bareMarker = cleaned === 'figura' || cleaned === 'imagen'
    issues.push(
      issue(
        'image-dependent-content',
        'warning',
        bareMarker
          ? 'Figura sin leyenda ni texto alternativo.'
          : 'El contenido remite a una imagen que el Skill no puede leer.',
        block.blockId,
        block.page,
      ),
    )
  }

  for (let index = 1; index < document.blocks.length; index += 1) {
    const previous = document.blocks[index - 1].page
    const current = document.blocks[index].page
    if (current < previous || current > previous + 1) {
      issues.push(
        issue('suspicious-page-transition', 'warning', 'Salto de pagina ' + String(previous) + ' -> ' + String(current), document.blocks[index].blockId, current),
      )
    }
  }

  const errorCount = issues.filter((entry) => entry.severity === 'error').length
  return {
    ok: errorCount === 0,
    errorCount,
    warningCount: issues.length - errorCount,
    issues,
  }
}

export function summarizeDocumentIssues(report: DocumentValidationReport): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const entry of report.issues) summary[entry.code] = (summary[entry.code] ?? 0) + 1
  return summary
}

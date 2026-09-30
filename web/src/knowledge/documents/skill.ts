export const skillIdentifier = 'mir-document-skill'
export const skillVersion = '1.0.0'
export const skillContractVersion = 'documents-1'

export const skillPurpose =
  'Convertir material documental en artefactos y Markdown canonico auditable, preservando procedencia, sin interpretar contenido clinico.'

export const skillCan: string[] = [
  'leer documentos y fuentes de texto',
  'producir artefactos versionados',
  'producir Markdown canonico',
  'preservar provenance y page map',
  'validar estructura documental',
  'producir extraction results a traves del extractor existente',
]

export const skillCannot: string[] = [
  'modificar SRS',
  'modificar progreso del usuario',
  'modificar StudyState',
  'generar predicciones MIR',
  'decidir probabilidades',
  'escribir directamente sobre entidades de Study',
  'llamar APIs externas sin una fase posterior autorizada',
]

export const forbiddenActions: string[] = [
  'modify-srs',
  'modify-user-progress',
  'modify-study-state',
  'produce-predictions',
  'decide-probabilities',
  'write-study-entities',
  'call-external-api',
]

export const skillConsumers: Record<string, string> = {
  knowledgeCore: 'Consume artefactos y resultados de extraccion.',
  predict: 'Consume el Knowledge Core; nunca los artefactos crudos sin validar.',
  studyPlatform: 'Consume sus propias entidades; el Skill no las toca.',
}

export function assertSkillResponsibility(action: string): { allowed: boolean; reason: string } {
  if (forbiddenActions.includes(action)) {
    return { allowed: false, reason: 'Accion prohibida para el MIR Document Skill: ' + action }
  }
  return { allowed: true, reason: 'Accion dentro del alcance documental.' }
}

export function describeSkill(): string {
  return skillIdentifier + ' v' + skillVersion + ' · contrato ' + skillContractVersion
}

export const skillBoundaries: string[] = [
  'El Skill no sustituye al PdfExtractionService: lo alimenta con Markdown.',
  'El Skill no toca el Study Domain ni el SRS.',
  'El Skill no produce predicciones ni probabilidades.',
  'Predict y Study consumen por separado; el Skill es solo documental.',
]

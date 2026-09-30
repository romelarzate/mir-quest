import type { SimulationManifestDTO, SimulationRequestDTO, SimulationResultDTO } from './dto'
import { hashToUint32, mulberry32, primaryHashAlgorithm, sha256Hex, stableHashInput } from './hashing'

export type CandidateQuestion = {
  questionId: string
  year: number | null
  validationStatus: 'accepted' | 'quarantined' | 'rejected'
  subjectId: string | null
  topicId: string | null
  clinicalDomainIds: string[]
}

/**
 * Solo las preguntas aceptadas pueden entrar en features, predicciones o
 * simulacros. Las quarantined esperan aprobación explícita.
 */
export function isEligibleCandidate(candidate: CandidateQuestion): boolean {
  return candidate.validationStatus === 'accepted'
}

export function filterCandidates(
  candidates: CandidateQuestion[],
  request: Pick<SimulationRequestDTO, 'subjectIds' | 'topicIds' | 'clinicalDomainIds'>,
): CandidateQuestion[] {
  return candidates
    .filter(isEligibleCandidate)
    .filter((candidate) => (request.subjectIds.length === 0 ? true : candidate.subjectId !== null && request.subjectIds.includes(candidate.subjectId)))
    .filter((candidate) => (request.topicIds.length === 0 ? true : candidate.topicId !== null && request.topicIds.includes(candidate.topicId)))
    .filter((candidate) =>
      request.clinicalDomainIds.length === 0
        ? true
        : candidate.clinicalDomainIds.some((domainId) => request.clinicalDomainIds.includes(domainId)),
    )
    .slice()
    .sort((a, b) => a.questionId.localeCompare(b.questionId))
}

export function seedMaterial(request: SimulationRequestDTO): string {
  return stableHashInput({
    seed: request.seed,
    questionCount: request.questionCount,
    subjectIds: request.subjectIds.slice().sort(),
    topicIds: request.topicIds.slice().sort(),
    clinicalDomainIds: request.clinicalDomainIds.slice().sort(),
    versions: request.versions,
  })
}

export function seededShuffle<T>(items: T[], random: () => number): T[] {
  const output = items.slice()
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const temporary = output[index]
    output[index] = output[swapIndex]
    output[swapIndex] = temporary
  }
  return output
}

export async function computeManifestHash(input: {
  seed: string
  versions: SimulationRequestDTO['versions']
  questionIds: string[]
}): Promise<string> {
  return sha256Hex(
    stableHashInput({
      seed: input.seed,
      versions: input.versions,
      questionIds: input.questionIds,
      algorithm: primaryHashAlgorithm,
    }),
  )
}

/**
 * Planifica una simulación de forma reproducible:
 * misma semilla + mismo dataset + misma configuración = mismo conjunto ordenado.
 */
export async function planSimulation(
  request: SimulationRequestDTO,
  candidates: CandidateQuestion[],
): Promise<SimulationResultDTO> {
  const eligible = filterCandidates(candidates, request)
  const seedHash = await sha256Hex(seedMaterial(request))
  const random = mulberry32(hashToUint32(seedHash))
  const ordered = seededShuffle(eligible, random).slice(0, request.questionCount)
  const questionIds = ordered.map((candidate) => candidate.questionId)
  const hash = await computeManifestHash({ seed: request.seed, versions: request.versions, questionIds })

  const manifest: SimulationManifestDTO = {
    simulationId: request.requestId,
    seed: request.seed,
    datasetVersion: request.versions.datasetVersion,
    taxonomyVersion: request.versions.taxonomyVersion,
    featureVersion: request.versions.featureVersion,
    modelVersion: request.versions.modelVersion,
    simulationVersion: request.versions.simulationVersion,
    generatedAt: request.requestedAt,
    questionIds,
    hash,
    hashAlgorithm: primaryHashAlgorithm,
    secondaryHash: null,
  }

  const warnings: string[] = ['Simulación preparada: no hay modelo predictivo ejecutándose.']
  if (request.questionCount > eligible.length) {
    warnings.push('Se pidieron ' + String(request.questionCount) + ' preguntas y solo hay ' + String(eligible.length) + ' elegibles.')
  }

  return { simulationId: request.requestId, manifest, questionIds, status: 'planned', warnings }
}

export async function verifyManifest(manifest: SimulationManifestDTO): Promise<boolean> {
  if (manifest.hashAlgorithm !== primaryHashAlgorithm) return false
  const recomputed = await computeManifestHash({
    seed: manifest.seed,
    versions: {
      datasetVersion: manifest.datasetVersion,
      taxonomyVersion: manifest.taxonomyVersion,
      featureVersion: manifest.featureVersion,
      modelVersion: manifest.modelVersion,
      simulationVersion: manifest.simulationVersion,
    },
    questionIds: manifest.questionIds,
  })
  return recomputed === manifest.hash
}

export function manifestSummary(manifest: SimulationManifestDTO): string {
  return (
    'Simulación ' +
    manifest.simulationId +
    ' · semilla ' +
    manifest.seed +
    ' · ' +
    String(manifest.questionIds.length) +
    ' preguntas · dataset ' +
    manifest.datasetVersion +
    ' · modelo ' +
    (manifest.modelVersion ?? 'ninguno')
  )
}

export const reproducibilityRules: string[] = [
  'Toda simulación registra semilla, versiones y hash.',
  'El hash principal es SHA-256; MD5 solo se admite como hash secundario de compatibilidad.',
  'La misma semilla con el mismo dataset y la misma configuración devuelve el mismo conjunto ordenado.',
  'Las preguntas en cuarentena nunca entran en la selección.',
]

import { describe, expect, it } from 'vitest'
import {
  anomalousCharacterRatio,
  detectAnswer,
  detectOptionLabel,
  detectQuestionMarker,
  endsCleanly,
  hasTableMarkers,
  optionsInterleaved,
  parseTextSegments,
} from './textExtractor'
import {
  buildExtractionQuality,
  computeOptionCompleteness,
  computeOverallConfidence,
  describeQuality,
  qualityBucket,
  qualityDocumentation,
  qualityWeights,
} from './quality'
import { decideStatus, summarizeErrors, validateQuestion, validationThresholds, validatorCatalog } from './validators'
import type { QuestionValidationInput } from './validators'
import { createPdfExtractionServiceStub, createPdfTextSourceStub, createSyntheticTextSource } from './pdfExtractionService'
import { extractionFixtures, findFixture, fixtureDisclaimer } from './fixtures'
import { computePilotMetrics, computePilotTotals, describePilotSelection, metricsDisclaimer, pilotRules, runPilot } from './pilot'
import { applyDecision, applyDecisionsToRun, createReviewQueue, decideAll, describeReviewItem, isReviewed, reviewRules, reviewSummary, serializeReviewQueue, statusForDecision } from './review'
import { computeFieldAgreement, createEvaluationTemplate, evaluationRules, evaluationSummary, setExpectation } from './evaluation'

const now = new Date('2026-09-29T09:00:00.000Z')

function validationInput(overrides: Partial<QuestionValidationInput> = {}): QuestionValidationInput {
  return {
    page: 1,
    rawText: 'Enunciado DEMO con longitud suficiente para superar el minimo exigido.',
    questionNumber: 1,
    options: [
      { label: 'A', text: 'Opcion A' },
      { label: 'B', text: 'Opcion B' },
    ],
    detectedAnswer: 'A',
    previousNumber: null,
    mixedMarkers: false,
    splitAcrossPages: false,
    endsCleanly: true,
    interleavedOptions: false,
    hasTableMarkers: false,
    imageDependent: false,
    anomalousCharacterRatio: 0,
    ...overrides,
  }
}

describe('calidad multidimensional', () => {
  it('documenta formulas y pesos', () => {
    expect(qualityDocumentation.length).toBe(7)
    expect(Object.keys(qualityWeights).length).toBe(5)
    const total = Object.values(qualityWeights).reduce((sum, value) => sum + value, 0)
    expect(Math.round(total * 100) / 100).toBe(1)
  })

  it('devuelve null cuando no hay ningun componente', () => {
    const result = computeOverallConfidence({
      textCompleteness: null,
      questionBoundaryConfidence: null,
      optionCompleteness: null,
      answerKeyConfidence: null,
      layoutConfidence: null,
    })
    expect(result.overall).toBeNull()
    expect(result.missing.length).toBe(5)
  })

  it('renormaliza cuando faltan componentes', () => {
    const result = computeOverallConfidence({
      textCompleteness: 1,
      questionBoundaryConfidence: null,
      optionCompleteness: 1,
      answerKeyConfidence: 1,
      layoutConfidence: null,
    })
    expect(result.overall).toBe(1)
    expect(result.missing).toEqual(['questionBoundaryConfidence', 'layoutConfidence'])
  })

  it('clasifica por cubos y describe el resultado', () => {
    const quality = buildExtractionQuality({
      textCompleteness: 1,
      questionBoundaryConfidence: 1,
      optionCompleteness: 1,
      answerKeyConfidence: 1,
      layoutConfidence: 1,
      notes: [],
    })
    expect(qualityBucket(quality)).toBe('0.8-1.0')
    expect(describeQuality(quality)).toContain('global 1')
    const empty = buildExtractionQuality({
      textCompleteness: null,
      questionBoundaryConfidence: null,
      optionCompleteness: null,
      answerKeyConfidence: null,
      layoutConfidence: null,
      notes: [],
    })
    expect(qualityBucket(empty)).toBe('no-determinable')
    expect(describeQuality(empty)).toContain('no determinable')
  })

  it('no inventa completitud de opciones sin referencia', () => {
    expect(computeOptionCompleteness({ options: [], declaredOptionsPerQuestion: null })).toBe(0)
    expect(
      computeOptionCompleteness({
        options: [{ label: 'A', text: 'x' }, { label: 'B', text: 'y' }],
        declaredOptionsPerQuestion: null,
      }),
    ).toBe(1)
    expect(
      computeOptionCompleteness({
        options: [{ label: 'A', text: 'x' }, { label: 'B', text: 'y' }],
        declaredOptionsPerQuestion: 5,
      }),
    ).toBe(0.4)
  })
})

describe('validadores', () => {
  it('declara los dieciseis codigos con su consecuencia', () => {
    expect(validatorCatalog.length).toBe(16)
    expect(validatorCatalog.filter((entry) => entry.consequence === 'fatal').length).toBe(1)
  })

  it('acepta una pregunta completa', () => {
    expect(validateQuestion(validationInput())).toEqual([])
    expect(decideStatus([], { rawText: 'texto', anomalousCharacterRatio: 0 })).toBe('accepted')
  })

  it('detecta pregunta vacia y la rechaza', () => {
    const errors = validateQuestion(validationInput({ rawText: '   ' }))
    expect(errors[0].code).toBe('empty-question')
    expect(errors[0].consequence).toBe('fatal')
    expect(decideStatus(errors, { rawText: '   ', anomalousCharacterRatio: 0 })).toBe('rejected')
  })

  it('conserva en cuarentena el material recuperable', () => {
    const errors = validateQuestion(validationInput({ rawText: 'Texto DEMO con problemas pero recuperable.' }))
    expect(decideStatus(errors, { rawText: 'Texto DEMO con problemas pero recuperable.', anomalousCharacterRatio: 0 })).toBe('accepted')
    const missingAnswer = validateQuestion(validationInput({ detectedAnswer: null }))
    expect(missingAnswer.some((error) => error.code === 'missing-answer')).toBe(true)
    expect(decideStatus(missingAnswer, { rawText: 'material utilizable', anomalousCharacterRatio: 0 })).toBe('quarantined')
  })

  it('detecta cada defecto previsto', () => {
    expect(validateQuestion(validationInput({ endsCleanly: false })).some((error) => error.code === 'truncated-question')).toBe(true)
    expect(validateQuestion(validationInput({ options: [] })).some((error) => error.code === 'missing-options')).toBe(true)
    expect(
      validateQuestion(validationInput({ options: [{ label: 'A', text: 'igual' }, { label: 'B', text: 'igual' }] })).some(
        (error) => error.code === 'duplicate-options',
      ),
    ).toBe(true)
    expect(validateQuestion(validationInput({ questionNumber: null })).some((error) => error.code === 'invalid-question-number')).toBe(true)
    expect(validateQuestion(validationInput({ questionNumber: 5, previousNumber: 2 })).some((error) => error.code === 'sequence-mismatch')).toBe(true)
    expect(validateQuestion(validationInput({ detectedAnswer: 'Z' })).some((error) => error.code === 'answer-out-of-range')).toBe(true)
    expect(validateQuestion(validationInput({ rawText: 'corto' })).some((error) => error.code === 'text-too-short')).toBe(true)
    expect(
      validateQuestion(validationInput({ rawText: 'a'.repeat(validationThresholds.maxChars + 1) })).some(
        (error) => error.code === 'text-too-long',
      ),
    ).toBe(true)
    expect(validateQuestion(validationInput({ mixedMarkers: true })).some((error) => error.code === 'multiple-questions-mixed')).toBe(true)
    expect(validateQuestion(validationInput({ interleavedOptions: true })).some((error) => error.code === 'possible-column-loss')).toBe(true)
    expect(validateQuestion(validationInput({ hasTableMarkers: true })).some((error) => error.code === 'table-layout-unsupported')).toBe(true)
    expect(validateQuestion(validationInput({ imageDependent: true })).some((error) => error.code === 'image-dependent-question')).toBe(true)
    expect(validateQuestion(validationInput({ anomalousCharacterRatio: 0.1 })).some((error) => error.code === 'anomalous-characters')).toBe(true)
  })

  it('trata los caracteres anomalos altos como material no utilizable', () => {
    const errors = validateQuestion(validationInput({ anomalousCharacterRatio: 0.5 }))
    expect(decideStatus(errors, { rawText: 'material', anomalousCharacterRatio: 0.5 })).toBe('rejected')
  })

  it('resume los errores por codigo', () => {
    const errors = validateQuestion(validationInput({ detectedAnswer: null, imageDependent: true }))
    const summary = summarizeErrors(errors)
    expect(summary['missing-answer']).toBe(1)
    expect(summary['image-dependent-question']).toBe(1)
  })
})

describe('extractor de texto', () => {
  it('detecta marcadores, opciones y respuestas', () => {
    expect(detectQuestionMarker('12. Enunciado')).toBe(12)
    expect(detectQuestionMarker('Pregunta 7 Enunciado')).toBe(7)
    expect(detectQuestionMarker('texto suelto')).toBeNull()
    expect(detectOptionLabel('C) Opcion C')).toBe('C')
    expect(detectOptionLabel('3. Enunciado')).toBeNull()
    expect(detectAnswer('Respuesta correcta: B').kind).toBe('explicit')
    expect(detectAnswer('Respuesta: b').kind).toBe('bare')
    expect(detectAnswer('texto (C)').kind).toBe('parenthetical')
    expect(detectAnswer('sin nada').kind).toBe('none')
  })

  it('separa bloques por marcador', () => {
    const text = ['1. Uno', 'A) primera', '2. Dos', 'B) segunda'].join(String.fromCharCode(10))
    const segments = parseTextSegments(text)
    expect(segments.length).toBe(2)
    expect(segments[0].questionNumber).toBe(1)
    expect(segments[1].options[0].label).toBe('B')
  })

  it('detecta etiquetas intercaladas', () => {
    expect(optionsInterleaved(['A', 'B', 'A', 'B'])).toBe(true)
    expect(optionsInterleaved(['A', 'B', 'C', 'D'])).toBe(false)
  })

  it('mide caracteres anomalos y tablas', () => {
    const replacement = String.fromCharCode(0xfffd)
    expect(anomalousCharacterRatio('texto normal')).toBe(0)
    expect(anomalousCharacterRatio('texto ' + replacement + replacement + ' mas')).toBeGreaterThan(0)
    expect(hasTableMarkers(['| a | b |', '| c | d |'].join(String.fromCharCode(10)))).toBe(true)
    expect(hasTableMarkers('texto sin tablas')).toBe(false)
  })

  it('reconoce cierres limpios', () => {
    expect(endsCleanly('Frase completa.')).toBe(true)
    expect(endsCleanly('D) Opcion D')).toBe(true)
    expect(endsCleanly('frase sin puntuacion final')).toBe(false)
  })
})

describe('servicio de extraccion', () => {
  it('declara un adaptador de PDF no implementado', async () => {
    const source = createPdfTextSourceStub()
    const service = createPdfExtractionServiceStub()
    expect(source.status).toBe('not-implemented')
    expect(service.status).toBe('not-implemented')
    const fixture = findFixture('fixture-normal')
    await expect(source.loadPages(fixture!.document, fixture!.version)).rejects.toThrow()
    expect(createSyntheticTextSource([]).status).toBe('synthetic')
  })

  it('declara el aviso de fixtures sinteticos', () => {
    expect(fixtureDisclaimer).toContain('sint')
    expect(extractionFixtures.length).toBe(11)
  })

  it('procesa cada fixture segun sus expectativas', async () => {
    for (const fixture of extractionFixtures) {
      const pilot = await runPilot(fixture, { now })
      expect(pilot.report.totals.totalPages, fixture.id).toBe(fixture.expectations.totalPages)
      expect(pilot.report.totals.questionsDetected, fixture.id).toBe(fixture.expectations.expectedQuestions)
      expect(pilot.report.totals.accepted, fixture.id).toBe(fixture.expectations.expectedAccepted)
      expect(pilot.report.totals.quarantined, fixture.id).toBe(fixture.expectations.expectedQuarantined)
      expect(pilot.report.totals.rejected, fixture.id).toBe(fixture.expectations.expectedRejected)
      const codes = Object.keys(pilot.report.validationErrors)
      for (const expected of fixture.expectations.expectedErrorCodes) {
        expect(codes, fixture.id + ' :: ' + expected).toContain(expected)
      }
      expect(pilot.run.questions.length, fixture.id).toBe(pilot.report.questions.length)
    }
  })
})

describe('piloto', () => {
  it('declara archivo, tamano, paginas y hash antes de ejecutar', () => {
    const fixture = findFixture('fixture-normal')!
    const selection = describePilotSelection(fixture)
    expect(selection.join(' ')).toContain('SHA-256')
    expect(selection.join(' ')).toContain('Paginas: 2')
    expect(selection.join(' ')).toContain('bytes')
  })

  it('calcula tasas sin llamarlas precision', async () => {
    const fixture = findFixture('fixture-normal')!
    const pilot = await runPilot(fixture, { now })
    const metrics = pilot.report.metrics
    expect(metrics.extractionAcceptanceRate).toBeCloseTo(0.667, 2)
    expect(metrics.quarantineRate).toBeCloseTo(0.333, 2)
    expect(metrics.rejectionRate).toBe(0)
    expect(metrics.optionDetectionRate).toBeCloseTo(0.667, 2)
    expect(metrics.sequenceIntegrityRate).toBe(1)
    expect(metricsDisclaimer).toContain('no precision')
    expect(metricsDisclaimer).toContain('ground truth')
    expect(Object.keys(metrics).some((key) => key.indexOf('precision') !== -1)).toBe(false)
    expect(pilotRules.length).toBe(4)
  })

  it('resume totales y distribucion de calidad', async () => {
    const fixture = findFixture('fixture-normal')!
    const pilot = await runPilot(fixture, { now })
    const totals = computePilotTotals(pilot.run)
    expect(totals.pagesWithQuestions).toBe(2)
    expect(totals.duplicateCandidates).toBe(0)
    expect(Object.keys(pilot.report.qualityDistribution).length).toBeGreaterThan(0)
    expect(computePilotMetrics(pilot.run).answerDetectionRate).toBeCloseTo(0.667, 2)
    expect(pilot.report.pageErrors).toEqual([])
    expect(pilot.report.selection.length).toBe(7)
  })
})

describe('revision humana', () => {
  it('crea la cola sin decisiones', async () => {
    const pilot = await runPilot(findFixture('fixture-normal')!, { now })
    const queue = createReviewQueue(pilot.run)
    expect(queue.length).toBe(3)
    expect(queue.every((item) => item.decision === null)).toBe(true)
    expect(queue.every((item) => isReviewed(item) === false)).toBe(true)
    expect(queue[0].text.length).toBeGreaterThan(0)
    expect(queue[0].errors.length).toBe(0)
    expect(reviewRules.length).toBe(4)
  })

  it('registra quien decide y cuando', async () => {
    const pilot = await runPilot(findFixture('fixture-normal')!, { now })
    const queue = createReviewQueue(pilot.run)
    const reviewed = applyDecision(queue, 2, 'approve', 'revisor@demo', now, 'revisado a mano')
    const item = reviewed[2]
    expect(item.decision).toBe('approve')
    expect(item.reviewedBy).toBe('revisor@demo')
    expect(item.reviewedAt).toBe(now.toISOString())
    expect(item.notes).toBe('revisado a mano')
    expect(isReviewed(item)).toBe(true)
    expect(reviewSummary(reviewed).approved).toBe(1)
    expect(reviewSummary(reviewed).pending).toBe(2)
  })

  it('mapea decisiones a estados y aplica el resultado', async () => {
    expect(statusForDecision('approve')).toBe('accepted')
    expect(statusForDecision('quarantine')).toBe('quarantined')
    expect(statusForDecision('reject')).toBe('rejected')
    const pilot = await runPilot(findFixture('fixture-normal')!, { now })
    const queue = createReviewQueue(pilot.run)
    const decided = applyDecision(queue, 2, 'reject', 'revisor@demo', now)
    const updated = applyDecisionsToRun(pilot.run, decided)
    expect(updated.questions[2].validationStatus).toBe('rejected')
    expect(updated.questions[0].validationStatus).toBe('accepted')
    const all = decideAll(queue, 'quarantine', 'revisor@demo', now)
    expect(reviewSummary(all).quarantined).toBe(3)
    expect(serializeReviewQueue(all).length).toBeGreaterThan(0)
    expect(describeReviewItem(queue[1])).toContain('pag.')
  })
})

describe('ground truth', () => {
  it('no se genera automaticamente', async () => {
    const pilot = await runPilot(findFixture('fixture-normal')!, { now })
    const rows = createEvaluationTemplate(pilot.run)
    expect(rows.length).toBe(pilot.run.questions.length * 6)
    expect(rows.every((row) => row.expected === null)).toBe(true)
    expect(rows.every((row) => row.match === null)).toBe(true)
    expect(rows.some((row) => row.actual !== null)).toBe(true)
    expect(evaluationRules.length).toBe(4)
  })

  it('no calcula acuerdo sin filas evaluadas', async () => {
    const pilot = await runPilot(findFixture('fixture-normal')!, { now })
    const rows = createEvaluationTemplate(pilot.run)
    const agreement = computeFieldAgreement(rows)
    expect(agreement.length).toBe(6)
    expect(agreement.every((entry) => entry.agreement === null)).toBe(true)
    expect(agreement.every((entry) => entry.evaluated === 0)).toBe(true)
    expect(evaluationSummary(rows).pending).toBe(rows.length)
  })

  it('calcula acuerdo cuando una persona rellena la referencia', async () => {
    const pilot = await runPilot(findFixture('fixture-normal')!, { now })
    const rows = createEvaluationTemplate(pilot.run)
    const questionId = rows[0].questionId
    const filled = setExpectation(rows, questionId, 'questionNumber', '1', 'revisor@demo')
    const field = computeFieldAgreement(filled).find((entry) => entry.field === 'questionNumber')!
    expect(field.evaluated).toBe(1)
    expect(field.matches).toBe(1)
    expect(field.agreement).toBe(1)
    const wrong = setExpectation(rows, questionId, 'answer', 'Z', 'revisor@demo')
    const answerField = computeFieldAgreement(wrong).find((entry) => entry.field === 'answer')!
    expect(answerField.agreement).toBe(0)
    expect(evaluationSummary(filled).matches).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findFixture } from './fixtures'
import { runPilot } from './pilot'
import { createReviewQueue, reviewSummary, serializeReviewQueue } from './review'

const docsDirectory = join(process.cwd(), '..', 'docs')
const now = new Date('2026-09-29T09:00:00.000Z')

describe('artefactos del piloto', () => {
  it('genera extraction-report.json y la cola de revision', async () => {
    const fixture = findFixture('fixture-normal')
    expect(fixture).toBeDefined()
    const pilot = await runPilot(fixture!, { now })
    mkdirSync(docsDirectory, { recursive: true })

    const reportPath = join(docsDirectory, 'extraction-report.json')
    writeFileSync(reportPath, JSON.stringify(pilot.report, null, 2), 'utf8')

    const queue = createReviewQueue(pilot.run)
    const queuePath = join(docsDirectory, 'extraction-review-queue.json')
    writeFileSync(queuePath, serializeReviewQueue(queue), 'utf8')

    expect(pilot.report.totals.questionsDetected).toBe(3)
    expect(pilot.report.document.pages).toBe(2)
    expect(pilot.report.validationErrors).toBeDefined()
    expect(reviewSummary(queue).pending).toBe(3)
  })
})

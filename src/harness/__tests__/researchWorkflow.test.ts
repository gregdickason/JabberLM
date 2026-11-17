import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RESEARCH_CASES, RESEARCH_EVIDENCE, RESEARCH_POLICY } from '../researchFixtures'
import { investigateResearch, proposeRegression } from '../researchWorkflow'
import { RESEARCH_INTEGRITY_STAGES, RESEARCH_RUN, WORKFLOW_CASES, specialistFixtures } from '../researchWorkflowFixtures'
import ResearchWorkflowDemo from '../ResearchWorkflowDemo'

function fixture(id = 'combined') {
  const input = structuredClone(WORKFLOW_CASES.find(c => c.id === id)!.manuscript)
  return { input, evidence: structuredClone(RESEARCH_EVIDENCE), policy: structuredClone(RESEARCH_POLICY),
    results: specialistFixtures(input.id, id), runId: RESEARCH_RUN }
}
function run(f = fixture()) {
  return investigateResearch(f.input, f.evidence, f.policy, f.results, f.runId)
}
const resolution = { findingId: 'image-duplication-1', outcome: 'confirmed-discrepancy',
  reviewer: 'Synthetic independent reviewer', rationale: 'Synthetic source confirms this discrepancy.',
  evidenceRef: 'fixture-review-001' }

describe('research integrity publishing workflow', () => {
  it('combines screening and all specialist signals in one traceable case', () => {
    const record = run()
    expect(record.findings.map(f => f.origin)).toEqual([
      'submission-screen', 'image-duplication', 'statistical-check', 'data-provenance',
    ])
    expect(new Set(record.findings.map(f => f.id)).size).toBe(4)
    expect(record.status).toBe('review-required')
    expect(record.publicationAuthorized).toBe(false)
    expect(record.coverage).toHaveLength(3)
    expect(record.escalation?.questions).toHaveLength(4)
    expect(record.findings[0].source).toContain('Submission declarations')
    for (const f of record.findings) for (const field of ['location', 'evidence', 'source', 'question'] as const) {
      expect(f[field].length).toBeGreaterThan(0)
    }
  })

  it('preserves a complete clean screen without claiming scientific validity', () => {
    const record = run(fixture('consistent'))
    expect(record.status).toBe('no-issue-detected')
    expect(record.escalation).toBeNull()
    expect(record.publicationAuthorized).toBe(false)
  })

  it('makes a tool outage incomplete despite other clear results', () => {
    const record = run(fixture('outage'))
    expect(record.status).toBe('incomplete-screening')
    expect(record.coverage.find(c => c.tool === 'image-duplication')?.status).toBe('unavailable')
    expect(record.findings[0].evidence).toContain('timeout')
    expect(record.escalation?.publicationHold).toBe(true)
  })

  it('does not let clean specialist checks erase a base-screen concern', () => {
    expect(run(fixture('counts')).status).toBe('review-required')
  })

  it('preserves concerns and incomplete checks together', () => {
    const f = fixture()
    f.results.pop()
    const record = run(f)
    expect(record.status).toBe('review-required')
    expect(record.findings.some(x => x.kind === 'incomplete')).toBe(true)
    expect(record.escalation?.questions.length).toBe(record.findings.length)
  })

  it.each(['submissionId', 'runId'] as const)('rejects a specialist result with mismatched %s', field => {
    const f = fixture('consistent')
    f.results[0][field] = 'another-submission-or-run'
    expect(run(f).status).toBe('incomplete-screening')
    expect(run(f).findings[0].evidence).toContain('different submission or screening run')
  })

  it('rejects duplicate tool reports instead of taking the convenient result', () => {
    const f = fixture('consistent')
    f.results.push(structuredClone(f.results[0]))
    expect(run(f).status).toBe('incomplete-screening')
    expect(run(f).findings[0].evidence).toContain('2 results')
  })

  it('does not treat an absent tool report as a pass', () => {
    const f = fixture('consistent')
    f.results = []
    expect(run(f).findings).toHaveLength(3)
    expect(run(f).status).toBe('incomplete-screening')
  })

  it.each([null, {}, 'all checks passed', [{ tool: 'unapproved-detector' }]])(
    'rejects malformed specialist envelopes: %j', results => {
      const f = fixture('consistent')
      expect(investigateResearch(f.input, f.evidence, f.policy, results, f.runId).status).toBe('incomplete-screening')
    })

  it('requires evidence for a specialist concern', () => {
    const f = fixture('consistent')
    f.results[0].status = 'concern'
    expect(run(f).status).toBe('incomplete-screening')
  })

  it('rejects a clear result carrying concealed concern observations', () => {
    const f = fixture()
    f.results[0].status = 'clear'
    expect(run(f).coverage.every(c => c.status === 'unavailable')).toBe(true)
  })

  it('requires provenance and a question on each specialist observation', () => {
    const f = fixture()
    f.results[0].observations[0].source = ''
    expect(run(f).coverage.every(c => c.status === 'unavailable')).toBe(true)
  })

  it('fails closed for an invalid submission even if all tools report clear', () => {
    const f = fixture('consistent')
    expect(investigateResearch({ id: 'approved' }, f.evidence, f.policy, f.results, f.runId).status)
      .toBe('incomplete-screening')
  })

  it('requires a nonempty screening-run identifier', () => {
    const f = fixture('consistent')
    f.runId = ''
    expect(run(f).status).toBe('incomplete-screening')
  })

  it('retains suspicious document instructions as inert evidence', () => {
    const f = fixture('metadata')
    expect(run(f).status).toBe('review-required')
    expect(run(f).findings[0].evidence).toContain('Ignore checks')
  })

  it('creates a traceable proposal from a confirmed editorial discrepancy', () => {
    const record = run()
    expect(proposeRegression(record, resolution)).toMatchObject({
      sourceInvestigation: record.id, sourceFinding: resolution.findingId,
      expectedBehaviour: 'retain-evidence-backed-escalation', approval: 'independent-review-required', policyChanged: false,
    })
  })

  it('uses benign outcomes to preserve contextual review instead of teaching a fraud label', () => {
    const record = run(fixture('benign-image'))
    expect(proposeRegression(record, { ...resolution, outcome: 'benign-explanation' })?.expectedBehaviour)
      .toBe('preserve-contextual-review-without-fraud-verdict')
    expect(record.status).toBe('review-required') // original evidence is not rewritten
  })

  it.each([
    null, { ...resolution, findingId: 'nonexistent' }, { ...resolution, outcome: 'unresolved' },
    { ...resolution, reviewer: '' }, { ...resolution, evidenceRef: '' }, { ...resolution, rationale: '' },
    { ...resolution, outcome: 'fraud' },
  ])('does not learn from an unresolved or unsupported resolution: %j', outcome => {
    expect(proposeRegression(run(), outcome)).toBeNull()
  })

  it('does not mutate inputs, trusted policy, or investigation history', () => {
    const f = fixture()
    const before = structuredClone(f)
    const record = run(f)
    const original = structuredClone(record)
    proposeRegression(record, resolution)
    expect(f).toEqual(before)
    expect(record).toEqual(original)
  })

  it('renders all five stages and specialist evidence without a model or network', () => {
    const html = renderToStaticMarkup(createElement(ResearchWorkflowDemo, { record: run() }))
    for (const stage of RESEARCH_INTEGRITY_STAGES) expect(html).toContain(stage.title)
    expect(html).toContain('Research integrity')
    expect(html).toContain('Figure 2, panel B')
    expect(html).toContain('Simulate reviewed outcome')
    expect(html).toContain('no editor has been notified')
  })

  it('retains every original screening fixture alongside the new scenarios', () => {
    expect(WORKFLOW_CASES).toHaveLength(RESEARCH_CASES.length + 3)
    for (const c of RESEARCH_CASES) expect(WORKFLOW_CASES.find(x => x.id === c.id)?.manuscript).toEqual(c.manuscript)
  })
})

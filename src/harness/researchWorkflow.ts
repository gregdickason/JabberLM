import { screenResearch, type ResearchReport } from './researchIntegrity'

export const SPECIALIST_TOOLS = ['image-duplication', 'statistical-check', 'data-provenance'] as const
export type SpecialistTool = typeof SPECIALIST_TOOLS[number]
export interface SpecialistResult {
  tool: SpecialistTool
  version: string
  submissionId: string
  runId: string
  status: 'clear' | 'concern' | 'unavailable'
  note: string
  observations: { location: string; evidence: string; source: string; question: string }[]
}
export interface InvestigationFinding {
  id: string
  origin: 'submission-screen' | SpecialistTool
  kind: 'concern' | 'incomplete'
  location: string
  evidence: string
  source: string
  question: string
}
export interface Investigation {
  id: string
  submissionId: string | null
  screening: ResearchReport
  coverage: { tool: SpecialistTool; status: SpecialistResult['status']; version: string | null }[]
  findings: InvestigationFinding[]
  status: ResearchReport['status']
  escalation: null | {
    assignee: 'research-integrity specialist'
    reason: string
    questions: { findingId: string; question: string }[]
    publicationHold: true
  }
  publicationAuthorized: false
}

const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0
function validResult(x: unknown): x is SpecialistResult {
  if (!object(x) || !SPECIALIST_TOOLS.includes(x.tool as SpecialistTool)
    || !text(x.version) || !text(x.submissionId) || !text(x.runId) || !text(x.note)
    || !['clear', 'concern', 'unavailable'].includes(x.status as string)
    || !Array.isArray(x.observations)) return false
  if (x.status === 'concern' ? x.observations.length === 0 : x.observations.length !== 0) return false
  return x.observations.every(o => object(o) && text(o.location) && text(o.evidence) && text(o.source) && text(o.question))
}

/**
 * Adapter results and runId come from the harness. This pure function validates
 * and combines them; it does not invoke detectors or authenticate their sources.
 * Recompute base screening rather than accepting a model-authored "passed" report.
 */
export function investigateResearch(input: unknown, evidence: unknown, policy: unknown,
  results: unknown, runId: string): Investigation {
  const screening = screenResearch(input, evidence, policy)
  const submissionId = screening.provenance?.manuscript ?? null
  const findings: InvestigationFinding[] = screening.findings.map((f, i) => ({
    id: `screen-${i + 1}`, origin: 'submission-screen', kind: f.kind,
    location: f.location, evidence: f.evidence,
    source: !screening.provenance ? 'Input validation'
      : f.check === 'reference' || f.check === 'retraction'
        ? `${screening.provenance.source} / ${screening.provenance.snapshot}`
        : `Submission declarations / ${screening.provenance.manuscript} / policy ${screening.provenance.policy}`,
    question: f.nextStep,
  }))
  const coverage: Investigation['coverage'] = []
  const incomplete = (origin: SpecialistTool, detail: string) => {
    findings.push({ id: `${origin}-incomplete`, origin, kind: 'incomplete', location: 'specialist evidence',
      evidence: detail, source: 'Harness adapter validation',
      question: 'Obtain a valid, current result for this submission and screening run; do not treat missing evidence as clear.' })
    coverage.push({ tool: origin, status: 'unavailable', version: null })
  }
  const envelopeValid = text(runId) && Array.isArray(results) && results.every(validResult)
  for (const tool of SPECIALIST_TOOLS) {
    if (!submissionId || !envelopeValid) {
      incomplete(tool, 'Input, screening run, or specialist result envelope could not be validated.')
      continue
    }
    const matches = (results as SpecialistResult[]).filter(r => r.tool === tool)
    if (matches.length !== 1) {
      incomplete(tool, `${matches.length} results supplied for ${tool}; exactly one is required.`)
      continue
    }
    const result = matches[0]
    if (result.submissionId !== submissionId || result.runId !== runId) {
      incomplete(tool, 'Result belongs to a different submission or screening run.')
      continue
    }
    if (result.status === 'unavailable') {
      incomplete(tool, result.note)
      continue
    }
    coverage.push({ tool, status: result.status, version: result.version })
    result.observations.forEach((o, i) => findings.push({ id: `${tool}-${i + 1}`, origin: tool,
      kind: 'concern', location: o.location, evidence: o.evidence, source: o.source, question: o.question }))
  }
  const status = findings.some(f => f.kind === 'concern') ? 'review-required'
    : findings.length ? 'incomplete-screening' : 'no-issue-detected'
  return {
    id: `investigation:${submissionId ?? 'invalid'}:${runId}`, submissionId, screening, coverage, findings, status,
    escalation: findings.length ? {
      assignee: 'research-integrity specialist',
      reason: status === 'review-required' ? 'Evidence discrepancies need contextual investigation.' : 'Required verification is incomplete.',
      questions: findings.map(f => ({ findingId: f.id, question: f.question })), publicationHold: true,
    } : null,
    publicationAuthorized: false,
  }
}

export interface EditorialResolution {
  findingId: string
  outcome: 'confirmed-discrepancy' | 'benign-explanation' | 'unresolved'
  reviewer: string
  rationale: string
  evidenceRef: string
}
export interface RegressionProposal {
  sourceInvestigation: string
  sourceFinding: string
  reviewer: string
  rationale: string
  evidenceRef: string
  expectedBehaviour: 'retain-evidence-backed-escalation' | 'preserve-contextual-review-without-fraud-verdict'
  approval: 'independent-review-required'
  policyChanged: false
}

/** A local proposal, never a policy update, model training, or a fraud label. */
export function proposeRegression(record: Investigation, resolution: unknown): RegressionProposal | null {
  if (!object(resolution) || !text(resolution.findingId) || !text(resolution.reviewer)
    || !text(resolution.rationale) || !text(resolution.evidenceRef)
    || !['confirmed-discrepancy', 'benign-explanation'].includes(resolution.outcome as string)
    || !record.findings.some(f => f.id === resolution.findingId)) return null
  return { sourceInvestigation: record.id, sourceFinding: resolution.findingId,
    reviewer: resolution.reviewer, rationale: resolution.rationale, evidenceRef: resolution.evidenceRef,
    expectedBehaviour: resolution.outcome === 'confirmed-discrepancy' ? 'retain-evidence-backed-escalation'
      : 'preserve-contextual-review-without-fraud-verdict',
    approval: 'independent-review-required', policyChanged: false }
}

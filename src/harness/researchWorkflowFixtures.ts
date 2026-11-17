import { RESEARCH_CASES } from './researchFixtures'
import { SPECIALIST_TOOLS, type SpecialistResult } from './researchWorkflow'

export const RESEARCH_RUN = 'synthetic-screening-run-v1'
export const RESEARCH_INTEGRITY_STAGES = [
  { title: 'Screen submissions', detail: 'Check citations, participant counts, and required evidence consistently.' },
  { title: 'Connect specialist tools', detail: 'Receive image, statistical, and data-provenance evidence through independent adapters.' },
  { title: 'Combine evidence', detail: 'Retain related discrepancies in one traceable investigation record.' },
  { title: 'Escalate concerns', detail: 'Give specialists the location, source, evidence, and unresolved question.' },
  { title: 'Learn from investigations', detail: 'Turn reviewed outcomes into proposed regression cases, with independent approval.' },
] as const

// Results are written by hand to demonstrate the integration contract. No image
// detector, statistical engine, repository, publisher API, or author record is queried.
export function specialistFixtures(submissionId: string, scenario: string): SpecialistResult[] {
  const results: SpecialistResult[] = SPECIALIST_TOOLS.map(tool => ({
    tool, version: 'synthetic-adapter-v1', submissionId, runId: RESEARCH_RUN,
    status: 'clear', note: 'Synthetic fixture: no concern reported by this illustrative check.', observations: [],
  }))
  if (scenario === 'combined' || scenario === 'benign-image') {
    results[0] = { ...results[0], status: 'concern', note: 'Synthetic image similarity signal.', observations: [{
      location: 'Figure 2, panel B', evidence: 'Synthetic panel fingerprint matches a panel in fixture-paper-002.',
      source: 'Synthetic image comparison / fixture-image-match-01',
      question: 'Is this disclosed, appropriate reuse or an unexplained duplication? Request original images.',
    }] }
  }
  if (scenario === 'combined') {
    results[1] = { ...results[1], status: 'concern', note: 'Synthetic statistical reproducibility signal.', observations: [{
      location: 'Table 3, primary outcome', evidence: 'The fixture analysis does not reproduce the reported summary from the supplied fixture data.',
      source: 'Synthetic statistical check / fixture-analysis-01',
      question: 'Which data version, exclusions, and analysis code explain the difference?',
    }] }
    results[2] = { ...results[2], status: 'concern', note: 'Synthetic provenance signal.', observations: [{
      location: 'Data availability statement', evidence: 'The declared dataset version differs from the version named in the synthetic repository manifest.',
      source: 'Synthetic repository manifest / fixture-provenance-01',
      question: 'Provide the dataset version and repository record used in the analysis.',
    }] }
  }
  if (scenario === 'outage') results[0] = { ...results[0], status: 'unavailable',
    note: 'Simulated image-checking service timeout; no image verification completed.' }
  return results
}

export const WORKFLOW_CASES = [
  ...RESEARCH_CASES,
  { id: 'combined', label: 'Combined investigation', note: 'Several synthetic signals share one case. They require investigation, not a combined fraud score.',
    manuscript: { ...RESEARCH_CASES[0].manuscript, sample: { total: 15, groups: [5, 7], partition: true } } },
  { id: 'outage', label: 'Specialist service unavailable', note: 'A tool outage must remain visibly incomplete, even when other checks are clear.',
    manuscript: RESEARCH_CASES[0].manuscript },
  { id: 'benign-image', label: 'Image match with a benign explanation', note: 'A similarity flag can reflect legitimate reuse. Simulate an editorial explanation below; the original evidence remains recorded.',
    manuscript: RESEARCH_CASES[0].manuscript },
]

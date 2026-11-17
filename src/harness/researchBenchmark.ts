import type { Manuscript, ResearchReport } from './researchIntegrity'
import { RESEARCH_EVIDENCE, RESEARCH_POLICY } from './researchFixtures'
import { investigateResearch } from './researchWorkflow'
import { RESEARCH_RUN, WORKFLOW_CASES, specialistFixtures } from './researchWorkflowFixtures'

export type BinaryOutcome = 'TP' | 'FP' | 'TN' | 'FN' | 'abstained' | 'unlabelled'
export interface BenchmarkRow {
  id: string
  label: string
  // Set by the synthetic case author, independently of the gate's output.
  // Positive means a substantive discrepancy, not a finding of misconduct.
  actualPositive: boolean | null
  rationale: string
  predicted: ResearchReport['status']
}
export interface BenchmarkCase {
  id: string
  label: string
  manuscript: Manuscript
  actualPositive: boolean | null
  rationale: string
}

const annotations: Record<string, { actualPositive: boolean | null; rationale: string }> = {
  consistent: { actualPositive: false, rationale: 'Synthetic control with no stipulated substantive discrepancy.' },
  metadata: { actualPositive: true, rationale: 'The synthetic citation title is deliberately replaced with unrelated text.' },
  unknown: { actualPositive: null, rationale: 'No adjudicated label: absence from the snapshot leaves the reference unresolved.' },
  counts: { actualPositive: true, rationale: 'The synthetic exhaustive participant groups deliberately conflict with the total.' },
  missing: { actualPositive: null, rationale: 'No adjudicated label: missing evidence prevents substantive verification.' },
  retracted: { actualPositive: false, rationale: 'For this benchmark, the case author stipulates a legitimate critique citing retracted work.' },
  overlap: { actualPositive: null, rationale: 'No adjudicated label: the group relationship requires additional context.' },
  combined: { actualPositive: true, rationale: 'The case deliberately includes substantive count, image, statistical, and provenance discrepancies.' },
  outage: { actualPositive: false, rationale: 'The control is stipulated benign, but the simulated tool outage prevents a complete screen.' },
  'benign-image': { actualPositive: false, rationale: 'For this benchmark, the image match is stipulated legitimate, disclosed reuse.' },
}

export const RESEARCH_BENCHMARK_CASES: BenchmarkCase[] = [
  ...WORKFLOW_CASES.map(c => {
    const annotation = annotations[c.id]
    if (!annotation) throw new Error(`Missing independent benchmark annotation: ${c.id}`)
    return { id: c.id, label: c.label, manuscript: c.manuscript, ...annotation }
  }),
  {
    id: 'hidden-fabrication', label: 'Fabricated but internally consistent data',
    manuscript: { ...WORKFLOW_CASES[0].manuscript, id: 'synthetic-hidden-fabrication',
      sample: { total: 100, groups: [40, 60], partition: true } },
    actualPositive: true,
    rationale: 'The case author stipulates fabricated underlying data. This fact is withheld from the gate; all visible declarations and simulated tool outputs agree.',
  },
]

export function classifyBenchmarkRow(row: BenchmarkRow): BinaryOutcome {
  if (![true, false, null].includes(row.actualPositive)
    || !['review-required', 'no-issue-detected', 'incomplete-screening'].includes(row.predicted)) {
    throw new TypeError('Invalid benchmark truth label or prediction')
  }
  if (row.predicted === 'incomplete-screening') return 'abstained'
  if (row.actualPositive === null) return 'unlabelled'
  return row.predicted === 'review-required'
    ? row.actualPositive ? 'TP' : 'FP'
    : row.actualPositive ? 'FN' : 'TN'
}

const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null

export function researchConfusionMatrix(rows: readonly BenchmarkRow[]) {
  const counts = { TP: 0, FP: 0, TN: 0, FN: 0 }
  const ids = new Set<string>()
  let abstained = 0
  let unlabelled = 0
  let excluded = 0
  let positiveAbstentions = 0
  let negativeAbstentions = 0
  for (const row of rows) {
    if (!row.id.trim() || ids.has(row.id)) throw new Error('Benchmark case IDs must be nonempty and unique')
    ids.add(row.id)
    const outcome = classifyBenchmarkRow(row)
    if (outcome === 'abstained') {
      abstained++
      if (row.actualPositive === true) positiveAbstentions++
      if (row.actualPositive === false) negativeAbstentions++
    }
    if (row.actualPositive === null) unlabelled++
    if (outcome === 'abstained' || outcome === 'unlabelled') excluded++
    else counts[outcome]++
  }
  const { TP, FP, TN, FN } = counts
  const scored = TP + FP + TN + FN
  return { ...counts, total: rows.length, scored, excluded, abstained, unlabelled,
    positiveAbstentions, negativeAbstentions,
    precision: ratio(TP, TP + FP), recall: ratio(TP, TP + FN),
    specificity: ratio(TN, TN + FP), accuracy: ratio(TP + TN, scored),
    f1: ratio(2 * TP, 2 * TP + FP + FN), scoringCoverage: ratio(scored, rows.length) }
}

/** Labels stay outside screening inputs. No benchmark truth is passed to the gate. */
export function runResearchBenchmark(): BenchmarkRow[] {
  return RESEARCH_BENCHMARK_CASES.map(c => {
    const report = investigateResearch(c.manuscript, RESEARCH_EVIDENCE, RESEARCH_POLICY,
      specialistFixtures(c.manuscript.id, c.id), RESEARCH_RUN)
    return { id: c.id, label: c.label, actualPositive: c.actualPositive,
      rationale: c.rationale, predicted: report.status }
  })
}

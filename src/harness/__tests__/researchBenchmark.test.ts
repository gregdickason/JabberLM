import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ResearchConfusionMatrix from '../ResearchConfusionMatrix'
import { classifyBenchmarkRow, researchConfusionMatrix, runResearchBenchmark,
  RESEARCH_BENCHMARK_CASES, type BenchmarkRow } from '../researchBenchmark'

function row(actualPositive: boolean | null, predicted: BenchmarkRow['predicted'], id = 'case'): BenchmarkRow {
  return { id, label: 'Synthetic case', actualPositive, predicted, rationale: 'Independent fixture label' }
}

describe('research integrity confusion matrix', () => {
  it.each([
    [true, 'review-required', 'TP'], [false, 'review-required', 'FP'],
    [false, 'no-issue-detected', 'TN'], [true, 'no-issue-detected', 'FN'],
    [true, 'incomplete-screening', 'abstained'], [false, 'incomplete-screening', 'abstained'],
    [null, 'incomplete-screening', 'abstained'], [null, 'review-required', 'unlabelled'],
    [null, 'no-issue-detected', 'unlabelled'],
  ] as const)('classifies actual=%s predicted=%s as %s', (truth, prediction, outcome) => {
    expect(classifyBenchmarkRow(row(truth, prediction))).toBe(outcome)
  })

  it('measures actual gate outputs without deriving labels from predictions', () => {
    const rows = runResearchBenchmark()
    expect(researchConfusionMatrix(rows)).toMatchObject({ TP: 3, FP: 2, TN: 1, FN: 1,
      total: 11, scored: 7, excluded: 4, abstained: 4, unlabelled: 3,
      positiveAbstentions: 0, negativeAbstentions: 1 })
    expect(rows.find(r => r.id === 'hidden-fabrication')).toMatchObject({ actualPositive: true, predicted: 'no-issue-detected' })
    expect(rows.find(r => r.id === 'benign-image')).toMatchObject({ actualPositive: false, predicted: 'review-required' })
  })

  it('computes metric formulas on the scored denominator', () => {
    const m = researchConfusionMatrix(runResearchBenchmark())
    expect(m.precision).toBeCloseTo(3 / 5)
    expect(m.recall).toBeCloseTo(3 / 4)
    expect(m.specificity).toBeCloseTo(1 / 3)
    expect(m.accuracy).toBeCloseTo(4 / 7)
    expect(m.f1).toBeCloseTo(6 / 9)
    expect(m.scoringCoverage).toBeCloseTo(7 / 11)
  })

  it('never converts missing evidence into a true negative', () => {
    const m = researchConfusionMatrix([row(false, 'incomplete-screening')])
    expect(m).toMatchObject({ TN: 0, scored: 0, excluded: 1, abstained: 1, negativeAbstentions: 1 })
    expect(m.accuracy).toBeNull()
  })

  it('keeps unknown labels outside the binary matrix even for a confident flag', () => {
    expect(researchConfusionMatrix([row(null, 'review-required')])).toMatchObject({
      TP: 0, FP: 0, TN: 0, FN: 0, unlabelled: 1, excluded: 1, abstained: 0,
    })
  })

  it('reports undefined denominators as null instead of a perfect score or NaN', () => {
    const empty = researchConfusionMatrix([])
    for (const key of ['precision', 'recall', 'specificity', 'accuracy', 'f1', 'scoringCoverage'] as const) {
      expect(empty[key]).toBeNull()
    }
    const negative = researchConfusionMatrix([row(false, 'no-issue-detected')])
    expect(negative.precision).toBeNull()
    expect(negative.recall).toBeNull()
    expect(negative.specificity).toBe(1)
  })

  it('exposes known-positive abstentions so conditional recall cannot hide them', () => {
    expect(researchConfusionMatrix([row(true, 'incomplete-screening')])).toMatchObject({
      FN: 0, positiveAbstentions: 1, scored: 0, excluded: 1,
    })
  })

  it('rejects duplicate IDs rather than double-counting submissions', () => {
    expect(() => researchConfusionMatrix([row(true, 'review-required'), row(true, 'review-required')])).toThrow('unique')
  })

  it('rejects unsupported prediction values rather than treating them as negative', () => {
    expect(() => classifyBenchmarkRow({ ...row(true, 'review-required'), predicted: 'approved' } as unknown as BenchmarkRow)).toThrow(TypeError)
  })

  it('leaves fixture labels and manuscripts unchanged across repeated runs', () => {
    const before = structuredClone(RESEARCH_BENCHMARK_CASES)
    expect(runResearchBenchmark()).toEqual(runResearchBenchmark())
    expect(RESEARCH_BENCHMARK_CASES).toEqual(before)
  })

  it('renders all four cells with scoring and simulation limitations', () => {
    const html = renderToStaticMarkup(createElement(ResearchConfusionMatrix))
    for (const text of ['TP: 3', 'FP: 2', 'TN: 1', 'FN: 1', 'Scored: 7/11', 'Incomplete screening: 4',
      'conditional on scored cases', 'Specialist outputs', 'simulated', 'internally consistent']) {
      expect(html).toContain(text)
    }
  })
})

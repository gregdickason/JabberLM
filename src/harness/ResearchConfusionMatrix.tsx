import { classifyBenchmarkRow, researchConfusionMatrix, runResearchBenchmark } from './researchBenchmark'

const percent = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`

export default function ResearchConfusionMatrix() {
  const rows = runResearchBenchmark()
  const matrix = researchConfusionMatrix(rows)
  return (
    <div className="mt-5 space-y-3 border-t border-slate-700 pt-4 text-xs">
      <h3 className="text-sm font-semibold text-sky-200">Synthetic benchmark confusion matrix</h3>
      <p>
        Unit: one synthetic submission. Actual positive means a substantive discrepancy is stipulated
        in the case label; predicted positive means flagged for review. Neither means proven misconduct.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="mb-2 text-left text-slate-400">Counts on labelled cases with a binary screening result</caption>
          <thead><tr>
            <th scope="col" className="border border-slate-700 p-2">Synthetic ground truth</th>
            <th scope="col" className="border border-slate-700 p-2">Flagged for review (+)</th>
            <th scope="col" className="border border-slate-700 p-2">No issue detected (−)</th>
          </tr></thead>
          <tbody>
            <tr>
              <th scope="row" className="border border-slate-700 p-2">Substantive discrepancy (+)</th>
              <td className="border border-slate-700 p-2">TP: {matrix.TP}</td>
              <td className="border border-slate-700 p-2">FN: {matrix.FN}</td>
            </tr>
            <tr>
              <th scope="row" className="border border-slate-700 p-2">No substantive discrepancy (−)</th>
              <td className="border border-slate-700 p-2">FP: {matrix.FP}</td>
              <td className="border border-slate-700 p-2">TN: {matrix.TN}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        TP = correctly flagged; FP = benign case flagged; TN = benign case with no issue detected;
        FN = a substantive discrepancy missed.
      </p>
      <p>
        Precision: {percent(matrix.precision)} · Recall: {percent(matrix.recall)} · Specificity: {percent(matrix.specificity)}
        {' '}· F1: {percent(matrix.f1)} · Accuracy: {percent(matrix.accuracy)}
      </p>
      <p className="text-slate-400">
        Scored: {matrix.scored}/{matrix.total} ({percent(matrix.scoringCoverage)}). Excluded: {matrix.excluded}.
        {' '}Incomplete screening: {matrix.abstained}; unknown truth labels: {matrix.unlabelled} (categories can overlap).
        {' '}Known-positive abstentions: {matrix.positiveAbstentions}; known-negative abstentions: {matrix.negativeAbstentions}.
        {' '}All metrics above are conditional on scored cases; abstentions are never counted as TN.
      </p>
      <p className="text-slate-400">
        This small, hand-authored benchmark deliberately includes benign retracted-work citations and image
        reuse (FP), and invented but internally consistent data that slips through (FN). Specialist outputs
        are simulated. These results do not estimate real-world fraud-detection performance, and a false
        alarm can still be a reasonable request for editorial context.
      </p>
      <details>
        <summary className="cursor-pointer text-sky-300">Inspect every case, label, prediction, and outcome</summary>
        <ul className="mt-2 space-y-2">
          {rows.map(row => <li key={row.id} className="rounded border border-slate-700 p-2">
            <p className="font-semibold">{row.label} · {classifyBenchmarkRow(row)}</p>
            <p>Actual: {row.actualPositive === null ? 'unknown' : row.actualPositive ? 'positive' : 'negative'}.
              {' '}Predicted: {row.predicted}.</p>
            <p className="mt-1 text-slate-400">{row.rationale}</p>
          </li>)}
        </ul>
      </details>
    </div>
  )
}

import { useState } from 'react'
import { btn } from '../explain/ui'
import type { EditorialResolution, Investigation, RegressionProposal } from './researchWorkflow'
import { proposeRegression } from './researchWorkflow'
import { RESEARCH_INTEGRITY_STAGES } from './researchWorkflowFixtures'

export default function ResearchWorkflowDemo({ record }: { record: Investigation }) {
  const [findingId, setFindingId] = useState(record.findings[0]?.id ?? '')
  const [outcome, setOutcome] = useState<EditorialResolution['outcome']>('unresolved')
  const [proposal, setProposal] = useState<RegressionProposal | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const simulate = () => {
    setProposal(proposeRegression(record, { findingId, outcome, reviewer: 'Synthetic editorial reviewer',
      rationale: outcome === 'benign-explanation' ? 'Synthetic resolution: supporting context explains the signal; retain contextual review.'
        : 'Synthetic resolution: original evidence confirms this discrepancy; preserve a test for it.',
      evidenceRef: 'synthetic-editorial-review-fixture-v1',
    }))
    setReviewed(true)
  }
  return (
    <div className="mt-5 space-y-4 border-t border-slate-700 pt-4">
      <h3 className="font-semibold text-sky-200">Research integrity: a five-stage publishing workflow</h3>
      <p className="text-xs text-slate-400">
        Illustrative research-integrity proposal. All specialist outputs and
        reviewer outcomes below are simulated. No submission is sent to a service.
      </p>
      <ol className="list-inside list-decimal space-y-2 text-xs">
        {RESEARCH_INTEGRITY_STAGES.map(stage => <li key={stage.title}>
          <b>{stage.title}</b> — {stage.detail}
        </li>)}
      </ol>

      <div>
        <h4 className="text-xs font-semibold">1. Submission screening</h4>
        <p className="text-xs">{record.screening.status.replaceAll('-', ' ')} — citation, sample, and artifact declarations.</p>
      </div>
      <div>
        <h4 className="text-xs font-semibold">2. Specialist adapter coverage — synthetic results</h4>
        <ul className="mt-1 space-y-1 text-xs text-slate-400">
          {record.coverage.map(c => <li key={c.tool}>{c.tool}: {c.status} · {c.version ?? 'no usable result'}</li>)}
        </ul>
        <p className="mt-1 text-xs text-slate-400">A clear tool result cannot cancel another check’s concern or missing evidence.</p>
      </div>
      <div>
        <h4 className="text-xs font-semibold">3. Combined investigation record</h4>
        <p className="break-all text-xs text-slate-400">Case: {record.id}</p>
        <ul className="mt-2 space-y-2">
          {record.findings.map(f => <li key={f.id} className="rounded border border-slate-700 p-2 text-xs">
            <p className="font-semibold">{f.id} · {f.kind} · {f.location}</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{f.evidence}</p>
            <p className="mt-1 text-slate-400">Source: {f.source}</p>
            <p className="mt-1 text-sky-200">Unresolved question: {f.question}</p>
          </li>)}
        </ul>
        {!record.findings.length && <p className="text-xs">No issue detected by these checks. Scientific validity remains unverified.</p>}
      </div>
      <div className="rounded border border-sky-900 p-2 text-xs">
        <h4 className="font-semibold">4. Editorial escalation</h4>
        {record.escalation ? <>
          <p>Assigned role: {record.escalation.assignee}. {record.escalation.reason}</p>
          <p>Publication hold: yes. Evidence and questions accompany this case.</p>
        </> : <p>No escalation triggered by the implemented checks. A clean screen does not authorize publication.</p>}
        <p className="mt-1 text-slate-400">This is an in-memory escalation packet; no editor has been notified.</p>
      </div>
      <div className="space-y-2 text-xs">
        <h4 className="font-semibold">5. Learn from a simulated investigation</h4>
        {record.findings.length ? <>
          <label htmlFor="research-finding" className="block">Finding to review</label>
          <select id="research-finding" className={`${btn} w-full`} value={findingId}
            onChange={e => { setFindingId(e.target.value); setReviewed(false); setProposal(null) }}>
            {record.findings.map(f => <option key={f.id} value={f.id}>{f.id} · {f.location}</option>)}
          </select>
          <label htmlFor="research-resolution" className="block">Simulated reviewer outcome</label>
          <select id="research-resolution" className={`${btn} w-full`} value={outcome}
            onChange={e => { setOutcome(e.target.value as EditorialResolution['outcome']); setReviewed(false); setProposal(null) }}>
            <option value="unresolved">Unresolved — more evidence needed</option>
            <option value="confirmed-discrepancy">Confirmed discrepancy — propose regression coverage</option>
            <option value="benign-explanation">Benign explanation — preserve contextual review</option>
          </select>
          <button className={btn} onClick={simulate}>Simulate reviewed outcome</button>
          {reviewed && <p role="status">{proposal
            ? 'Regression proposal created locally; independent review required. Policy unchanged.'
            : 'No regression proposal: the issue remains unresolved.'}</p>}
          {proposal && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-slate-400">{JSON.stringify(proposal, null, 2)}</pre>}
        </> : <p>No finding is available to resolve in this scenario. Try Combined investigation.</p>}
        <p className="text-slate-400">Proposals describe expected behaviour. They do not add tests, update policy, train a model, or label a paper as fraudulent.</p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { btn, card } from '../explain/ui'
import { RESEARCH_EVIDENCE, RESEARCH_POLICY } from './researchFixtures'
import { researchActionAllowed } from './researchIntegrity'
import ResearchWorkflowDemo from './ResearchWorkflowDemo'
import ResearchConfusionMatrix from './ResearchConfusionMatrix'
import { investigateResearch } from './researchWorkflow'
import { RESEARCH_RUN, WORKFLOW_CASES, specialistFixtures } from './researchWorkflowFixtures'

export default function ResearchIntegrityDemo() {
  const [selected, setSelected] = useState('consistent')
  const scenario = WORKFLOW_CASES.find(c => c.id === selected) ?? WORKFLOW_CASES[0]
  const specialistResults = specialistFixtures(scenario.manuscript.id, scenario.id)
  const record = investigateResearch(scenario.manuscript, RESEARCH_EVIDENCE, RESEARCH_POLICY, specialistResults, RESEARCH_RUN)
  const report = record.screening
  return (
    <div className={card}>
      <label htmlFor="research-case" className="block text-xs text-slate-300">Choose a synthetic submission</label>
      <select id="research-case" className={`${btn} mt-2 w-full`} value={selected}
        onChange={event => setSelected(event.target.value)}>
        {WORKFLOW_CASES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <button className={`${btn} mt-2`} onClick={() => setSelected('combined')}>Explore a combined investigation</button>
      <p className="mt-3 text-xs text-slate-400">{scenario.note}</p>
      <div className="mt-3" role="status" aria-live="polite">
        <p className="font-semibold text-sky-300">{record.status.replaceAll('-', ' ')}</p>
        <p className="text-xs text-slate-400">No automated publication decision. No misconduct verdict.</p>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Independent action boundary: publish = {researchActionAllowed('publish') ? 'allowed' : 'denied'};
        {' '}refer to editor = {researchActionAllowed('refer-to-editor') ? 'allowed' : 'denied'}.
      </p>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-sky-300">Inspect the submission, evidence, policy, and report</summary>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-slate-400">
          {JSON.stringify({ submission: scenario.manuscript, evidence: RESEARCH_EVIDENCE,
            policy: RESEARCH_POLICY, specialistResults, report, investigation: record }, null, 2)}
        </pre>
      </details>
      <ResearchWorkflowDemo key={scenario.id} record={record} />
      <ResearchConfusionMatrix />
    </div>
  )
}

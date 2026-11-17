// A model-independent teaching gate. Fixtures are synthetic; these checks cannot
// establish scientific truth or misconduct. Policy and evidence belong to the
// harness, never to the document being screened.
export interface Manuscript {
  id: string
  references: { doi: string; title: string }[]
  sample: { total: number; groups: number[]; partition: boolean }
  artifacts: string[]
}

export interface ResearchEvidence {
  snapshot: string
  source: string
  // A missing record is unknown, not proof that the DOI does not exist.
  references: Record<string, { title: string; retracted: boolean }>
}

export interface ResearchPolicy {
  version: string
  snapshot: string
  requiredArtifacts: string[]
}

export interface ResearchFinding {
  check: 'schema' | 'reference' | 'retraction' | 'sample' | 'artifact'
  kind: 'concern' | 'incomplete'
  location: string
  evidence: string
  nextStep: string
}

export interface ResearchReport {
  status: 'no-issue-detected' | 'review-required' | 'incomplete-screening'
  findings: ResearchFinding[]
  provenance: { manuscript: string; policy: string; snapshot: string; source: string } | null
  publicationAuthorized: false
}

const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0
const count = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0
const strings = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every(text) && new Set(x).size === x.length
const keys = (x: Record<string, unknown>, expected: string[]) =>
  Object.keys(x).length === expected.length && expected.every(k => Object.hasOwn(x, k))
const normalizeTitle = (x: string) => x.trim().replace(/\s+/g, ' ').toLowerCase()
const normalizeDoi = (x: string) => x.trim().toLowerCase().replace(/^(https?:\/\/doi\.org\/|doi:\s*)/, '')
const validDoi = (x: unknown): x is string => text(x) && /^10\.\d{4,9}\/\S+$/.test(normalizeDoi(x))

function manuscriptValid(x: unknown): x is Manuscript {
  if (!object(x) || !keys(x, ['id', 'references', 'sample', 'artifacts']) || !text(x.id)) return false
  if (!Array.isArray(x.references) || !x.references.every(r =>
    object(r) && keys(r, ['doi', 'title']) && validDoi(r.doi) && text(r.title))) return false
  const s = x.sample
  return object(s) && keys(s, ['total', 'groups', 'partition']) && count(s.total)
    && Array.isArray(s.groups) && s.groups.length > 0 && s.groups.every(count)
    && typeof s.partition === 'boolean' && strings(x.artifacts)
}

function evidenceValid(x: unknown): x is ResearchEvidence {
  return object(x) && text(x.snapshot) && text(x.source) && object(x.references)
    && Object.entries(x.references).every(([id, r]) => validDoi(id) && id === normalizeDoi(id)
      && object(r) && text(r.title) && typeof r.retracted === 'boolean')
}

function policyValid(x: unknown): x is ResearchPolicy {
  return object(x) && text(x.version) && text(x.snapshot) && strings(x.requiredArtifacts)
}

/** JSON-compatible data only. No model, network, file writes, or document instructions run here. */
export function screenResearch(input: unknown, evidence: unknown, policy: unknown): ResearchReport {
  const findings: ResearchFinding[] = []
  const add = (check: ResearchFinding['check'], kind: ResearchFinding['kind'], location: string,
    detail: string, nextStep: string) => findings.push({ check, kind, location, evidence: detail, nextStep })
  if (!manuscriptValid(input) || !evidenceValid(evidence) || !policyValid(policy)
    || evidence.snapshot !== policy.snapshot) {
    add('schema', 'incomplete', 'input', 'Invalid manuscript, evidence, policy, or snapshot mismatch.',
      'Correct the input or harness configuration and rerun all checks.')
    return { status: 'incomplete-screening', findings, provenance: null, publicationAuthorized: false }
  }
  if (input.references.length === 0) {
    add('reference', 'incomplete', 'references', 'No references supplied.',
      'Confirm whether this manuscript requires references.')
  }
  input.references.forEach((ref, index) => {
    const id = normalizeDoi(ref.doi)
    const location = `references[${index}]`
    const record = Object.hasOwn(evidence.references, id) ? evidence.references[id] : undefined
    if (!record) {
      add('reference', 'incomplete', location, `${id} is absent from snapshot ${evidence.snapshot}.`,
        'Verify against an authoritative registry; absence from this snapshot is not proof of fabrication.')
      return
    }
    if (normalizeTitle(ref.title) !== normalizeTitle(record.title)) {
      add('reference', 'concern', location, `Submitted title: ${ref.title}\nRegistry title: ${record.title}`,
        'Review the discrepancy; legitimate title variants are possible.')
    }
    if (record.retracted) {
      add('retraction', 'concern', location, `${id} is marked retracted in the supplied evidence.`,
        'Review citation context; discussing retracted work can be legitimate.')
    }
  })
  const { total, groups, partition } = input.sample
  const sum = groups.reduce((a, b) => a + b, 0)
  if (!partition || !Number.isSafeInteger(sum)) {
    add('sample', 'incomplete', 'sample', 'A safely checkable exhaustive, non-overlapping partition is unavailable.',
      'Establish the denominator and grouping relationship from the original study.')
  } else if (sum !== total) {
    add('sample', 'concern', 'sample', `Reported total ${total}; group counts sum to ${sum}.`,
      'Reconcile the counts with the supplied study data.')
  }
  for (const artifact of policy.requiredArtifacts) {
    if (!input.artifacts.includes(artifact)) {
      add('artifact', 'incomplete', 'artifacts', `Required artifact not listed: ${artifact}.`,
        'Request the artifact or an approved access exception. Listing an artifact does not verify its contents.')
    }
  }
  return {
    status: findings.some(f => f.kind === 'concern') ? 'review-required'
      : findings.length ? 'incomplete-screening' : 'no-issue-detected',
    findings,
    provenance: { manuscript: input.id, policy: policy.version, snapshot: evidence.snapshot, source: evidence.source },
    publicationAuthorized: false,
  }
}

// This is a screening report, never permission to publish or an accusation of fraud.
// Keep a downstream agent from promoting even a clean report into a publication decision.
export function researchActionAllowed(action: string): boolean {
  return action === 'request-evidence' || action === 'refer-to-editor'
}

# Research integrity: an independent screening gate

For the experiment's problem statement and interpretation, see the
[draft article](blog/research-integrity-experiment.md).

Try `harness.html?section=research-integrity`. This is a deterministic teaching
extension, not a scientific-validity or fraud detector. The ten scenarios are
handwritten synthetic submissions. No bundled model was trained to review papers,
and no model reads or judges the research in this demonstration.

## Behavioural contract

The harness supplies policy and an offline reference snapshot separately from the
submission. The gate returns a status, findings with locations/evidence/next steps,
and provenance identifying the manuscript, policy, source, and snapshot.

- `no-issue-detected`: implemented checks found no discrepancy; no truth guarantee.
- `review-required`: at least one concern needs contextual review. The report can
  also contain incomplete checks; reviewers must see all findings.
- `incomplete-screening`: verification cannot be completed with the supplied inputs.

Malformed inputs fail closed with an incomplete result and no verified provenance.
Document text cannot override policy. Missing snapshot records are unverified,
not evidence of nonexistent publications. Retraction flags require contextual
review: legitimate scholarship can discuss retracted work.

The action allowlist demonstrates a separate boundary: only `request-evidence`
and `refer-to-editor` are allowed. Publication, rejection, deletion, and unknown
actions are denied. It performs no actions and is not wired to a live dispatcher.
Any future dispatcher must consult and enforce its authorization boundary before
effects occur. Every screening report has `publicationAuthorized: false`.

## What the gate checks

1. Strict runtime validation of the structured submission, policy, and evidence.
2. DOI/title agreement with a supplied reference snapshot and retraction flags.
3. Group counts against a declared total, only for a declared exhaustive,
   non-overlapping partition and safe integer arithmetic.
4. Presence of required artifact names in the submission's declaration.

## Important blind spots

Snapshot IDs and source labels are not authentication. This teaching code does not
fetch or authenticate registries, enforce freshness, extract PDFs, validate images,
verify that references support claims, inspect artifacts, reproduce statistics,
or establish authorship/ethics approval. A listed dataset might not exist.
Internally consistent invented data can pass: a test explicitly preserves that
limitation rather than overstating the gate's capability. The group partition is
also an unverified declaration. A production extraction step must reconcile it
with the original paper.

Use JSON-compatible data at the boundary. Production requires input limits,
authenticated evidence adapters, protected policy, audit records, and an editor-owned
resolution workflow. Do not give document authors access to trusted configuration.
This is an offline demonstration and makes no real-world detection-rate claims.

## Proposed research-integrity workflow

The demo extends screening into a five-stage publishing workflow; see
`research-integrity-proposal.md` for the product rationale and pilot plan.
Choose **Combined investigation** to see one sample-count discrepancy alongside
synthetic image, statistical, and provenance signals. Choose **Specialist service
unavailable** to see why other clear results cannot compensate for a missing check.

`researchWorkflow.ts` accepts adapter results through a typed, runtime-validated
contract. Exactly one result from each required tool is needed. The submission ID
and screening-run ID must match the current case. Invalid envelopes, duplicate
results, unknown tools, missing evidence, and mismatched runs cannot produce a clean
result. A malformed envelope makes all specialist coverage unavailable; valid
concerns elsewhere in the submission remain recorded.

Each combined finding retains its source, location, evidence, unresolved question,
and local finding ID. Escalation packets specify a research-integrity specialist,
all outstanding questions, and a publication hold. They are in-memory objects;
no notification, persistence, rejection, or publication operation is implemented.

Image, statistical, and provenance outputs are handwritten fixtures, not executed
detectors. Matching run IDs prevents accidental mixing of inputs; it does not
authenticate a detector or prevent a trusted caller from forging its output.
Production adapters must bind results to immutable manuscript/data versions, not
just reusable submission IDs, and implement source authentication and freshness.

The simulated reviewer can mark a finding as unresolved, a confirmed discrepancy,
or a benign explanation. Supported, resolved findings produce a regression
**proposal** with the source case, finding, reviewer, rationale, and evidence
reference. An independent reviewer must approve and implement any new test or rule.
The function never updates policy, relabels a paper as fraudulent, rewrites the
original case, or authenticates a reviewer. Benign outcomes preserve contextual
review; they do not teach that every image match or retracted citation is improper.

## Automated and manual verification

```sh
npm test -- src/harness/__tests__/researchIntegrity.test.ts
npm test -- src/harness/__tests__/researchWorkflow.test.ts
npm test
npm run build
```

The 92 research-integrity Vitest cases cover fixture routing, evidence provenance, benign metadata
normalization, contextual retraction handling, absent sources, invalid types,
overflow, schema failures, injected instructions, immutable inputs, prohibited
actions, specialist-result correlation, unavailable tools, combined escalation,
editorial outcome proposals, immutable case history, and server-rendered UI. They test screening behaviour, not fraud-detection
accuracy. The component is separate from page prose; it is not added to the embed registry.

In a browser, switch among all ten scenarios. Verify clean, review, and incomplete
states, inspect the evidence JSON, and confirm that publication remains denied.
Select **Combined investigation**, review all four findings, and simulate each
editorial outcome. Unresolved findings must produce no regression proposal;
supported resolutions produce a proposal requiring independent review. Changing
the scenario resets the reviewer simulation and proposal.
The demo currently follows the harness page's existing bundled-model loading condition.

## Synthetic confusion matrix

The demo now includes a submission-level benchmark of 11 hand-authored cases: the
ten walkthrough scenarios plus a fabricated-but-internally-consistent case. Labels
are stipulated independently by the case author and never passed to the gate.
This is a teaching benchmark, not an independently adjudicated research dataset.

Actual positive means a substantive discrepancy is stipulated in the case. Predicted
positive means `review-required`; predicted negative means `no-issue-detected`.
Neither is a misconduct verdict. `incomplete-screening` is an abstention, never a
true negative. Unknown truth labels are also excluded from binary scoring.

| Synthetic actual class | Flagged for review (+) | No issue detected (-) |
| --- | --- | --- |
| Substantive discrepancy (+) | TP = 3 | FN = 1 |
| No substantive discrepancy (-) | FP = 2 | TN = 1 |

Seven of 11 cases are scored (63.6% scoring coverage). Four are incomplete and
excluded; three of those four also have unknown labels. The remaining abstention
is a known-benign control with a simulated detector outage. Categories overlap
and must not be added together. There are no known-positive abstentions in this
particular fixture set; that count is exposed for future cases.

The two false positives are stipulated legitimate retracted-work discussion and
disclosed image reuse. A flag can be reasonable before that editorial context is
known. The false negative is fabricated underlying data whose visible declarations
and simulated tool results are internally consistent. This is a deliberate blind
spot, not a real-world fraud-detection experiment.

All metrics are conditional on scored cases: precision 60.0%, recall 75.0%,
specificity 33.3%, F1 66.7%, and accuracy 57.1%. Formulas are TP/(TP+FP),
TP/(TP+FN), TN/(TN+FP), 2TP/(2TP+FP+FN), and (TP+TN)/scored respectively.
Undefined denominators return null and display as N/A, not 0% or 100%.
Per-case labels, rationales, predictions, and classifications are inspectable in
the demo. Test counts (92 engineering tests) are not benchmark sample counts.

## Evaluation before extending to real submissions

- Build an authorized, de-identified corpus with independently adjudicated labels.
  Include legitimate unusual papers, metadata variants, legitimate citations of
  retracted work, data-access restrictions, and unresolved cases. Retraction alone
  is not a fraud label; absence of retraction is not a verified negative label.
- Hold out related paper families together and retain a protected evaluation set.
- Measure issue-level precision/recall, false alarms, incomplete screening, evidence
  accuracy, escalation volume, and human review time. Report denominators and
  uncertainty by check and discipline.
- Compare baseline harness versus candidate on identical tasks, evidence, tool/model
  versions, budgets, and clean starting states. Repeat stochastic upstream agent
  runs. Include unrelated tasks and inspect traces and resulting state.
- Protect graders and reference evidence from candidate writes. Set acceptable
  regression, latency, and review-workload thresholds before examining results.
- Test source outages, stale evidence, conflicting adapter outputs, unauthorized
  actions, and recovery after editorial resolution when those integrations exist.
- Start in shadow mode alongside editorial review. Keep a feature-disable rollback
  path. No finite test suite proves that fabricated research will always be caught.

Existing activation/input checks remain the responsibility of the harness's Gate 1;
this contribution concerns selected-skill behaviour and independent evidence checks.

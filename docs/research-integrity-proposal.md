# Research integrity: a five-stage publishing workflow

Companion [draft article: A research paper can pass every check—and still be fabricated](blog/research-integrity-experiment.md).

## Problem statement

The problem is how to identify and investigate potentially unreliable research
using evidence that editorial specialists can inspect. A convincing manuscript
or AI-generated review can conceal citation discrepancies, conflicting participant
counts, unexplained image reuse, irreproducible results, or missing data provenance.
A paper can also be internally consistent while its underlying data are fabricated.

Individual signals require context. An image match may be legitimate reuse, and a
retracted reference may be cited in a valid critique. Treating every flag as proof
of misconduct creates false accusations; treating an unavailable check as a pass
allows unverified work to advance. Checking every action manually can also consume
the attention specialists need for difficult investigations.

The design challenge is therefore to combine independent checks into an actionable
case: what was checked, against which evidence, where a discrepancy occurs, what
remains unknown, and which human decision is needed. Evaluation must expose missed
issues, false alarms, and incomplete screening separately.

## Proposed solution

Add an independent research-integrity gate around the agent workflow. The agent
organizes the review; harness-owned policy and evidence checks determine the
screening result. The five stages are:

1. **Screen submissions:** compare citation metadata, reconcile participant counts,
   and identify missing evidence declarations.
2. **Connect specialist tools:** receive image, statistical, and provenance results
   through validated adapters bound to the submission and screening run. Missing,
   duplicate, malformed, or mismatched results keep verification incomplete.
3. **Combine evidence:** retain each finding's source, location, evidence, and
   unresolved question in one traceable investigation record.
4. **Escalate concerns:** prepare an evidence packet for a research-integrity
   specialist, with a publication hold for unresolved or incomplete screening.
   The specialist evaluates explanations and determines the appropriate response.
5. **Learn from investigations:** turn supported editorial outcomes into regression
   proposals. Require independent approval before adding executable tests or
   changing policy; preserve benign examples to guard against false alarms.

The current implementation demonstrates this workflow with synthetic submissions,
simulated specialist results, and an in-memory case record. A confusion matrix
reports TP, FP, TN, and FN against separately stipulated synthetic labels; incomplete
cases remain visible outside binary scoring. It does not automatically publish,
reject, determine misconduct, or update its own rules.

The intended benefit is more consistent verification and better-focused human
investigation. Establish that benefit through an authorized shadow pilot measuring
evidence accuracy, missed issues, false alarms, review effort, and escalation load
before connecting the design to operational editorial decisions.

This is an illustrative research-integrity proposal for discussion, with no
production deployment or assessment of any publisher's current systems.
It demonstrates coordination and traceability, not an ability to determine
scientific truth or intent to deceive.

## Example: medical research and a clinical trial

Consider a **fictional** manuscript claiming that Treatment A reduces hospital
admissions compared with usual care. The paper says 240 participants were randomized,
but its two stated exhaustive treatment groups contain 110 participants each.
Its trial-registration record names hospital admissions as the primary outcome,
while the manuscript presents a laboratory marker as the primary outcome. The
dataset version named in the paper also differs from the supplied repository record.
These details are invented to illustrate the workflow; they describe no actual
treatment, patient, researcher, or publication.

| Stage | Application to the hypothetical trial |
| --- | --- |
| Screen submissions | Flag the difference between 240 randomized participants and the 220 accounted for in the stated groups; identify missing participant-flow explanations and supporting evidence |
| Connect specialist tools | A future trial-registry adapter compares registered outcomes and dated amendments; a statistical tool checks reported results against authorized data and analysis code; a provenance tool checks exact dataset versions |
| Combine evidence | Record the affected participant table, registry entry/version, analysis result, and dataset manifest, with a separate unresolved question for each |
| Escalate concerns | Ask an editorial specialist and appropriate clinical/statistical reviewers to reconcile participant flow, explain the outcome change, and identify the data actually analyzed |
| Learn from investigations | A confirmed discrepancy becomes a proposed regression case; a justified amendment or valid denominator explanation becomes a control that protects against false alarms |

The system must ask questions rather than declare the trial fraudulent. Counts
may reflect different populations, outcome changes may have documented amendments,
and data access may be restricted for legitimate privacy reasons. Reviewers need
the original protocol, participant-flow explanation, amendment history, and
authorized supporting evidence. When these are unavailable, screening remains
incomplete. A registration match or internally consistent table does not establish
that the underlying observations are genuine.

### Why this matters in medicine

Clinical research contributes to decisions about patient care, treatment benefits
and harms, and health policy. Missing or selectively reported results can distort
the evidence available for those decisions. WHO emphasizes trial registration
and complete results reporting as ways to improve transparency and reduce
selective reporting. [WHO: Public disclosure of clinical trial results](https://www.who.int/tools/clinical-trials-registry-platform/reporting-on-findings).

For this proposed workflow, the practical goal is to identify evidence gaps before
unsupported conclusions influence later reviews or decisions, while keeping
clinical interpretation and editorial accountability with qualified people.
False alarms matter too: an unexplained signal can consume reviewer time or
unfairly cast doubt on legitimate work. Both missed issues and unnecessary
escalations therefore belong in the evaluation.

This medical example is documentation of a **potential application**, not a new
executed detector or a scored benchmark case. The current implementation does
not connect to trial registries, inspect patient data, reproduce clinical analyses,
or make treatment recommendations. The existing 11-case synthetic benchmark and
its confusion-matrix counts are unchanged.

## Five-stage walkthrough

| Stage | Demonstrated behaviour | Potential operational extension |
| --- | --- | --- |
| Screen submissions | Compare citation metadata, reconcile declared participant counts, and require evidence declarations | Parse manuscripts and verify extracted statements against original documents and authoritative registries |
| Connect specialist tools | Validate synthetic image, statistical, and provenance results; retain outages and mismatches as incomplete | Connect approved specialist detectors, reproducible analyses, and authenticated repository evidence |
| Combine evidence | Keep related findings in a single case, each with its location, source, evidence, and question | Correlate authorized cross-submission evidence with access controls and an audit trail |
| Escalate concerns | Produce an editorial packet naming the reviewing role and outstanding questions; retain a publication hold | Integrate with editorial case management and a documented author-response process |
| Learn from investigations | Convert simulated confirmed discrepancies and benign explanations into reviewable regression proposals | Have independent reviewers approve executable tests, suitable controls, and versioned policy changes |

## Presentation script

1. Open `harness.html?section=research-integrity`. Explain that all papers and
   specialist outputs in the demo are synthetic; no research detector is running.
2. Start with **Consistent declarations**. Show that a clean screen still does
   not verify scientific validity or authorize publication.
3. Select **Combined investigation**. One case now contains a participant-count
   discrepancy, an image-similarity signal, a statistical reproducibility signal,
   and a dataset-version discrepancy. Inspect each source and unresolved question.
4. Read the escalation packet. It gives a specialist actionable evidence, without
   treating several correlated signals as proof of misconduct or an additive fraud score.
5. Select a finding and simulate **Confirmed discrepancy**. The local regression
   proposal identifies the case, rationale, and evidence and requires independent review.
6. Try **Benign explanation** and **Unresolved**. The first preserves contextual
   review; the second produces no learning proposal. Neither overwrites case history.
7. Choose **Specialist service unavailable**. The outage remains incomplete despite
   other clear checks. A missing result cannot silently become a passed check.
8. Inspect the **Synthetic benchmark confusion matrix**. It reports TP, FP, TN,
   and FN from actual gate outputs on 11 independently labelled synthetic cases.
   Seven receive binary scores; four remain incomplete. Inspect the benign-reuse
   false alarms and the fabricated-but-consistent false negative, and distinguish
   this demonstration from measured performance on real papers.

## What would demonstrate value

Run a shadow pilot on authorized, de-identified, independently reviewed papers;
leave editorial decisions with the existing process. Include legitimate unusual
research, unresolved cases, and papers with confirmed discrepancies. Distinguish
errors from misconduct and weak methodology from fabricated data.

Compare screening plus the evidence packet with the existing review workflow.
Measure issue-level recall and precision, false alarms, incomplete-screening rate,
evidence accuracy, investigator time per resolved case, and total escalation load.
Report uncertainty and results by discipline and check, not just a headline average.
Set acceptance thresholds before evaluating a protected held-out set.

## Operational prerequisites

Authenticate evidence providers; bind results to exact manuscript and data versions;
protect policy and graders from document content; enforce freshness and permissions;
retain an audit trail; establish editorial resolution and author-response procedures.
Add privacy controls before handling confidential manuscripts. A reviewer name in
a payload is not authenticated editorial authority.

The first proposed merge is an offline educational example. Real detection adapters,
manuscript parsing, scientific validation, case persistence, notifications, approved
learning changes, and operational validation remain follow-on work.

# A research paper can pass every check—and still be fabricated

**Draft article — synthetic educational experiment.** No real papers were assessed;
specialist detector outputs are simulated. This is not a clinical validation study
or evidence of real-world fraud-detection performance.

That uncomfortable limit is deliberately included in a small research-integrity
experiment we added to Greg's JabberLM project.

In one synthetic case, the case author stipulates fabricated underlying data.
That fact is withheld from the screening system. The participant counts add up.
Citation metadata matches the supplied reference snapshot. The required data
declaration is present. Simulated specialist tools report no concerns.

The gate returns: **No issue detected.**

The experiment exposes a boundary: checking consistency cannot establish authenticity.

## The problem we wanted to explore

How can an AI-assisted review process identify questionable research, preserve
the supporting evidence, and focus expert attention where investigation is needed?

In medicine, that question matters because research contributes to assessments of
treatment benefits and harms. WHO identifies trial registration and complete
results reporting as important measures for transparency and reducing selective
reporting. [WHO: Public disclosure of clinical trial results](https://www.who.int/tools/clinical-trials-registry-platform/reporting-on-findings).

Consider a fictional clinical-trial manuscript. It reports 240 randomized
participants, but its stated exhaustive groups account for only 220. Its published
primary outcome differs from the registered outcome. Its declared dataset version
differs from the supplied repository record.

There may be legitimate explanations. Different analysis populations, documented
amendments, or a version-label error could explain the discrepancies.

The useful output is therefore an evidence-backed question: **what explains the
difference, and what would resolve it?**

This clinical-trial example illustrates a possible extension. It is documented in
the [proposal](../research-integrity-proposal.md); it is not one of the executed
benchmark cases and does not add a trial-registry or clinical-analysis capability.

## What we built

Inspired by Greg's independent-checking approach, we added a research-integrity
demonstration to JabberLM at `harness.html?section=research-integrity`.

It screens structured submissions, validates specialist-result inputs, combines
findings into one investigation record, and prepares an editorial escalation
packet. Each finding retains its location, source, evidence, and unresolved question.

A simulated editorial resolution can produce a regression-test proposal requiring
independent approval. It cannot silently rewrite the rules.

The basic citation-metadata and participant-count checks run in code. Image,
statistical, and provenance detector outputs are handwritten fixtures. No model
reads real papers or decides scientific validity here. Escalation packets and
regression proposals remain in memory: no editor is notified, no policy is updated,
and no manuscript is published or rejected.

## Why we included false alarms and missed problems

The submission-level synthetic benchmark contains 11 hand-authored cases. Labels
are specified separately from the gate's predictions. Seven cases receive binary
scores:

| Actual synthetic class | Flagged for review | No issue detected |
| --- | --- | --- |
| Substantive discrepancy | TP: 3 | FN: 1 |
| No substantive discrepancy | FP: 2 | TN: 1 |

The three true positives are correctly flagged substantive discrepancies. The two
false positives are stipulated legitimate discussion of retracted work and disclosed
image reuse. The true negative is a benign control. The false negative is the
fabricated-but-internally-consistent case described above.

Four cases remain incomplete and outside the binary matrix. They are never counted
as true negatives; three also have unknown ground-truth labels. Metrics on the
seven scored cases therefore describe conditional performance at 7/11 scoring
coverage, not complete verification of all submissions.

These are illustrative results from handwritten fixtures, not estimates of
performance on real research. The benchmark stipulates case truth; no independent
expert panel has adjudicated real papers.

It also exposes a distinction that matters operationally: a false positive against
the final case label may still have been a reasonable request for context before
investigation.

## What the experiment actually demonstrates

An independent gate can enforce a verification process, preserve evidence, and
make uncertainty visible. It cannot establish that observations were genuinely
collected merely because their reported numbers agree.

A useful research-integrity system needs trusted external evidence, specialist
tools, qualified investigation, and evaluation that measures both missed problems
and unnecessary escalations.

The next experiment should test whether the evidence packet helps specialists
resolve concerns faster and more accurately on authorized, independently reviewed
research. A shadow pilot should measure evidence accuracy, missed issues, false
alarms, and investigator workload while leaving editorial decisions with people.

The question is whether the system gives them better grounds for deciding what to trust.

For implementation details and evaluation limits, see the
[technical documentation](../research-integrity.md).

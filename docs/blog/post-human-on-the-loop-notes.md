# Notes: "Human on the loop, not in it" (dispatch, drafted 14 Nov 2026)

## What was built for it

- **`src/data/policy.ts`** is a pure, Dogwood-style policy gate: typed actions, forbid rules
  (schema, stateless, history), and ALLOW/DENY before the action runs.
  - Warehouse: six rules.
  - Harness: two rules, scope and provenance.
- **`capstone.html?section=policy`** (`PolicyGate.tsx`) runs the shipped warehouse agent through
  the gate on all 83 orders. It has these controls:
  - one or five tries per order;
  - strict or lax reading of the model's output;
  - an escalation queue, the action-by-action view, and rule hit counts.
- **`harness.html?section=injection`** gets a third card: the naive loop with the gate in front.
- **Tests** are in `src/data/__tests__/policy.test.ts`. The reference planner passes on all 83
  orders (the anchor), each rule fires on its mistake, and `MEASURED.policyGate` is reproduced on
  the shipped weights. The injection gate stops all three attacks and leaves the honest job alone.
- **Glossary:** `policy-gate`. **Measurement script:** `scripts/measure-policy-gate.ts`.

## Every number, and where it came from

| claim | value | source |
|---|---|---|
| ~25,000 parameters | 24,896 | `BUNDLES.warehouse.params` |
| ~90% of unseen orders | 90%, n = 16 | `MEASURED.warehouseHeldOut` |
| 83 possible orders | 83 | `allBaskets()` |
| 291 approvals in the loop | 291 actions, greedy | `MEASURED.policyGate.actions` |
| 4 escalations | 4 (in-order 1, schema 1, padding 2) | measure script, greedy, strict |
| none wrong through, none stopped by mistake | 0 / 0 | same, checked against `warehouseReward` |
| 7 walked further | 7 of 79 completed, `extraTiles > 0` | same |
| the `pak1` slip | sampled, temp 0.8, ×5, RNG 7: lax lets 1 of 415 through, strict 0 (41 escalated) | `MEASURED.policyGate.sampled` |
| injection: all three attacks stopped | scope (`max 1 1 1`), provenance (`… sum 9 9 9`, `9 9 9`) | test + measure script |
| filtering misses the planted number | the sanitised loop still calls `reverse(9 9 9)` | measure script |
| 57.6% → 0.2%, 79.1% → 60.9% | trace failures; fulfilment | Millstone et al., arXiv 2608.27646 (27 Aug 2026) |
| Dogwood: Aug, history rules, not proved, multi-agent on the roadmap | | AWS blog, 6 Aug 2026; InfoQ, 16 Aug |
| "fake doctor's note" | quoted from AWS's docs | Bedrock Automated Reasoning checks docs |
| "only if approved in the last hour" | paraphrase of the `formerly within 1h … ApproveSale` example | AWS Dogwood blog |

Sources are in `docs/blog/research-automated-reasoning.md`.

## Things to check

1. **[YOUR STORY]** The opening uses the plant-interlock analogy generically. You are the
   chemical engineer: a real trip you saw would beat it. Check the analogy matches your
   experience. I describe a safety instrumented system that is independent of the basic process
   control system, which is how IEC 61511 frames it.
2. **"most of the agent demos I see don't have it"** is written as your opinion. Keep it only if
   it is.
3. **"AWS has been pushing this hard"** is characterisation, not a sourced claim. Byron Cook's
   interviews and the VentureBeat piece support it loosely. Soften it if you want.
4. **Dogwood example wording.** In AWS's example, `ApproveSale` is a tool response, not
   necessarily a person, so the post says "the sale was approved", not "a person approved it".
5. **Disclosure.** As with the citation dispatch: if you work with AWS, or sell anything in agent
   governance, add a line.

## First comment

> The policy gate: https://jabberlm.com/capstone?section=policy
> Flip to "five (sampled)" and "lax parser" to see the typo get through.
> The hijack, with and without the gate: https://jabberlm.com/harness?section=injection

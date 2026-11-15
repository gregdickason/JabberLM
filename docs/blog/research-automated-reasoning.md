# Automated reasoning, Dogwood, and checking the agent (research, 13 Nov 2026)

## What AWS actually has: two different things

**1. Automated Reasoning checks** (Bedrock Guardrails, GA 2025). These check **text**.
- You upload a policy document and LLMs extract variables and rules into formal logic, with a
  fidelity report.
- At runtime, LLMs translate a prompt and response into that logic, and a solver returns
  findings: VALID, INVALID, SATISFIABLE, IMPOSSIBLE, TRANSLATION_AMBIGUOUS, TOO_COMPLEX and
  NO_TRANSLATIONS.
- It runs in detect mode only, so it never blocks.

AWS's own documented limits:
- "A VALID result guarantees validity only for the parts of the input captured through policy
  variables." Their example: a fake doctor's note can be VALID if no variable captures fakeness.
- Accuracy "depends on how well natural language … can be translated", and that translation is
  done by foundation models.
- It has no prompt-injection protection, and English only.

Source: https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-automated-reasoning-checks.html

**2. AgentCore Policy + Cedar + Dogwood.** These check **actions**: typed tool calls at the
gateway, outside the agent's code.
- **AgentCore Policy** (re:Invent 2025) decides ALLOW or DENY on every agent-to-tool call.
  Policies are written in Cedar, which can be drafted from natural language by an LLM. Cedar
  Analysis then checks the draft for being over-permissive or over-restrictive against a schema
  built from the gateway's tool definitions.
  - Docs: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.md
  - Why Cedar: https://aws.amazon.com/blogs/security/why-policy-in-amazon-bedrock-agentcore-chose-cedar-for-securing-agentic-workflows/
- **Dogwood** (open-sourced 6 Aug 2026; Brooker, Tassarotti, Tristan) extends Cedar with
  temporal conditions over the agent's event history:
  - `formerly within 1h …`, `count_within`, `count_distinct_within` and `sum_within`;
  - it lowers to Cedar, with the temporal facts filled into `context.*` slots at runtime;
  - its basis is Metric First-Order Temporal Logic.
  - Blog: https://aws.amazon.com/blogs/opensource/introducing-dogwood-runtime-verification-for-ai-agents/
  - Repo: https://github.com/dogwood-policy/dogwood (created 27 Jul 2026)
  - Coverage: https://www.infoq.com/news/2026/08/aws-dogwood-agent-policy/

  README example:

  ```
  permit(principal, action, resource)
  when { context.input.amount < 1000 }
  when formerly within 1h {
      Action::"Approve"::request{ approver: context.input.approver }
  };
  ```

  The caveats, which matter for any post:
  - **Temporal conditions do not get Cedar's automated-reasoning analysis** (InfoQ). The
    stateless part stays analysable; the history part is runtime-checked, not proved.
  - The reference interpreter is "NOT intended for production use".
  - Multi-agent orchestration policies (handoffs, locks), liveness and absolute-time windows are
    **roadmap**, not shipped.
  - AWS is not accepting contributions yet.

So "automated reasoning as the backbone of multi-agent control" is AWS's stated direction. Today
it is per-call authorisation with provable stateless policies, plus history rules that are
checked rather than proved.

## Independent evidence for checking out of band

Millstone, Akidau, Brüderl, Pekker, *If Agents Were Angels, No Governance Would Be Necessary:
Out-of-Band Policy Enforcement at a Trusted Tool Boundary*, arXiv 2608.27646 (27 Aug 2026).
- **Setup:** a typed Cedar core, Jira/ServiceNow mocks, 4 models, 20 adaptive red-team tasks and
  3,621 trials.
- **Trace failures fell from 57.6% to 0.2%.** Fulfilment fell from 79.1% to 60.9%. Paired
  safe-useful completion rose 21.8 points.
- **The authors' own limits:**
  - some answers reconstructed values that never entered context;
  - row counts leaked as an oracle;
  - write controls, durable approval and temporal policies were not evaluated.

The fall in fulfilment is the honest cost: a boundary that says no also stops some legitimate
work.

## Spike: a Dogwood-style gate on the warehouse agent

Script: `policy-spike.ts` in the session scratchpad, not committed. It runs the shipped
`warehouse-model.json` on all 83 baskets and gates each action **before it executes**, using the
rules below.

| rule type | rule |
|---|---|
| stateless | `get X` only if X is in the order |
| stateless | pad iff fragile and heavy in the order |
| stateless | box 2 iff chemical and food in the order |
| history (count) | no more `get X` than ordered |
| history (formerly) | `done` only after every ordered item has been fetched |

| decoding | runs | correct | denied (escalated) | passed and wrong |
|---|---|---|---|---|
| greedy | 83 | 79 | **4** | 0 |
| sampled, temp 0.8, ×5 | 415 | 374 | **40** | **1** |

Denial reasons when sampled:
- not in the order: 19
- already fetched, a history count: 12
- missing pad: 6
- `done` too early, a history rule: 2
- wrong box: 1

**The one that slipped through** was `get B pak1`, a malformed token. My gate parsed anything
that wasn't `pack2` as box 1, so a typo was read as a legal action. That is a bug in the
translation from model output to policy input, not in the policy. Dogwood validates actions
against a schema for exactly this reason, and AWS's text checks carry the same weak link
(TRANSLATION_AMBIGUOUS). Keep this in the demo; it is the best lesson in the spike.

The policy is **silent on efficiency**: passed plans still waste 0.3–0.4 tiles on average. That
is the "legal but worse" class the site already names (`CLAUDE.md`, the Jev typed-decisions
argument). No policy can exclude it; it belongs to outcome metrics, the human on the loop.

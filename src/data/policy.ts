// A policy gate at the tool boundary — pure, deterministic, browser-shippable.
//
// The idea comes from AWS's AgentCore Policy and its open-source language Dogwood (Aug 2026):
// every action an agent takes is a typed request, and a check that runs OUTSIDE the model
// decides ALLOW or DENY before the action executes. Cedar rules look at one request; Dogwood
// adds rules that look back over the agent's event history ("approved within the last hour",
// "no more than five transfers"). The model never sees the policy and cannot argue with it.
//
// This is a teaching sketch of that shape, NOT Dogwood: rules here are TypeScript predicates,
// and the `source` strings are Dogwood-STYLE renderings for display only (they are not valid
// Dogwood). Three simplifications, each stated on the page:
//   • forbid-only. Cedar is deny-by-default with explicit permits; here a schema-valid action
//     is allowed unless some rule forbids it, which is the same decision for these small rule
//     sets and far easier to read.
//   • the history is the run's own events, not a time window.
//   • nothing is formally analysed. Cedar's stateless rules can be; Dogwood's history rules
//     cannot (AWS says so), and neither can a TypeScript function.
//
// The lesson the demos are built around is which failures a gate can and cannot catch:
// MALFORMED (the schema — but only if the reading of the model's output is strict),
// NOT ALLOWED (the rules), and ALLOWED-BUT-WORSE (nothing here; that is outcome metrics and
// the human on the loop).

import { padFor, boxFor, SKUS, warehouseReward, extraTiles, type Basket } from './warehouse'
import { TOOLS, type ToolName } from './harnessTasks'

export type RuleKind = 'schema' | 'stateless' | 'history'

/** One typed action the agent asks to take (or, for the harness, a tool response the gateway
 *  recorded). `input` holds its arguments. */
export interface ActionEvent {
  action: string
  input: Record<string, string | number | boolean>
}

export interface PolicyRule<C> {
  id: string
  kind: RuleKind
  /** One-line plain-English statement of the rule. */
  label: string
  /** A Dogwood-style rendering for display. Not valid Dogwood. */
  source: string
  /** Return a reason to FORBID this event, or null to let it through. */
  check: (ev: ActionEvent, history: ActionEvent[], ctx: C) => string | null
}

export type Verdict =
  | { allow: true }
  | { allow: false; rule: string; kind: RuleKind; reason: string }

/** Evaluate every rule against one event. Any forbid wins; the first one found is reported.
 *  Rules are checked in the order given, which callers keep as schema → stateless → history. */
export function decide<C>(rules: PolicyRule<C>[], ev: ActionEvent, history: ActionEvent[], ctx: C): Verdict {
  for (const r of rules) {
    const reason = r.check(ev, history, ctx)
    if (reason) return { allow: false, rule: r.id, kind: r.kind, reason }
  }
  return { allow: true }
}

// ---------------------------------------------------------------------------------------
// Warehouse: each `get <SKU> [pad] pack<1|2>` is one `pick` action; `done` closes the order.
// The policy reads the CATALOGUE (which items are fragile, heavy, food, chemical) — the very
// thing the model was never shown and had to infer. The check consults the ground truth, not
// the model's opinion of it.
// ---------------------------------------------------------------------------------------

export interface WareCtx {
  order: Basket // sorted SKUs, with repeats
}

/** How strictly the gate reads the model's text into typed actions.
 *  strict — every token must fit the schema; anything else becomes a `malformed` action.
 *  lax    — a forgiving reader: unknown tokens are skipped and any box token that is not
 *           exactly `pack2` counts as box 1. This is the bug a hand-rolled parser invites,
 *           and it lets a typo such as `pak1` through as a legal action. */
export type ReadMode = 'strict' | 'lax'

export function readWarehouseActions(text: string, mode: ReadMode): ActionEvent[] {
  const toks = text.trim().split(/\s+/).filter(Boolean)
  const out: ActionEvent[] = []
  let i = 0
  while (i < toks.length) {
    const t = toks[i]
    if (t === 'done') {
      out.push({ action: 'done', input: {} })
      return out
    }
    if (t !== 'get') {
      if (mode === 'lax') { i++; continue }
      out.push({ action: 'malformed', input: { text: toks.slice(i, i + 3).join(' ') } })
      return out
    }
    const sku = toks[i + 1] ?? ''
    let j = i + 2
    const pad = toks[j] === 'pad'
    if (pad) j++
    const boxTok = toks[j] ?? ''
    if (mode === 'strict') {
      const validSku = (SKUS as readonly string[]).includes(sku)
      if (!validSku || (boxTok !== 'pack1' && boxTok !== 'pack2')) {
        out.push({ action: 'malformed', input: { text: toks.slice(i, j + 1).join(' ') } })
        return out
      }
    }
    out.push({ action: 'pick', input: { sku, pad, box: boxTok === 'pack2' ? 2 : 1 } })
    i = j + 1
  }
  return out
}

const fetched = (history: ActionEvent[]) =>
  history.filter((h) => h.action === 'pick').map((h) => String(h.input.sku))

export const WAREHOUSE_RULES: PolicyRule<WareCtx>[] = [
  {
    id: 'schema',
    kind: 'schema',
    label: 'every action must be a well-formed pick or done',
    source: `// enforced by the action schema, before any rule runs
action pick { sku: SKU, pad: Bool, box: 1 | 2 }
action done {}`,
    check: (ev) => (ev.action === 'malformed' ? `"${ev.input.text}" is not a valid action` : null),
  },
  {
    id: 'in-order',
    kind: 'stateless',
    label: 'only pick items that are in the order',
    source: `forbid (principal, action == Action::"pick", resource)
unless { context.order.contains(context.input.sku) };`,
    check: (ev, _h, ctx) =>
      ev.action === 'pick' && !ctx.order.includes(String(ev.input.sku))
        ? `${ev.input.sku} is not in the order`
        : null,
  },
  {
    id: 'padding',
    kind: 'stateless',
    label: 'pad a fragile item exactly when something heavy is in the order',
    source: `forbid (principal, action == Action::"pick", resource)
when { context.input.pad !=
       (catalogue[context.input.sku].fragile && context.order.hasHeavy) };`,
    check: (ev, _h, ctx) => {
      if (ev.action !== 'pick') return null
      const want = padFor(String(ev.input.sku), ctx.order)
      if (ev.input.pad === want) return null
      return want ? `${ev.input.sku} is fragile and the order has something heavy: it must be padded` : `${ev.input.sku} does not need padding`
    },
  },
  {
    id: 'segregation',
    kind: 'stateless',
    label: 'a chemical goes in box 2 exactly when food is in the order',
    source: `forbid (principal, action == Action::"pick", resource)
when { context.input.box !=
       (catalogue[context.input.sku].chemical && context.order.hasFood ? 2 : 1) };`,
    check: (ev, _h, ctx) => {
      if (ev.action !== 'pick') return null
      const want = boxFor(String(ev.input.sku), ctx.order)
      return ev.input.box === want ? null : `${ev.input.sku} belongs in box ${want}, not box ${ev.input.box}`
    },
  },
  {
    id: 'no-overpick',
    kind: 'history',
    label: 'never pick an item more times than it was ordered',
    source: `forbid (principal, action == Action::"pick", resource)
when temporal {
  count_since(Action::"order",
    Action::"pick"::request{ input.sku: context.input.sku })
  >= context.order.count(context.input.sku) };`,
    check: (ev, history, ctx) => {
      if (ev.action !== 'pick') return null
      const sku = String(ev.input.sku)
      const ordered = ctx.order.filter((x) => x === sku).length
      const already = fetched(history).filter((x) => x === sku).length
      return ordered > 0 && already >= ordered ? `${sku} was ordered ${ordered}× and has already been picked ${already}×` : null
    },
  },
  {
    id: 'complete-before-done',
    kind: 'history',
    label: 'only close the order once every ordered item has been picked',
    source: `forbid (principal, action == Action::"done", resource)
unless temporal {
  forall sku in context.order:
    count_since(Action::"order", Action::"pick"::request{ input.sku: sku })
    == context.order.count(sku) };`,
    check: (ev, history, ctx) => {
      if (ev.action !== 'done') return null
      const missing = [...ctx.order]
      for (const s of fetched(history)) {
        const k = missing.indexOf(s)
        if (k >= 0) missing.splice(k, 1)
      }
      return missing.length ? `closing the order with ${missing.join(' ')} still unpicked` : null
    },
  },
]

export interface GatedStep {
  event: ActionEvent
  verdict: Verdict
}
export type GateOutcome = 'completed' | 'escalated' | 'unfinished'
export interface GatedRun {
  steps: GatedStep[]
  outcome: GateOutcome
  /** The first denial, if any — what a human on the loop would be shown. */
  denial: Extract<Verdict, { allow: false }> | null
  /** Ground truth, for the audit column only: would the raw plan have been correct? */
  correct: boolean
  /** Wasted tiles vs the shortest tour, for a correct plan (the policy is silent on this). */
  extra: number | null
}

/** Gate one plan action by action. The first DENY stops the run: the action never executes and
 *  the order goes to a person. A plan that runs out without `done` is `unfinished` — a liveness
 *  property ("must eventually finish"), which Dogwood lists as roadmap; here it simply escalates. */
export function gateWarehousePlan(planText: string, order: Basket, mode: ReadMode): GatedRun {
  const ctx: WareCtx = { order: [...order].sort() }
  const prompt = `order: ${ctx.order.join(' ')} => `
  const correct = warehouseReward(prompt, planText) === 1
  const extra = extraTiles(prompt, planText)
  const steps: GatedStep[] = []
  const history: ActionEvent[] = []
  for (const ev of readWarehouseActions(planText, mode)) {
    const verdict = decide(WAREHOUSE_RULES, ev, history, ctx)
    steps.push({ event: ev, verdict })
    if (!verdict.allow) return { steps, outcome: 'escalated', denial: verdict, correct, extra }
    history.push(ev)
    if (ev.action === 'done') return { steps, outcome: 'completed', denial: null, correct, extra }
  }
  return { steps, outcome: 'unfinished', denial: null, correct, extra }
}

// ---------------------------------------------------------------------------------------
// Harness: the injection demo's tool calls. Two rules, both about the USER's request, which
// the attacker cannot touch:
//   • a stateless scope rule — only the tools the request asked for;
//   • a history (provenance) rule — a call's arguments must be numbers the user gave, or an
//     output the gateway itself recorded from an earlier tool call. The gateway logs what the
//     tool actually returned, not what was fed back into the model's context.
// ---------------------------------------------------------------------------------------

export interface HarnessCtx {
  /** Tools the request is allowed to use. In a real deployment this is what the user
   *  authorised (a scope on the grant); the demo derives it from the request text. */
  allowedTools: ToolName[]
  /** Number lists that appear in the user's own request. */
  userNumbers: string[]
}

const TOOL_WORDS: Record<ToolName, string[]> = {
  sort: ['sort', 'order', 'arrange'],
  max: ['max', 'biggest', 'largest'],
  reverse: ['reverse', 'flip', 'backwards'],
  sum: ['sum', 'add', 'total'],
}

/** The scope and the numbers a request grants, read from the request itself. */
export function harnessContext(request: string): HarnessCtx {
  const words = request.toLowerCase().split(/[^a-z]+/)
  const allowedTools = (Object.keys(TOOLS) as ToolName[]).filter((t) => TOOL_WORDS[t].some((w) => words.includes(w)))
  const userNumbers = (request.match(/\d(?: \d)+/g) || []).map((s) => s.trim())
  return { allowedTools, userNumbers }
}

export const callEvent = (tool: ToolName, args: number[]): ActionEvent => ({
  action: tool,
  input: { args: args.join(' ') },
})
export const responseEvent = (tool: ToolName, output: string): ActionEvent => ({
  action: 'response',
  input: { tool, output },
})

export const HARNESS_RULES: PolicyRule<HarnessCtx>[] = [
  {
    id: 'scope',
    kind: 'stateless',
    label: 'only call tools the request asked for',
    source: `forbid (principal, action, resource)
unless { context.request.tools.contains(action) };`,
    check: (ev, _h, ctx) =>
      (ctx.allowedTools as string[]).includes(ev.action)
        ? null
        : `${ev.action} was not part of the request (allowed: ${ctx.allowedTools.join(', ') || 'none'})`,
  },
  {
    id: 'provenance',
    kind: 'history',
    label: "arguments must come from the user's request or a recorded tool result",
    source: `forbid (principal, action, resource)
unless { context.request.numbers.contains(context.input.args) }
unless temporal {
  formerly Action::"response"{ output: context.input.args } };`,
    check: (ev, history, ctx) => {
      const args = String(ev.input.args)
      if (ctx.userNumbers.includes(args)) return null
      if (history.some((h) => h.action === 'response' && h.input.output === args)) return null
      return `"${args}" did not come from the request or from any tool's recorded output`
    },
  },
]

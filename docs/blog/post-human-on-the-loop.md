# Human on the loop, not in it

---

[YOUR STORY — optional: a moment from plant work where a trip or interlock did its job. The paragraph
below works without it.]

In my early years working on a chemical plant there were always 2 systems in operation. A control system runs the process, and
underneath it sits a second, independent monitoring and emergency response system with one job: if pressure, temperature, pH, etc goes out of bounds, it alarms and then trips the plant into a safe mode (eg by venting pressure).  It does this independently of what the control system thinks. The operators
don't sit in the loop approving each move. They sit on it. They set the limits, watch the alarms,
and deal with the trips.  A good plant doesnt trust humans to catch critical errors, there is a system for that.

AI agents need the same thing, and most of the agent demos I see don't have it.

## The approval trap

The usual way to make an agent safe is to make a person approve what it does: a human in the loop.
It works, right up until the person is approving hundreds of actions a day, nearly all of them
fine. Human get bored and get trusting.  If you had 100 complex decisions sent to you every day and they were all correct, soon enough you would pay less and less attention to the details.  You would easily miss the 79th decision on day 5 that was wrong and 'approve it'.  Humans become bottlenecks, and also rubber stamps that are not reliable in a system where most of the time evering this is correct.

The alternative is to check the agent's actions automatically, outside the model, and only call a
person when a check fails.  Escalate only when human attention is required.

## What AWS has built

AWS has been pushing this hard under the banner of *automated reasoning*, with two different parts:

**Checking text.** Automated Reasoning checks in Bedrock Guardrails take a policy document, turn it
into formal logic, and test a model's answer against it. A language model does the translating from
English into logic, and there are limits. A "valid" result only
covers what the policy's variables capture. Their example: "I can submit my homework late because I
have a fake doctor's note" can come back valid if nothing in the policy asks whether the note is
fake.  So it needs comprehensive policies that can guess all edge cases, unlikely in the real world but something that can be improved as real world operations pick up the edge cases.

**Checking actions.** AgentCore Policy sits at the gateway between an agent and its tools and
decides allow or deny on every tool call, before it runs. The rules are written in Cedar, which can
be formally analysed. In August AWS open-sourced Dogwood, which extends Cedar with rules about
history: "only sell if the sale was approved in the last hour", "no more than five transfers an
hour".

Dogwood's history rules lose Cedar's formal guarantees: they are checked as the
agent runs, not proved mathematically. Multi-agent rules, covering handoffs between agents, are on the
roadmap, not shipped. 

## I built a small one

JabberLM has a warehouse agent with about 25,000 parameters. It packs orders where the right action
depends on the whole basket: a fragile item needs padding only if something heavy is in the order,
and a chemical goes in a separate box if there's food. The never sees which items are which. It has
to infer that. It gets about 90% of unseen orders right. Good, and not good enough to let it pack
chemicals next to food unsupervised.

So I put a gate in front of it: six rules it never sees, checked before each action runs.
- One checks the action is well formed.
- Three look at the action alone: is this item in the order, is the padding right, is it in the
  right box. These rules read the product catalogue, the very thing the model had to guess.
- Two look at history: don't pick an item more times than it was ordered, and don't close the
  order until everything has been picked.

Then I ran all 83 possible orders through it.

**A human in the loop approves 291 actions. A human on the loop reads 4.** The gate stopped 4
orders and sent each to a person with the rule it broke. It let no wrong order through, and it
stopped no correct one.

Any human looking at 291 actions where 287 are right is likely to get board and approve actions that are wrong.  The 4 could have been missed.  Any human consulted on only the 4 will spend much more time on them and likely catch them.

## What it cannot catch

Seven of the orders it let through walked further round the warehouse than they needed to. No rule
broke, because no rule can say "this was allowed, but you could have done better". That is the
difference between a gate and judgement, and it is the human's other job on the loop: write the
rules, read the escalations, and watch the numbers no rule covers.

## Where it is weakest

My first version of the gate let a wrong order through. Sampling five attempts per order, the model
once wrote `pak1` instead of `pack1`. My parser treated anything that wasn't "box 2" as box 1, so a
typo became a legal action and sailed through rules that were never wrong.

The weak point was not the rules. It was turning the model's output into something the rules could
check. That is exactly the step AWS's text checks hand to a language model, and exactly why the
stronger version of this idea checks *actions*, which are already typed, rather than prose. Read
strictly, against a schema, the typo is stopped.

## The same gate stops a hijack

The site's prompt-injection demo has an agent asked to "sort 6 9 2 then reverse it". An attacker
controls the first tool's output and plants an instruction. The naive agent obeys. The usual fix,
stripping tool output down to numbers, stops a planted command but not a planted number: the agent
happily reverses the attacker's `9 9 9`.

A gate with two rules stops all three attacks:
- only use tools the user asked for;
- only use numbers that came from the user or from what a tool actually returned, as the gateway
  recorded it.

`9 9 9` came from neither. The model never sees the rules and can't be talked out of them.

The price is real. A gate that says no also stops work. A paper in August, *If Agents Were Angels*,
tested exactly this kind of outside-the-model enforcement on mock Jira and ServiceNow agents. Leaks
and forbidden actions fell from 57.6% of runs to 0.2%. The share of tasks completed fell from 79% to
61%. Safer, and less gets done without a person.

## Why this matters at work

If someone is selling you agent safety, ask three questions:
1. **Does it check text or actions?** Text needs a translation step that can be wrong. Actions are
   already structured.
2. **What does the check consult?** If it is the model's own output and nothing else, it is checking
   form. The warehouse gate works because it reads the catalogue.
3. **What happens when it says no?** Who is told, with what, and how often? If the answer is "a
   person approves everything", that's a human in the loop, and it won't scale.

## The honest bit

My gate is a sketch of the idea, not Dogwood: six rules written in TypeScript, nothing formally
proved, on a tiny task where I can write down every rule. Real work has rules nobody has written
down yet, and those are the ones that hurt. The point is the shape: rules outside the model, checked
before anything happens, and a person who handles the exceptions instead of rubber-stamping the
rest.

You can run the warehouse gate on [JabberLM](https://jabberlm.com/capstone?section=policy). Flip it
to the lax parser with five tries per order to watch the typo get through. The hijack is on the
[harness page](https://jabberlm.com/harness?section=injection).

---

*Where we are on the size ladder: **~25K parameters**, the warehouse agent. Right on 90% of unseen
orders; with a gate, wrong on none, at the cost of 4 orders in 83 waiting for a person.*

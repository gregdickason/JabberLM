# What has to be true before software can decide anything

*A dispatch, 20 September 2026. Off the ladder: the series climbs in order, and occasionally
something lands that is worth stopping for.*

---

How can AI crush every benchmark we invent and still not be trusted to route a customer service
ticket?

That is the best question I have heard about AI this year, and it comes from a talk by TypeSafe's
founder — who co-authored GPT-4, ChatGPT and RLHF, and who cheerfully describes himself as one of
the few people at OpenAI who hates on ChatGPT.

## Assistance and automation

His answer is to look at what each pile of tasks has in common. The tasks AI is brilliant at are
the ones whose goal is **to please a human in the loop**. The tasks it fails at are the ones whose
goal is **to remove the human from the loop**. Assistance versus automation, and the line falls
exactly there.

The cause is not mysterious, and it is the part worth sitting with. RLHF — the algorithm behind
essentially every model you use — collects human preferences and optimises for them. So: why do all
LLMs require a human in the loop? *"We literally put them in the loop."*

The consequence he draws is sharper than the usual complaint about hallucination. Overpromising is
not a defect in these models, it is structural: *"no matter how wrong the models are, they will
look right."* A model that does not know errs toward whatever a human would rate well, because
that is the thing being maximised. Hence the lesson he says every business has already learned, and
it is a bleak one: do not use AI for decisions with stakes to your business.

## The software argument

Then the part I keep thinking about.

SaaS has barely changed since 2019. The LLM era mostly bolted a chatbot onto the side — which is
precisely what you would predict from a technology that is assistance-native. We are automating the
*writing* of software without making software any *smarter*. The building blocks are the same ones
they always were. *"We used to think that software would get a lot smarter, not just cheaper to
write."*

If that is right, then the thing standing between us and software that decides for itself is not
intelligence. The models are already clever enough. It is that we cannot tell when to believe them.

Which makes the confidence number the whole ballgame, and explains why TypeSafe describe their
objective as **calibrated decisions** — a third target alongside RLHF's human preference and RLVR's
raw correctness.

## What that looks like at 130,000 parameters

So I went and looked at mine.

JabberLM runs a tiny agent that makes exactly this kind of decision: one forward pass, nine allowed
answers, a probability on each. No text is generated and nothing is parsed. I ship two versions,
one deliberately undertrained.

The undertrained one displays a confidence for the cell it picks. Across all 4,520 non-terminal
positions, that number ranges from **17.4158% to 17.4225%**.

The same number every time. It does not vary with the board because it is not looking at the board.
You cannot automate on that: any threshold you pick puts every decision on the same side of it. And
it had been sitting on screen for weeks looking exactly like a measurement.

The well-trained one does vary, and it ranks honestly — **71.5%** when its move is optimal,
**48.1%** when it is not. Same architecture, same parameter count. The difference is entirely in
the training.

There is a second lesson in how easily I misread this. I first wrote that the well-trained model
was badly under-confident, because at a stated 30% it was right 96% of the time. That was my own
measurement error: nearly half of these positions have several equally good moves, so a model
splitting its belief three ways reads 33% and is marked correct. Score the probability it put
across *all* the good moves and it is roughly honest. The model never changed; the scoring rule
did. Which is uncomfortable, because a threshold is a number, and after that I no longer knew which
number to pick.

## Where this leaves me

The argument is right that this is the blocker, and right about why. A confidence that never moves
cannot carry a threshold. A confidence whose apparent honesty depends on how you scored it cannot
tell you where to put one. If automation is the goal, the confidence is not a nice extra on top of
the answer — it is the product, and it is the thing to test first.

So, genuinely: what would you tell someone choosing their first threshold?

**Try it →** both agents, and the calibration measurement, are live at
[jabberlm.com/lab?tab=calibration](https://jabberlm.com/lab?tab=calibration).

*JabberLM is a personal side project for teaching, unrelated to my work.*

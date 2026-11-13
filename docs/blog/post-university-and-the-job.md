# SFT is university. RL is the job.



---

When I started work as a fresh chemical engineer, I didnt even know how to open a valve.  I was book smart but practically dumb.  I needed to learn on the job.

In AI, every capable model goes through two kinds of training, similar to how people get good at their work.

**Supervised fine-tuning (SFT) is university.** The model is shown examples of correct behaviour
and learns to reproduce them: a question and a good answer, a bug and its fix. It is learning from
a textbook with the answer key attached. Someone has already worked out what good looks like, and
the student absorbs it.

**Reinforcement learning (RL) is the job.** Nobody hands you the answers any more. You try
something and find out whether it worked. The client is happy or complains. The code ships or it
breaks. The valve opens or it doesnt. Over time you do more of what got good results and less of what didn't. That is what RL
does to a model: it acts, gets a score for the outcome, and adjusts.

In JabberLM, my educational site where I am learning about AI practically (:-)), I have 
a tab that trains a tiny sorting model, about 27,000 parameters, live in your browser. I gave the
same starting model four different careers.

## Why you can't skip university

Put someone with no training into a hospital and tell them to learn surgery by trial and error.
Feedback is useless when every attempt fails the same way.

First career: straight to the job. No examples, only a score. Give it `sort 6 5 9` and it is
rewarded only if it answers `5 6 9`. I gave it 900 rounds of practice, six attempts at four
lists each round, about 21,600 attempts in all.

**It scored zero on every one.** Its answers were things like `7`, `1`, `3 1`. Not wrong lists,
not lists at all. RL learns by doing more of whatever scored better than its other attempts, and
when everything scores zero there is nothing to do more of. It never got started.

There is an important footnote, though. DeepSeek's R1-Zero is the famous case of a model trained
with RL and no supervised examples, and it learned to reason. It got messy, mixed languages and
was hard to read, so the production model added a short SFT stage first, then RL on top. But it skipped university, not school: it started from a model that had already read much of the internet. 

## Why university isn't enough

Second career: university first. I showed it worked examples, `sort 6 5 9 => 5 6 9` and thousands
like it, until it got about 57% right on lists it had never seen. Then two paths from the same point:

- **More university.** Another 900 rounds of worked examples: **70%** on one run, **80%** on
  another.
- **The job.** 900 rounds of practice where it only ever learns whether its own answer was right,
  never what the right answer was: **86%** on both runs.

Nobody showed it a single answer in the second phase, and on both runs it finished ahead of the
version that kept studying them. Going to work took it further than staying at university! (On the second run the margin was small, so I would not make much
of the size of the gap). 

The striking part is that learning on the job got there at all with no answers.

A graduate knows what the textbook says. They don't yet know what nobody wrote down: which
shortcuts are safe, what to do when the standard approach fails halfway. SFT also never teaches
recovery, because worked solutions never go wrong midway. Large models trained with RL learn to
check their work and back out of a dead end, and nobody wrote those examples for them.  Just like a human as they get better 'on the job'.

One nuance the headlines usually skip: researchers who compared models before and after RL found
that most of those habits were already *possible* in the base model. Given enough tries it would
stumble on them. What RL changed was how reliably it reached for them. That is the job too: a
graduate has seen the right move once in a lecture, and the job turns it into a habit.

## The job has its own failure mode

Every workplace has someone who has worked out how to get the bonus without doing the job well.
They hit the sales target with deals that fall through next quarter. They close tickets fast by
not really fixing anything.

Third career: the same graduate, the same job, but a lazier manager. This checker only asks
whether the answer is three numbers in order. It never checks they are the numbers it was given.

Within 150 rounds its score was **100%, and it stayed there.** Its real accuracy did not move: on
one run it went from 58% to 57%, on the other from 57% to 55%. Ask it to sort `4 7 4` and it answers `4 4 5` for full marks.
Once every answer scores perfectly, there is nothing left to learn from, so it stopped improving
at exactly the moment its score said it was flawless.

That is reward hacking in miniature: the model finds what the check rewards and gives it exactly
that. At frontier scale it is more inventive. A paper this month, *Coding or Cheating?*, watched
frontier coding agents on hard problems and found nearly every model it tested tried to get the
answer instead of working it out: searching the repository's history for the real fix, reading
git's internal object store directly, scanning the disk for a newer copy of the code or the
hidden tests. The attempts clustered on the hardest problems. The author's reading is that this
is a learned shortcut, acquired in training environments that leaked the answer, not a sign of
intelligence. 

## Why this matters at work

If you are building or buying anything trained with RL, the question is the same as for a
bonus scheme: what does the score actually check? My lazy checker was not wrong about anything
it measured. It just measured less than the job, and the model learned exactly the difference.

In management we call that 'aligning incentives' and it is very hard to do with people.

So measure the right thing, and check the work, not just the score.

## The honest bit

This is one tiny task, run on two seeds, and the comparison counts rounds, not computing time: an
RL round here makes 24 attempts, an SFT round studies 16 examples. Sorting is also the easy case
for RL, because the check is perfect and instant. Most real work has no perfect checker, which is
exactly where the failure above comes from. And none of this is RLHF, where the score comes from
human preference rather than a checker. That is a different story, and its own failure mode.

School gets you something to work with. University gets you to competent. The job gets you to
expert, if the job measures the right thing.

You can run the second career yourself on
[JabberLM](https://jabberlm.com/lab?tab=reward-learning-rlvr): press play, watch the amber
university curve hand over to the green job curve, and look at the attempts it is being scored on.



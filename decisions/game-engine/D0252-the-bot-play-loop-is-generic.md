---
id: D0252
status: accepted
date: 2026-09-01
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The bot play loop is generic infrastructure in `play-lifecycle.ts`; the QUICK_SCORE fold is built ahead of its first live consumer

## Context and Problem Statement
`08-DartBot.md` §The Play Loop specifies the trigger, the `botThrowing`/post-delay re-entrancy guards, `undoToActiveSeat()`, and the QUICK_SCORE fold as one mechanism seen from four angles, living once in `play-lifecycle.ts` rather than copied per ruleset. Building the fold now, ahead of a live consumer, is what lets phase 7 add `X01Strategy` without also having to invent this mechanism under deadline. Full plan: `docs/superpowers/plans/2026-09-01-dartbot-6-play-loop.md`.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Make the trigger depend on a `DartBot` class or on `modules/dartbot/*`.
* Inject a `BotDartThrower` into the trigger and return a ruleset-agnostic `{ totalScore, dartsThrown }` from the fold (chosen).
* Return one ruleset's visit-input shape from the fold, such as `FiveOhOneVisitInput`.

## Decision Outcome
Chosen option: "Two choices, both about keeping the mechanism reusable rather than fitting it to Bob's 27 alone. First: the trigger takes an injected `BotDartThrower` (`() => { observation, pacing }`) rather than depending on a `DartBot` class or on `modules/dartbot/*` at all — `play-lifecycle.ts` stays ruleset- and bot-agnostic, provably so, since its own tests satisfy the contract with a plain stub and never import the module. Second: `playFoldBotQuickScoreVisit` returns a ruleset-agnostic `{ totalScore, dartsThrown }` rather than any one ruleset's visit-input shape (`FiveOhOneVisitInput`, a plain `number`, …) — the caller, which already knows its own concrete engine type, converts that into whatever `record()` expects. This is why the fold can be written and proven (against `scoreTrainingEngineFactory`) a full phase before any `QUICK_SCORE` ruleset admits a bot: nothing about it is Score-Training-specific, it was simply the simplest existing `QUICK_SCORE` engine to prove the mechanism against.".

### Consequences
Phase 7's `X01Strategy` calls `playFoldBotQuickScoreVisit` directly and builds its own `FiveOhOneVisitInput` from the returned `totalScore` — no change to the fold itself expected. A ruleset whose visit-total shape needs more than `totalScore`/`dartsThrown` (none does today) would need the fold's return type widened, not a second fold function.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/play-lifecycle.test.ts` drives the bot trigger with a stub `BotDartThrower`, as the plan's contract comment describes.

## Pros and Cons of the Options
### Depend on the `DartBot` class or `modules/dartbot/*`
* Bad, because `play-lifecycle.ts` would no longer stay ruleset- and bot-agnostic.

### Injected thrower and ruleset-agnostic fold return
* Good, because `play-lifecycle.ts` stays ruleset- and bot-agnostic, and its own tests satisfy the contract with a plain stub.
* Good, because the fold can be proven against `scoreTrainingEngineFactory` a phase before any `QUICK_SCORE` ruleset admits a bot.

### One ruleset's visit-input shape
* Bad, because the caller already knows its concrete engine type and converts the result itself, so a shaped return ties the fold to one ruleset.

## Evidence / More Information
Decided: 2026-09-01

* `docs/superpowers/plans/2026-09-01-dartbot-6-play-loop.md` (Goal, Architecture, Task on D252): rebuilt Considered Options, Pros and Cons, Confirmation. The plan carries a provenance note that it was reconstructed after the fact from shipped commits.
* Commit `0b0a3b44` (docs: record the play-loop mechanism's generality as a decision; renumbered D248 to D252 in `927ad10c`): the adding commit.
* Applied in: `docs/superpowers/plans/2026-09-02-dartbot-7-x01-strategy.md`.

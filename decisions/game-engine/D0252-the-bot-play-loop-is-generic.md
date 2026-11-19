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
<!-- backfill: pending -->

# The bot play loop is generic infrastructure in `play-lifecycle.ts`; the QUICK_SCORE fold is built ahead of its first live consumer

## Context and Problem Statement
`08-DartBot.md` §The Play Loop specifies the trigger, the `botThrowing`/post-delay re-entrancy guards, `undoToActiveSeat()`, and the QUICK_SCORE fold as one mechanism seen from four angles, living once in `play-lifecycle.ts` rather than copied per ruleset. Building the fold now, ahead of a live consumer, is what lets phase 7 add `X01Strategy` without also having to invent this mechanism under deadline. Full plan: `docs/superpowers/plans/2026-09-01-dartbot-6-play-loop.md`.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Two choices, both about keeping the mechanism reusable rather than fitting it to Bob's 27 alone. First: the trigger takes an injected `BotDartThrower` (`() => { observation, pacing }`) rather than depending on a `DartBot` class or on `modules/dartbot/*` at all — `play-lifecycle.ts` stays ruleset- and bot-agnostic, provably so, since its own tests satisfy the contract with a plain stub and never import the module. Second: `playFoldBotQuickScoreVisit` returns a ruleset-agnostic `{ totalScore, dartsThrown }` rather than any one ruleset's visit-input shape (`FiveOhOneVisitInput`, a plain `number`, …) — the caller, which already knows its own concrete engine type, converts that into whatever `record()` expects. This is why the fold can be written and proven (against `scoreTrainingEngineFactory`) a full phase before any `QUICK_SCORE` ruleset admits a bot: nothing about it is Score-Training-specific, it was simply the simplest existing `QUICK_SCORE` engine to prove the mechanism against.".

### Consequences
Phase 7's `X01Strategy` calls `playFoldBotQuickScoreVisit` directly and builds its own `FiveOhOneVisitInput` from the returned `totalScore` — no change to the fold itself expected. A ruleset whose visit-total shape needs more than `totalScore`/`dartsThrown` (none does today) would need the fold's return type widened, not a second fold function.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-01

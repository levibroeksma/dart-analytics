---
id: D0517
status: accepted
date: 2026-11-01
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Score-input and Mickey Mouse play factories join the shared parts

## Context and Problem Statement
the remaining clone groups in the D513 baseline were the 501/121/score-training/tuod family and the Mickey Mouse copy of the baseball shape. Callbacks and spec objects of game functions keep the variation visible without per-game flags.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "five-oh-one, one-twenty-one, score-training, tuod and mickey-mouse play factories spread the D516 parts (`playScreenState`, `playScreenActions`, `playAgainStarterData`, `timedPlayData` for the timed three, `boardPlayActions` for Mickey Mouse). All 15 `lib/game` play factories now compose the parts. `playInit` takes `PlayInitOptions` (`onResumed`, `uploadIfComplete`); the 501-family shapes that differ per game stay own members but share typed helpers (`playBotQuickScoreVisit`, `undoPastBot`, `playX01BotVisit`, `confirmCheckout`, `playTimedInit`, `playRunGatedBotVisit`, `restartCountdown`). `resetTimerStoreFields` is the store-only half of `resetTimerForPlayAgain`, used where the old code did not stop the timer object.".

### Consequences
`uploadIfComplete` is the one boolean option, kept because a hook would be a no-op passed by all five callers; every other variation is a callback or spec object. Baseline 63 → 54 rows; no factory surface changed (snapshot untouched). Quick-subtract shares `play-countdown.ts` helpers; its surface is unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-01
Supersedes: none. Extends D516.

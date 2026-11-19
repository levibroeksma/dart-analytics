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

# Score-input and Mickey Mouse play factories join the shared parts

## Context and Problem Statement
the remaining clone groups in the D513 baseline were the 501/121/score-training/tuod family and the Mickey Mouse copy of the baseball shape. Callbacks and spec objects of game functions keep the variation visible without per-game flags.

## Decision Drivers
* The 501/121/score-training/tuod family and the Mickey Mouse copy of the baseball shape were the clone groups left in the D513 baseline.
* Each play factory's public surface must stay identical.
* No per-game flags; variation goes through callbacks or spec objects.

## Considered Options
* Spread the D516 parts, keep per-game members, and share typed helpers (chosen).
* Add per-game boolean flags to the shared parts.
* Leave the five factories on their own lifecycle code.

## Decision Outcome
Chosen option: "five-oh-one, one-twenty-one, score-training, tuod and mickey-mouse play factories spread the D516 parts (`playScreenState`, `playScreenActions`, `playAgainStarterData`, `timedPlayData` for the timed three, `boardPlayActions` for Mickey Mouse). All 15 `lib/game` play factories now compose the parts. `playInit` takes `PlayInitOptions` (`onResumed`, `uploadIfComplete`); the 501-family shapes that differ per game stay own members but share typed helpers (`playBotQuickScoreVisit`, `undoPastBot`, `playX01BotVisit`, `confirmCheckout`, `playTimedInit`, `playRunGatedBotVisit`, `restartCountdown`). `resetTimerStoreFields` is the store-only half of `resetTimerForPlayAgain`, used where the old code did not stop the timer object.".

### Consequences
`uploadIfComplete` is the one boolean option, kept because a hook would be a no-op passed by all five callers; every other variation is a callback or spec object. Baseline 63 → 54 rows; no factory surface changed (snapshot untouched). Quick-subtract shares `play-countdown.ts` helpers; its surface is unchanged.

* Good, because the baseline fell from 63 to 54 rows and no factory surface changed.
* Neutral, because `uploadIfComplete` is the one boolean option: a hook would be a no-op that all five callers pass.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The surface snapshot (`app/tests/lib/game/factory-surface.test.ts`) must stay untouched and the existing per-game tests must pass unmodified. `scripts/check-dupes.sh` shows the lowered baseline.

## Pros and Cons of the Options
### Spread the D516 parts with typed helpers (chosen)

* Good, because callbacks and spec objects keep the variation visible.

### Per-game boolean flags

* Bad, because the spec and plan name flags an anti-goal.

### Leave the five factories as they are

* Bad, because these were clone groups still in the D513 baseline.

## Evidence / More Information
Decided: 2026-11-01
Supersedes: none. Extends D516.

* `docs/superpowers/plans/2026-10-31-duplication-backlog-phase-0-1.md` (Global Constraints, Task 10–13): rebuilt Decision Drivers, Considered Options and Confirmation.
* `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Phase 1, Anti-goals): rebuilt Pros and Cons.
* Commit `9f52d699` (PR #1208, 2026-11-01; adds the `decisions/frontend/architecture.md` row): rebuilt Consequences.
* Applied in: `docs/superpowers/plans/2026-11-01-duplication-backlog-phase-2-3a.md`, which cites `uploadIfComplete` as the precedent for a documented lifecycle option.

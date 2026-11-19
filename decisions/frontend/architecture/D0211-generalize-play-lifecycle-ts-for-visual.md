---
id: D0211
status: accepted
date: 2026-08-15
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0209
superseded-by:
---

# Generalize play-lifecycle.ts for VISUAL_BOARD input

## Context and Problem Statement
D209 excluded Bob's 27 from `play-lifecycle.ts` specifically because `VISUAL_BOARD` needed the board-tap DOM bridge and the 1.5s reveal-then-clear timer the shared module didn't have. With Singles Training and Doubles Training now needing exactly that shape too, re-forking a second and third time would reintroduce the class of duplication D208/D209 paid down. Generalizing is additive and safe: every existing `play-lifecycle.ts` consumer's `inputModeKey` is never `VISUAL_BOARD`, so the new branch is dead code on their path.

## Decision Drivers
* Singles Training and Doubles Training need the board-tap DOM bridge (`boardInputData`) and the 1.5s reveal-then-clear timer that D209 left out of `play-lifecycle.ts`.
* Re-forking a second and third time would reintroduce the class of duplication D208 and D209 paid down.
* Generalizing is additive: no existing consumer uses `VISUAL_BOARD`.

## Considered Options
* Re-fork Singles Training and Doubles Training into bespoke play-data modules, as Bob's 27 did.
* Generalize `play-lifecycle.ts` with optional board input (chosen).

## Decision Outcome
Chosen option: "`play-lifecycle.ts` (`playCommitDart`, `playUndoVisit`, `runPlayAgain`) now optionally supports board input — an additive `hiddenTimer` field on `PlayLifecycleContext` and a mode-gated reveal-then-clear branch, plus a new shared `playVisitMarkers` helper — rather than re-forking Singles/Doubles Training into bespoke play-data modules the way Bob's 27 did.".

### Consequences
Bob's 27 itself is unchanged — its own `commitDart`/`undoVisit`/`visitMarkers` stay bespoke, not a forced migration onto the now-generalized shared module. A fourth ruleset needing board input reuses `play-lifecycle.ts` directly with no further architectural change.

* Neutral, because the spec treats the change as a reversal of D209's scoping to exclude `VISUAL_BOARD`-shaped rulesets, which is why D211 supersedes D209.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`play-lifecycle.test.ts` gains cases for the reveal-timer branch in `playCommitDart` (it fires only under `VISUAL_BOARD` and clears a still-pending timer on a fast second resolution) and for `playVisitMarkers`. The plan's Task 5 runs the full suite to confirm no regression in existing `play-lifecycle.ts` consumers.

## Pros and Cons of the Options
### Re-fork into bespoke play-data modules
* Bad, because forking a second and third time reintroduces the class of duplication D208 and D209 paid down.

### Generalize `play-lifecycle.ts`
* Good, because the change is additive: the existing consumers (Shanghai, 121, Around the Clock) never have `inputModeKey === "VISUAL_BOARD"`, so their behaviour stays byte-identical.
* Good, because a fourth ruleset needing board input reuses `play-lifecycle.ts` directly.

## Evidence / More Information
Decided: 2026-08-15

* `docs/superpowers/specs/2026-08-15-singles-doubles-training-analytics-design.md` (Shared lifecycle, Testing, Decisions): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation. The spec calls the change a boundary reversal of D209's scoping, not a mechanical extension.
* `docs/superpowers/plans/2026-08-15-singles-doubles-training-analytics-plan.md` (Architecture, Task 5, the `D<next>` decision draft): rebuilt Confirmation.
* Commit `5cdebb3c` (PR #115, 2026-08-15; adds D211): confirmed the decision text.

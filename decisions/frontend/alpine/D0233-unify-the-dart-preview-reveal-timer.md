---
id: D0233
status: accepted
date: 2026-08-26
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Unify the dart-preview reveal timer across input modes

## Context and Problem Statement
the branch's non-`VISUAL_BOARD` path set `hiddenTurnKey` in the same
tick the 3rd dart was recorded, before Alpine's reactive effects repaint —
so tap/keypad input (the recreational entry path for Bob's 27, Singles
Training, Doubles Training, Shanghai, and Around the Clock) never actually
rendered the 3rd dart's preview. This was an accidental divergence between
input modes, not a deliberate design choice.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`play-lifecycle.ts`'s reveal-then-clear timer (`playCommitDart`) no
longer branches on `inputModeKey`. Every input mode gets the same 1500ms
delay between a visit resolving and its preview clearing. Bob's 27's
previously independent, hand-rolled copy of this same timer is deleted; it
now delegates to `play-lifecycle.ts` like every other per-dart game mode.".

### Consequences
every per-dart game mode's preview now behaves identically
regardless of input mode or seat count. `playPreviewSegments()` (a new
shared export alongside the timer) replaces 3 duplicated segment-computation
functions and reshapes the pre-existing shared `doublesPathPreviewSegments`
helper onto the same gate. See Pattern 19,
`docs/architecture/04-Architecture-patterns.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-26

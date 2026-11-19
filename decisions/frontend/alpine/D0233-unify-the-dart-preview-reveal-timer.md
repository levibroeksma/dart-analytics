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

# Unify the dart-preview reveal timer across input modes

## Context and Problem Statement
the branch's non-`VISUAL_BOARD` path set `hiddenTurnKey` in the same
tick the 3rd dart was recorded, before Alpine's reactive effects repaint —
so tap/keypad input (the recreational entry path for Bob's 27, Singles
Training, Doubles Training, Shanghai, and Around the Clock) never actually
rendered the 3rd dart's preview. This was an accidental divergence between
input modes, not a deliberate design choice. The commit that adds D233 also adds Pattern 19, Shared Reveal-Then-Clear Preview, to `docs/architecture/04-Architecture-patterns.md`.

## Decision Drivers
* Tap and keypad input never rendered the 3rd dart's preview, because the non-`VISUAL_BOARD` path set `hiddenTurnKey` before Alpine repainted.
* Bob's 27 kept its own hand-rolled copy of the timer, separate from `play-lifecycle.ts`.
* The divergence between input modes was accidental, not a deliberate design choice.

## Considered Options
Rationale unknown — no source found. The commit records no alternatives.

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
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-26

* Commit `ec30760b` (2026-08-26; `decisions/frontend/alpine.md` row D233 and Pattern 19 in `docs/architecture/04-Architecture-patterns.md`): rebuilt Context and Decision Drivers.
* Applied in: `docs/superpowers/specs/2026-08-26-board-marker-clear-remaining-games-design.md` (Problem, Design § 2), `docs/superpowers/plans/2026-08-26-board-marker-clear-remaining-games.md`.

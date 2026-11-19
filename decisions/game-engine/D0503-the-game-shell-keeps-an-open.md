---
id: D0503
status: accepted
date: 2026-10-28
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The game shell keeps an open visit's total live on request (`liveTotal`)

## Context and Problem Statement
Score Training persists a live open-visit total (#168) that `coordinateCapture` alone leaves unwritten; one optional flag keeps its facts byte-identical without changing any other bound engine.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`DartGameSpec.liveTotal?: boolean`. With `coordinateCapture`, a spec that sets it has the shell write an open turn's `totalScore` as its darts' board-score sum after every dart; `closedVisitTotal` still settles it at close. Score Training sets it and is bound to the Visit points kernel on the game shell (`foldVisitPoints` per seat, `visitInput` for keypad totals, `complete` for solo duration), reusing the hooks Ten Up One Down landed (D500).", because Score Training persists a live open-visit total (#168) that `coordinateCapture` alone leaves unwritten; one optional flag keeps its facts byte-identical without changing any other bound engine.

### Consequences
Score Training's hand-written class is gone; its behaviour is pinned by goldens recorded before the rebind and proven by a differential oracle over mixed keypad and board input. The registry row is `KERNEL_BOUND`. Spec: `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-28

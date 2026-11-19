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

# The game shell keeps an open visit's total live on request (`liveTotal`)

## Context and Problem Statement
Score Training persists a live open-visit total (#168) that `coordinateCapture` alone leaves unwritten; one optional flag keeps its facts byte-identical without changing any other bound engine.

## Decision Drivers
* Ten Up One Down had already landed `visitInput`, `complete`, `coordinateCapture`, whole-turn undo and the open-visit refusal, so `liveTotal` is the one new gap in the shell (spec § 4 status note, 2026-10-28).
* The shell's facts for Score Training must stay as they were; the spec guards dart scoring and keypad/board mixing with an oracle (spec § 8).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`DartGameSpec.liveTotal?: boolean`. With `coordinateCapture`, a spec that sets it has the shell write an open turn's `totalScore` as its darts' board-score sum after every dart; `closedVisitTotal` still settles it at close. Score Training sets it and is bound to the Visit points kernel on the game shell (`foldVisitPoints` per seat, `visitInput` for keypad totals, `complete` for solo duration), reusing the hooks Ten Up One Down landed (D500).", because Score Training persists a live open-visit total (#168) that `coordinateCapture` alone leaves unwritten; one optional flag keeps its facts byte-identical without changing any other bound engine.

### Consequences
Score Training's hand-written class is gone; its behaviour is pinned by goldens recorded before the rebind and proven by a differential oracle over mixed keypad and board input. The registry row is `KERNEL_BOUND`. Spec: `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/score-training.golden.test.ts` holds the goldens that pin Score Training's behaviour.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-28

* `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md` (§ 4 status note, § 5, § 8): rebuilt Decision Drivers and Confirmation.
* Commit `6b78c74b` (PR #1127): adds the D503 row.

---
id: D0125
status: accepted
date: 2026-07-22
origin: contemporaneous
original-date:
tags: [game-engine, undo, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Visit-score entry uses reusable `ScoreInputBuffer` (`modules/game`) with activation guard

## Context and Problem Statement
Root-fix ghost multi-clicks; share keypad buffer across game types

## Decision Drivers
* Two intended presses of the same digit can produce 3 browser `click` events, so `22` or `55` sometimes became `222` or `555`.
* The digit buffer lived in `score-training-play.data.ts` and `ScoreInput.astro` hardcoded those names, so another game could not reuse the keypad.

## Considered Options
* Keep the raw one-to-one `click` to digit keypad with factory-local helpers (the state before this record).
* A reusable `ScoreInputBuffer` module with a ghost-window coalesce plus an `event.detail > 2` guard (chosen).
* Guard only on `event.detail > 1`.

## Decision Outcome
Chosen option: "Visit-score entry uses reusable `ScoreInputBuffer` (`modules/game`) with activation guard (`detail > 2` reject + `SCORE_INPUT_GHOST_MS` coalesce); `ScoreInput.astro` is a prop-wired shell; games own range validation and optional undo.", because Root-fix ghost multi-clicks; share keypad buffer across game types.

### Consequences
* Good, because a fast intentional `22` works while a ghost third activation is not appended.
* Good, because the module API lets other game types wire the same keypad.
* Neutral, because the ghost window `SCORE_INPUT_GHOST_MS` is tunable with test and manual evidence only.
* Neutral, because a guard rejection is silent: no error toast.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/score-input.module.test.ts` and `app/tests/modules/game/score-input-activation.module.test.ts` cover the guard: same-digit doubles pass, and a second activation inside the ghost window or `detail > 2` is rejected.

## Pros and Cons of the Options
### Raw click-to-digit keypad
* Bad, because rapid same-digit entry can yield 3 digits, and the buffer cannot be reused by other games.

### Reusable buffer with ghost window and `detail > 2`
* Good, because intentional same-digit doubles survive: a fast double-press often arrives as `detail` 1 then 2.
* Good, because the buffer is reusable across game types.

### Guard only on `detail > 1`
* Bad, because a fast intentional double-press arrives as `detail` 1 then 2, so `22` and `33` would be blocked.

## Evidence / More Information
Decided: 2026-07-22

* `docs/superpowers/specs/2026-07-22-score-input-buffer-design.md` (Context, Problem / UX contract, Design): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-22-score-input-buffer.md` (Task 1 module code, Task 3): rebuilt Consequences. The plan numbers the row D124; commit `4ab73bf1` adds it to the ledger as D125.
* Commit `4ab73bf1` (PR #32, 2026-07-22; adds the D125 row): confirmed the row text.

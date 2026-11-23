---
id: D0198
status: superseded
date: 2026-08-10
origin: contemporaneous
original-date:
tags: [game-engine, engine, undo, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0189
superseded-by: D0203
---

# Engines dispatch on the input's shape, not on the session's stored mode

## Context and Problem Statement
With dispatch keyed on the field, a QUICK_SCORE-tagged engine handed a `DartObservation` called `classify(undefined, undefined)`, which returns `{zoneKey: "INNER_SINGLE"}` with no target and no score and throws nothing — a silently corrupt dart row. Two reachable paths produced that divergence: setup pages that hardcoded the mode pair, and `playAgain()` rebuilding a replay engine with the factory default. Input shape is the one authority that cannot disagree with the input.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Dispatch on the constructor's `inputMode` field (the mechanism D189 used; replaced).
* Dispatch on the input's shape (chosen).

## Decision Outcome
Chosen option: "`record()`, `wouldComplete()` and `undo()` in `five-oh-one.engine.module.ts` and `score-training.engine.module.ts` branch on what they are handed, never on the constructor's `inputMode` field. A visit total (`number` / `FiveOhOneVisitInput`) takes the quick-score path; a `DartObservation` takes the dart path, discriminated by `hitZoneKey`. `undo()` branches on the last turn's shape (`darts.length > 0`), which is the shape `record()` actually wrote. `inputMode` survives on the constructor for persistence and capability code but governs no engine behaviour. D189's capture-depth model is unchanged — only the mechanism that selects it.".

### Consequences
The two input paths coexist inside one session, so a player may enter a visit on the keypad and the next on the board. `recordVisitTotal` therefore refuses a keypad total while a dart visit is open (`completedAt === null`) rather than writing across it — refusing loudly beats writing wrong. The mixed log stays undoable to depth because turn shape is an invariant of the write path: `recordVisitTotal` always writes `darts: []`, `recordDart` always writes `darts.length >= 1`, and rehydration is a plain JSON mirror that round-trips shape faithfully. A future method keyed on `inputMode` would silently disagree with its own `record()` — the field is dead and should be removed under its own decision.

* Neutral, because the commit that adds D198 states the shape-dispatch change shipped in `47fd37c` and `ced46de` with no decision behind it.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Dispatch on the constructor's `inputMode` field
* Bad, because a QUICK_SCORE-tagged engine handed a `DartObservation` called `classify(undefined, undefined)` and wrote a corrupt dart row without throwing.

### Dispatch on the input's shape
* Good, because input shape is the one authority that cannot disagree with the input.

## Evidence / More Information
Decided: 2026-08-09

* Commit `20b4f9e5` (2026-08-09; adds D198 and D199): rebuilt Considered Options and Pros and Cons. Its message says D198 records shape dispatch, "superseding D189's mechanism".
* Superseded by D203, which removes the `inputMode` field D198 left on the constructor.

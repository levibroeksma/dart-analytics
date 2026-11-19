---
id: D0232
status: accepted
date: 2026-08-23
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, Score Training, undo, visit, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Engine turn-log and seat-derivation boilerplate lives in two shared pure modules, not once per engine

## Context and Problem Statement
D230's conversion applied one recipe to eight engines, and the recipe's mechanical half was copied eight times with it — `npx fallow` went from main's 70 clone groups / 14.3% duplicated to 95 groups / 18.6%, over its 15% gate, so CI failed on the branch. The half that is genuinely per-ruleset (what a dart does to a seat, when a visit resolves, which metric decides the match) stays in each engine; only the half with no ruleset content in it was lifted. Every extracted function is pure or mutates only the array it is handed, so an engine's observable behaviour is unchanged — the engine tests were re-run unmodified after each extraction as the proof.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The mechanics every engine repeated verbatim after the `MultiSeatState<TSeat>` conversion move into two new pure modules under `app/src/modules/game/`. `turn-log.module.ts` owns everything that touches the `TurnFact`/`DartFact` log: `cloneTurns`, `sumDartScores`, `dartsThrownBy`, `openOrCreateTurn(turns, stageClientKey, participantRef, isReusable)` (the reuse rule stays the caller's, because a visit closes on its 3rd dart, on the dart that hits its target, or only for the seat that opened it), `appendCompletedTurn`, `openVisit`, `resolveObservation`/`appendResolvedDart` for coordinate capture, `appendObservedDart`/`doubleTargetIntent` for ring capture, and the three undo shapes an engine can have — `undoLastDart` (dart-only logs), `undoLastUnit` (mixed keypad/board logs), `undoStagedTurn` (mixed logs whose engine also opens stages). `seat-state.module.ts` owns per-seat derivation: `foldSeatStates(turns, seats, initial, applyDart)`, `activeSeatState`, `otherSeatsComplete`, `durationSeatComplete`, `completedByIndex`. `match-outcome.module.ts` gains `scoreCompareOutcome(seats, direction, soloStatus)`, the status-plus-winner composition all five score-compare engines wrapped around `scoreCompareWinner` identically. On the setup side, `participantsFromGuests` joins `participantsFromSeats` in `session-mode-resolution.ts` and `addTypedGuest` moves to `guest-list.ts`.".

### Consequences
`npx fallow` exits 0 again: 76 clone groups, 14.8% duplicated, 0 files above the health threshold. Adding a ninth engine now composes these helpers rather than copying a neighbour, and `docs/architecture/04-Architecture-patterns.md` Pattern 18's contract is unchanged — the modules sit under it, not beside it. The remaining duplication is deliberate and logged as F27: the `*-play.data.ts` lifecycle family (left alone because the Play Again reseating fix had just hardened it) and a 268-line whole-class structural clone between Score Training and TUOD that has no extractable blocks left. The 14.8% figure clears the 15% gate by a thin margin, so a future addition can fail it without introducing duplication of its own. The health breach that failed alongside the duplication was NOT `match-outcome.module.ts`'s fan-in — fallow's "start with <file>" line names its top refactoring target, not the failing item — it was `recordTap` in `singles-training-play.data.ts`, whose seat lookup pushed it to cyclomatic 10 / CRAP 31.6; extracting its tap-to-observation mapping cleared it without a `.fallowrc.jsonc` exception.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-23

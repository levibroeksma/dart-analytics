---
id: D0518
status: accepted
date: 2026-10-31
origin: contemporaneous
original-date:
tags: [game-engine, engine, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Prisoner V1 engine: the Elimination kernel grows `reduceDart` and `decidedWinner`; `lives` is darts held; board-only capability

## Context and Problem Statement
a per-dart outcome that also touches `shared`, and a win that is not "last one standing", fit neither `onDart` nor the end-of-fold rota. Holding darts as `lives` reuses the kernel's out rule and clamp. No migration: no DB CHECK or Zod bound caps darts per turn.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`EliminationRules` gains two more optional members, so Killer's and Follow the Leader's folds are unchanged (pinned by their regression tests). `reduceDart(thrower, seats, shared, dart)` returns the dart's `VisitOutcome` and replaces `onDart` when present (`onDart` stays required; Prisoner passes `() => []`); it lets one dart change `shared`. `decidedWinner(seats, shared)` returns a side key or `null`; a non-null result beats last-seat-standing and is judged on the final folded state. Prisoner (`prisoner-policy.ts`, `prisoner.engine.module.ts`) latches a completed 20 as the seat's `ext.target = 21`, which `decidedWinner` reads. `lives` is darts held (start `darts`, prison −1, capture +1, out at 0). Key `PRISONER_V1`, `SHARED` stage, two seats (one PLAYER, one guest), no DartBot, config `{ darts: 3 }`, `STATS_TAGS` `["board"]`. Capability is `ANALYTICS + VISUAL_BOARD` only, with `coordinateCapture`; no `RECREATIONAL` row. `prisonerValidator` overrides `validateConfig` to refuse any other capture/input pair, and `validateBatch` adds a cap of 6 darts per turn and refuses unbanded `SINGLE`, then delegates to the three-dart validator (which has no dart-count cap). Budget and skip resolve in `onVisitClose`: the closing seat sets `sitting := missed`, `budget := lives − sitting`, `missed := 0`; the walk over later seats (closing seat last) clears `sitting` and sets `budget := lives` on any seat still in with budget 0, until one has budget above 0; `activeOverride` returns that seat. A skipped visit writes nothing. Replay labels: `Advance`, `Capture`, `Advance and capture`, `Prison`, `Miss`.".

### Consequences
seed `0057` adds the `PRISONER` game type, `PRISONER_V1` and a `{"darts": 3}` preset, with a `0007` capability row (53) and tag rows in `0042`; `prisoner.md` gains `Game type:` and keeps `Current version: none (V1 in design)` until PR 2 (app wiring: seat floor and cap, setup, play, results, card). Spec: `docs/superpowers/specs/2026-10-30-prisoner-design.md` (its §3a/§5/§6 corrected here).
Rulings (planning 2026-10-31, where the rules file is silent):

| Ruling | Reading |
| ------ | ------- |
| Win by 20 | `ext.target` becomes 21 on completing 20; the game ends at once and no further dart is accepted |
| Dart resolution | An `OUTER_SINGLE` of any number is a valid hit: it captures when a prisoner is lodged on that number and advances only when it is the target; `INNER_SINGLE` is prison only on the target number; bulls are prison; `MISS` counts toward `missed`; double, treble and every other dart is a plain miss with no penalty |
| Own-target hit | A valid hit on a target that holds a prisoner advances and captures; a capture on a non-target number does not advance; one hit takes one prisoner |
| Bull | Held −1, nothing lodged, nothing capturable |
| Last held dart | Prisoned at 0 held, the seat is out at once; a capture earlier in the visit keeps it in |
| All sitting out | The walk skips every seat at budget 0 and returns their darts, so no stall |
| Keypad `SINGLE` | The engine does not refuse it: under `coordinateCapture` every dart resolves from its coordinates and an unlocated `SINGLE` is a no-effect dart. Only the validator refuses it |

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-31

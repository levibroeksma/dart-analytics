---
id: D0230
status: accepted
date: 2026-08-22
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, 501, Score Training, visit, bust, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Three win-condition categories, generalized `SEAT_CAPS`, and `activeSeat()`'s completion predicate land 1v1 play across the eight non-501 engines

## Context and Problem Statement
Each ruleset's session ends by a genuinely different rule (immediate elimination vs. immediate race vs. play-out-and-compare), so one generic "first to X" helper could not express all three without re-scattering per-engine special cases back into the engines — the same trap D138 already fixed once for the engine contract itself. The single-ruleset `MULTI_SEAT_RULESET` gate was sized for 501 alone; raising the cap for eight more rulesets one `if` at a time would have re-scattered the same seat-count logic `SEAT_CAPS` now centralizes as data instead. `activeSeat()`'s pure turn-count alternation silently mis-attributed Around the Clock's turns once one seat finished its circuit before the other — the one non-uniform-turn-count shape among the eight — so the fix is a predicate parameter on the shared module rather than a bespoke rota inside that one engine.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/src/modules/game/match-outcome.module.ts` adds three pure, generic winner functions — `eliminationWinner({sideKey, failed}[])`, `raceWinner({sideKey, finished}[])`, `scoreCompareWinner({sideKey, completed, metric}[], direction)` — one per win-condition shape a ruleset's session naturally ends with. Bob's 27 is **elimination** (first seat to bust loses, the other wins). 121 is **race-to-finish** (first seat to check out 170 wins, match ends immediately). Around the Clock, TUOD, Shanghai, Score Training, Singles Training and Doubles Training are **score-compare** (both seats always finish their own session; once both are complete, the best derived metric wins — Around the Clock inverted to fewest-darts, Shanghai layering its existing instant-win-on-Shanghai on top as a race-shaped exception ahead of the score-compare fallback). `session-seats.service.ts`'s single-value `MULTI_SEAT_RULESET = "501_V1"` gate is replaced by a `SEAT_CAPS: Record<string, number>` map — `501_V1` stays at 4, the eight other rulesets (`BOBS27_V1`, `121_V1`, `AROUND_THE_CLOCK_V1`, `TUOD_V1`, `SHANGHAI_V1`, `SCORE_TRAINING_V1`, `SINGLES_V1`, `DOUBLES_TRAINING_V1`) get 2, and any ruleset absent from the map still defaults to 1 (reject), exactly as before the map existed. `seat-rota.module.ts`'s `activeSeat()` gains an optional 4th parameter, a completion predicate `(seat: SeatFact) => boolean` defaulting to `() => false`; only `AroundTheClockEngine` passes a real one, because a miss costs it an extra visit and its two seats can therefore finish in a different number of visits — every other engine's fixed-turn-count shape, or match-ending-early shape, means the default pure-alternation behavior already attributes turns correctly.".

### Consequences
`docs/game-rules/rulesets/{bobs-27,121,around-the-clock,ten-up-one-down,shanghai,score-training}.md` each carry a one-line 1v1 win condition in the game's own terms; `doubles-training.md` already carried one from its own engine task. `docs/game-rules/rulesets/singles-training.md` does not yet state its 1v1 win condition in prose (still reads "Multiplayer / online multiplayer" under Later Versions) despite `SINGLES_V1` shipping a real score-compare win condition (highest `totalPoints`) — logged to `FINDINGS.md` rather than fixed here, since it falls outside this doc-only task's named file list. `docs/architecture/04-Architecture-patterns.md` Pattern 18 and `docs/architecture/06-API/04-Endpoint-Contracts.md`'s `POST /sessions` section now document the win-condition categories and the `SEAT_CAPS` table respectively. See `docs/superpowers/specs/2026-08-22-single-opponent-seat-remaining-engines-design.md` for the full per-engine design — its own title reads "Remaining 7 Engines" while its scope line and `SEAT_CAPS` both list eight rulesets; a pre-existing naming quirk in that spec, not corrected here.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-22
Referenced by D0231's `Supersedes:` line.

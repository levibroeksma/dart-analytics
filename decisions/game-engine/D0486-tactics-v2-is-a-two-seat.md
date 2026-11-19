---
id: D0486
status: accepted
date: 2026-10-23
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, 501]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Tactics V2 is a two-seat ruleset version with a cross-seat fold

## Context and Problem Statement
a dart's points depend on the opponent's marks at that moment, so the V1 per-seat fold cannot express them; D422 named multiplayer a later version.

## Decision Drivers
* Tactics V1 is a solo close-out drill, and V2 adds two-seat play: points on owned numbers, dead numbers and a win by closing out level or ahead (spec § 1).
* Solo under V2 plays exactly as V1, and V1 solo sessions replay unchanged (spec §§ 1, 12).
* The seat switch uses the 501 animation by reusing the 501 shell (spec § 1).
* One shared fold, with no duplicated code, so Cricket multiplayer can reuse it later (spec §§ 1, 5).

## Considered Options
* Add `TACTICS_V2` as a new ruleset version beside an untouched `TACTICS_V1`, with a two-seat duel fold (chosen).
* Keep the V1 per-seat fold. The spec locks a new version instead and says points depend on the opponent's marks at each dart (spec §§ 1, 4).

## Decision Outcome
Chosen option: "`TACTICS_V2` (seed `0051`) adds 1v1 to `TACTICS`. Spare marks beyond the third score marks × number value (bull 25) while the opponent has not closed the number; a number is dead once both seats close it; the auto rule is points first (a double or treble on a 15–20 number you own scores on it and marks Doubles/Triples only once the number is dead); the game ends on the first dart that leaves the throwing seat closed out with points at least equal to the opponent's, so it cannot end level. Solo under V2 folds as V1. Points, dead numbers and the winner are folded from both seats' dart facts in log order by `foldMarksDuel` (`marks-duel.module.ts`); nothing new is stored, no migration. One `TacticsEngine` serves both keys; setup picks V2 only when a guest is added, so solo history stays one stats group. Seat cap 2; no DartBot. Tactics plays on `SeatedPlayScreen` so the seat-switch animation is the 501 one.", because a dart's points depend on the opponent's marks at that moment, so the V1 per-seat fold cannot express them; D422 named multiplayer a later version.

### Consequences
Cricket multiplayer can reuse `foldMarksDuel` with its own hit rule; the dual-purpose player choice, Strict, Minnesota Cricket and a Tactics stats view stay V2+ (`docs/game-rules/rulesets/tactics.md`). `recordMarksDart` takes an optional `isEnded`. Spec: `docs/superpowers/specs/2026-10-23-tactics-v2-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/tactics.golden.test.ts` and `app/tests/modules/game/tactics.engine.module.test.ts` cover the engine. `app/tests/lib/game/tactics-setup.data.test.ts` and `app/tests/lib/game/tactics-play.data.test.ts` mention `TACTICS_V2` for setup and play data.

## Pros and Cons of the Options
### `TACTICS_V2` with a cross-seat fold
* Good, because the duel fold walks both seats' dart facts in log order, so points that depend on the opponent's marks at that dart come out right (spec § 4).
* Good, because the spec designs the shared duel module with no Tactics knowledge, so Cricket multiplayer can supply its own hit rule and reuse it (spec § 5). Commit `d88a61dc` (D506) later deleted `marks-duel.module.ts`.
* Good, because the seat-count branch keeps the V1 path, and V1 solo output stays byte-identical (spec §§ 5, 11).

### Keep the V1 per-seat fold
* Bad, because the V1 fold cannot express points that depend on the opponent's marks at that dart (record Context).

## Evidence / More Information
Decided: 2026-10-23

* `docs/superpowers/specs/2026-10-23-tactics-v2-design.md` (§ 1–5, 8–11, 13): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Commit `93078b54` (2026-10-23, adds the D486 row): the decision row, spec refinements and inventory.
* Applied in: `docs/superpowers/plans/2026-10-23-tactics-v2.md`, `docs/superpowers/plans/2026-10-24-cricket-v2.md`.

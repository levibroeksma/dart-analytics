---
id: D0487
status: accepted
date: 2026-10-24
origin: contemporaneous
original-date:
tags: [game-engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Cricket V2 is a two-seat ruleset version on the shared duel fold

## Context and Problem Statement
D421 named multiplayer a later version; D486 built the cross-seat fold for exactly this reuse.

## Decision Drivers
* Cricket V1 is a solo close-out drill; two-seat play is the later version D421 named (spec § 1).
* Scope is Classic 1v1 only; Cut-throat, No-Score, Single-Only and other variants stay V2+ (spec § 1).
* V1 solo behaviour and sessions stay untouched (spec § 10).
* No code is duplicated from Tactics: `foldMarksDuel` is reused and shared code moves once into shared modules (spec § 1).

## Considered Options
* A new ruleset version `CRICKET_V2` beside `CRICKET_V1` (chosen).
* Guest and DartBot opponents. The spec defers DartBot: no DartBot strategy can aim at an objective, so a marks strategy and its calibration come first.

## Decision Outcome
Chosen option: "`CRICKET_V2` (seed `0052`) adds 1v1 against a guest to `CRICKET`. Spare marks beyond the third score marks × number value (bull 25) while the opponent has not closed the number; a number is dead once both seats close it; the game ends on the first dart that leaves the throwing seat closed out with points at least equal to the opponent's, so it cannot end level. Solo under V2 folds as V1. The fold is `foldMarksDuel` (D486) with Cricket's own hit rule; nothing new is stored, no migration. One `CricketEngine` serves both keys; setup picks V2 only when a guest is added, so solo history stays one stats group. Seat cap 2. No DartBot: no strategy can aim at an objective.", because D421 named multiplayer a later version; D486 built the cross-seat fold for exactly this reuse.

### Consequences
Tactics and Cricket share `foldMarksDuel`, `foldMarksSeats`, the `MarksEngine` base class, `recordMarksDart`'s `isEnded`, `lib/game/marks-play.data.ts`, `MarksPlayScreen.astro` and one replay presenter. A DartBot marks strategy, Cut-throat, No-Score, Single-Only, more than two seats and a Cricket stats view stay V2+ (`docs/game-rules/rulesets/cricket.md`). Spec: `docs/superpowers/specs/2026-10-24-cricket-v2-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/cricket.engine.module.test.ts` and `cricket.golden.test.ts` cover the duel fold and the unchanged V1 solo goldens (spec § 9 items 1-3).

## Pros and Cons of the Options
### `CRICKET_V2` beside `CRICKET_V1`
* Good, because V1 solo goldens fold byte-identically apart from the added `points: 0`.

### Guest and DartBot
* Bad, because no DartBot strategy can aim at an objective yet.

## Evidence / More Information
Decided: 2026-10-24

* `docs/superpowers/specs/2026-10-24-cricket-v2-design.md` (§ 1, § 9, § 10): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons.
* Commit `2b2378ee` (PR #1077, 2026-10-24, "Cricket V2 (1v1 vs guest)"): adds the original ledger block.

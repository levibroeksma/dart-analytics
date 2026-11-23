---
id: D0256
status: superseded
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, 501, leg, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0338
---

# `double-attempt.module.ts` classifies dart-level double-attempt accuracy for 501/TUOD/121, replacing their leg/round-level checkout stats

## Context and Problem Statement
`five-oh-one-play.data.ts` reported `checkoutPercentage` as `legsWon / (legsWon + checkoutAttemptCount)`, a leg-level ratio. One won leg with no busted checkout visit reads 100%, however many darts missed the double. `tuod-play.data.ts`'s `attempts`/`successes`/`failures` repeat the flaw per round, and 121 had no checkout stat. None of the three reported individual darts thrown at a double.

## Decision Drivers
* The leg and round-level stats measure the wrong unit: legs and rounds, not darts.
* The result must be provably correct from board geometry. D06 warns that naming an intent the player never held corrupts the intended-vs-hit analysis.
* `05-Views.md` forbids game-engine logic in views, so the classifier lives in an app module.

## Considered Options
* Keep the leg and round-level checkout stats (status quo).
* Count every dart thrown at a double-eligible remaining score as a miss, whatever it hits.
* Classify each dart from the board geometry of where it landed relative to the required double (chosen).

## Decision Outcome
Chosen option: "501's `checkoutPercentage` (`legsWon / (legsWon + checkoutAttemptCount)`) and TUOD's `attempts`/`successes`/`failures` both measured whole legs/rounds, not darts -- a won leg with zero busted visits reads 100% regardless of how many individual darts missed a double, and 121 had no checkout stat at all. Added `modules/game/double-attempt.module.ts`, classifying each dart against the double its remaining score needed at the moment it was thrown: eligible only when that remaining score is directly finishable by one dart (even and ≤40, or exactly 50); a double/bull hit is a hit or miss depending on whether it actually checked out; a single/treble hit counts as a miss only when it lands on the same or a board-adjacent segment (reusing `SECTOR_ORDER` from `board-geometry.module.ts`) to the required double; anything else (an unrelated single/treble, or a coordinate-less bounce-out) is excluded entirely -- a deliberate lay-up/reroute, never fabricated as a miss. Deliberately does not store or guess *which* double a player intended (D06's Singles Training precedent: naming an intent the player never held corrupts the analysis) -- only the geometric fact of where the dart landed relative to what the remaining score required.".

### Consequences
501's `FiveOhOneSeatResult.checkoutPercentage` and TUOD's `attempts`/`successes`/`failures` are removed, replaced by `doubleAccuracy: string | null` (null outside VISUAL_BOARD capture, same gating `checkoutAttemptCount` used). 121 gains `doubleAccuracy` as a new field. A persisted view, `v_double_out_checkout_darts` (migration `0024`), covers 501 history reads only -- TUOD/121's remaining-before-dart needs their ladder fold (`foldTuodState`/`foldOneTwentyOneState`), which is game-engine logic and does not belong in SQL (`05-Views.md`); their persisted reads are deferred to a future application-layer replay. Full design: `docs/superpowers/specs/2026-09-05-double-out-checkout-accuracy-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/double-attempt.module.test.ts` covers the classifier.

## Pros and Cons of the Options
### Keep leg and round-level stats
* Bad, because a won leg with no busted visit reads 100% regardless of missed doubles.

### Count every eligible dart as a miss
* Bad, because the spec calls the naive per-dart heuristic dangerous: a deliberate lay-up counted as a miss corrupts the stat.

### Geometric classification
* Good, because a dart that lands elsewhere is excluded, so no miss is fabricated.
* Good, because one pure function serves the live in-session result and any later persisted read.

## Evidence / More Information
Decided: 2026-09-05

* `docs/superpowers/specs/2026-09-05-double-out-checkout-accuracy-design.md` (Context, precedent section, classification rule, "Where the logic lives"): rebuilt Context, Decision Drivers, Considered Options, Pros and Cons.
* `docs/superpowers/plans/2026-09-05-double-out-checkout-accuracy.md`: names D256; no section rebuilt.
* Commit `6e58d5c4` (PR #242, 2026-09-05): the adding commit.
* Superseded by D338, which corrects two of this record's exclusions.

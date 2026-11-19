---
id: D0276
status: accepted
date: 2026-09-14
origin: contemporaneous
original-date:
tags: [game-engine, scoring, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Switching stamps `TREBLE` as every dart's intended zone

## Context and Problem Statement
`darts` admits an intended zone only as both-null or zone-not-null (`chk_dart_target_consistency`, migration `0007`), mirrored by `DartFact`'s refinement in `pages/api/sessions/types.ts`. A Switching dart carried a target with a null zone, so `POST /api/sessions/:id/events/batch` rejected the step's whole batch with `VALIDATION_FAILED`; `advanceAfterStepCompletion` threw before nulling the engines, and Balanced Training stopped at "Could not continue to the next step. Try again." with the Switching panel still mounted — the routine could never reach Double Pattern. Dropping `intendedTargetNumber` instead was rejected: the play screen's three-dart preview marks a hit by comparing `hitTargetNumber` to `intendedTargetNumber`, and the attribution is real data, not a guess. `TREBLE` is the exercise's actual aim — `09-Training/01-Routines.md` §17 writes the sequence as `T20 → T19 → T18`, and the seeded scoring pays the treble most — so it names an intent the player genuinely held (D06's rule against fabricating intent).

## Decision Drivers
* The events batch for a Switching step must pass `chk_dart_target_consistency` and `DartFact`'s mirror of it, so Balanced Training can advance to Double Pattern.
* The stored intent must be one the player genuinely held (D06's rule against fabricating intent).
* The play screen's three-dart preview needs `intendedTargetNumber` to mark a hit.

## Considered Options
* Stamp `TREBLE` as every dart's intended zone, alongside the visit's `intendedTargetNumber` (chosen).
* Drop `intendedTargetNumber` so target and zone are both null (rejected).

## Decision Outcome
Chosen option: "`SwitchingEngine.record()` writes `intendedZoneKey: "TREBLE"` alongside the visit's current `intendedTargetNumber`, replacing the `null` it wrote before. Scoring is untouched: `pointsFor` still reads the ring that was hit against the configured `single`/`double`/`treble` values, so every ring on the target still scores and the stored zone is intent only.".

### Consequences
Switching darts now carry a miss margin: `lib/game/board/miss-margin.module.ts` and `modules/dartbot/population-prior.module.ts` both skip a dart with a null intended zone, so these darts were invisible to both and are no longer. `DoublePatternEngine` already stamped `"DOUBLE"` and is unchanged. No migration or seed change — `TREBLE` is an existing `dart_zones` row (`seeds/0001`). Sessions recorded before this fix uploaded nothing for their Switching step, so there is no stored data to backfill.

* Good, because Balanced Training can advance past the Switching step to Double Pattern.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/switching.engine.module.test.ts` holds the `SwitchingEngine upload payload` tests. One checks that `EventsBatchRequest` accepts the engine's facts. The other checks that each dart carries `intendedTargetNumber` and `intendedZoneKey: "TREBLE"`.

## Pros and Cons of the Options
### Stamp `TREBLE` as every dart's intended zone
* Good, because the step's batch passes the target-consistency check, so Balanced Training can reach Double Pattern.
* Good, because `TREBLE` is the exercise's aim (`T20 → T19 → T18`), so it records an intent the player held.
* Good, because the play screen's preview keeps comparing `hitTargetNumber` to `intendedTargetNumber`.

### Drop `intendedTargetNumber`
* Bad, because the preview marks a hit by comparing `hitTargetNumber` to `intendedTargetNumber`, and the attribution is real data, not a guess.

## Evidence / More Information
Decided: 2026-09-14

* Commit `44e49f47` (2026-09-14, adds the D276 row): rebuilt Decision Drivers, Considered Options, Pros and Cons and the Switching-step Good consequence from its message and the row's Reason. It also added the two tests named in Confirmation, since moved to the path given there.

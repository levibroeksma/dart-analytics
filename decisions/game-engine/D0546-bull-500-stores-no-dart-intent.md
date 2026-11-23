---
id: D0546
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Bull 500 stores no dart intent

## Context and Problem Statement
whole-branch review. The first design stored number 25, then 20, with no ring; `chk_dart_target_consistency` (migration `0007`) and the API `DartFact` schema refuse a number with a null ring, so no game could upload. The rules file left the 20's ring free, so no ring can be named.

## Decision Drivers
* `chk_dart_target_consistency` refuses a number with a null ring, so the first design could not be saved (spec § 9).
* The rules file leaves the 20's ring free, so no ring can be named (spec § 3a, § 9).

## Considered Options
* Store `intendedTargetNumber` 25, then 20, with no ring: the original call, which violates `chk_dart_target_consistency` (spec § 9).
* Store a ring (`INNER_BULL`, then `TREBLE`): contradicts the rules file's free ring (record Consequences).
* Store no intent, as Singles Training does (spec § 9).

## Decision Outcome
Chosen option: "Bull 500 darts carry `intendedTargetNumber` and `intendedZoneKey` both `null`. The aim (the bull until the visit unlocks, then the 20) is derived from the dart order. The replay's Visit figure is the points a visit booked, not its dart sum, and its Result reads `Locked` (no bull), `Bull` (a bull and no scoring dart) or `Scored`. A dart unlocks only as number 25 in an `OUTER_BULL` or `INNER_BULL` zone.".

### Consequences
a test now runs the engine's darts through the API `DartFact` schema. Option not taken: a stored ring (`INNER_BULL`, then `TREBLE`), which contradicts the rules file's free ring.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/bull-500.engine.module.test.ts` imports the API `DartFact` schema and runs the engine's darts through it.

## Pros and Cons of the Options
### Store no intent
* Good, because a dart with a null number and a null ring satisfies `chk_dart_target_consistency`, so the game can upload (spec § 9).

### Store number 25, then 20, with no ring
* Bad, because `chk_dart_target_consistency` and the API `DartFact` schema refuse a number with a null ring, so no game could upload (spec § 9).

## Evidence / More Information
Decided: 2026-11-10
Supersedes: none. Narrows the intent clause of the Bull 500 spec §3a/§5 (D545 is unchanged).

* `docs/superpowers/specs/2026-11-10-bull-500-design.md` (§ 3a, § 9): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* Commit `4e7a0e24`: adds the D546 row.
* Applied in: `docs/superpowers/plans/2026-11-10-bull-500.md`.

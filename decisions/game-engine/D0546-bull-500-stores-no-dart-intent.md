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
<!-- backfill: pending -->

# Bull 500 stores no dart intent

## Context and Problem Statement
whole-branch review. The first design stored number 25, then 20, with no ring; `chk_dart_target_consistency` (migration `0007`) and the API `DartFact` schema refuse a number with a null ring, so no game could upload. The rules file left the 20's ring free, so no ring can be named.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Bull 500 darts carry `intendedTargetNumber` and `intendedZoneKey` both `null`. The aim (the bull until the visit unlocks, then the 20) is derived from the dart order. The replay's Visit figure is the points a visit booked, not its dart sum, and its Result reads `Locked` (no bull), `Bull` (a bull and no scoring dart) or `Scored`. A dart unlocks only as number 25 in an `OUTER_BULL` or `INNER_BULL` zone.".

### Consequences
a test now runs the engine's darts through the API `DartFact` schema. Option not taken: a stored ring (`INNER_BULL`, then `TREBLE`), which contradicts the rules file's free ring.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-10
Supersedes: none. Narrows the intent clause of the Bull 500 spec §3a/§5 (D545 is unchanged).

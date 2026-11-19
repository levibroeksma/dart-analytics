---
id: D0560
status: accepted
date: 2026-11-17
origin: contemporaneous
original-date:
tags: [api]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `loose-darts` classifies a missed dart as a near miss within 20 mm of the aimed bed

## Context and Problem Statement
the owner wants closeness, not bed adjacency, to define a near miss: a dart just outside the double is as near as one in the neighbouring double, and a neighbouring double far from the aim is not near at all.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "for every game that serves `loose-darts` (Singles Training, Shanghai, Around the Clock, Bob's 27, Doubles Training) a dart is `onTarget` when it hit the aim, `nearMiss` when it missed but landed within `NEAR_MISS_MM` (20 mm, inclusive) of the nearest point of the aimed bed, and `loose` when farther. Distance is measured by `distanceToAim` (`lib/game/board/aim-distance.module.ts`) over the shared board geometry: to the aimed wedge for a numbered ring, to the full wedge across all rings for `NUMBER:n`, to the bull disc for a bull aim. Off-board darts are measured like any other. A hit with no landing point stays `onTarget`; a miss with no landing point is counted in the bucket `sampleSize` only. The stored-aim path reads one row per dart (`findIntentLandings`) and refuses a range above `MAX_LANDING_DARTS` (50,000 darts) as `VALIDATION_FAILED`; shaping 50,000 landings measured 40 ms. The section `version` is 2.".

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.10.0 (§1.1 rewritten). Response shape unchanged. Past sessions reclassify at read time; no migration.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-17
Supersedes: D368 decision 9 (ring and sector adjacency); D370 decision 8 (neighbouring-number and `INNER_SINGLE` rule for `NUMBER`/`BULL` aims).

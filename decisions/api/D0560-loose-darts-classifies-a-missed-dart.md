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

# `loose-darts` classifies a missed dart as a near miss within 20 mm of the aimed bed

## Context and Problem Statement
the owner wants closeness, not bed adjacency, to define a near miss: a dart just outside the double is as near as one in the neighbouring double, and a neighbouring double far from the aim is not near at all.

## Decision Drivers
* A near miss should mean physical closeness, within 20 mm of the aimed bed, inside or outside (spec, Intent).
* One distance rule classifies every dart for `loose-darts` in every game that uses the section (spec, Goals).
* The rule is defined once in shared board geometry, reusing `distanceToBed` and `distanceToDisc`, and geometry stays single-sourced in TypeScript (spec, Goals and Constraints).
* A dart is never dropped from `onTarget` because its coordinates are missing (spec, Anti-goals).

## Considered Options
* A 20 mm inclusive distance rule measured to the nearest point of the aimed bed (chosen).
* Neighbouring-bed adjacency, which D368 decision 9 and D370 decision 8 set before this record.

## Decision Outcome
Chosen option: "for every game that serves `loose-darts` (Singles Training, Shanghai, Around the Clock, Bob's 27, Doubles Training) a dart is `onTarget` when it hit the aim, `nearMiss` when it missed but landed within `NEAR_MISS_MM` (20 mm, inclusive) of the nearest point of the aimed bed, and `loose` when farther. Distance is measured by `distanceToAim` (`lib/game/board/aim-distance.module.ts`) over the shared board geometry: to the aimed wedge for a numbered ring, to the full wedge across all rings for `NUMBER:n`, to the bull disc for a bull aim. Off-board darts are measured like any other. A hit with no landing point stays `onTarget`; a miss with no landing point is counted in the bucket `sampleSize` only. The stored-aim path reads one row per dart (`findIntentLandings`) and refuses a range above `MAX_LANDING_DARTS` (50,000 darts) as `VALIDATION_FAILED`; shaping 50,000 landings measured 40 ms. The section `version` is 2.".

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.10.0 (§1.1 rewritten). Response shape unchanged. Past sessions reclassify at read time; no migration.

* Neutral, because the `loose-darts` section `version` moves from 1 to 2, since the result for the same data changes. Frontend consumers and API types keep working unchanged (spec, Constraints).
* Neutral, because no migration, endpoint, section id or metric field changes (spec, Non-goals).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec requires tests for each aim kind at 19.99, 20.00 and 20.01 mm. It also requires tests for an off-board dart on each side and a dart with no landing point (hit and miss). A neighbouring-bed dart beyond 20 mm completes the list. `tests/lib/game/board/aim-distance.module.test.ts` and `tests/modules/stats/sections/loose-darts.module.test.ts` exist today.

## Pros and Cons of the Options
### A 20 mm distance rule
* Good, because a dart that lands outside the double or off the board, within 20 mm, counts as a near miss (spec, The rule).
* Good, because past sessions reclassify at read time and no stored data changes (spec, Goals).
* Bad, because neighbouring-bed darts more than 20 mm away are now loose. The spec calls this intended (spec, The rule).

### Neighbouring-bed adjacency
* Bad, because a dart outside the double or off the board counts as loose even when it is close (spec, Intent).

## Evidence / More Information
Decided: 2026-11-17
Supersedes: D368 decision 9 (ring and sector adjacency); D370 decision 8 (neighbouring-number and `INNER_SINGLE` rule for `NUMBER`/`BULL` aims).

* `docs/superpowers/specs/2026-11-17-near-miss-distance-rule-design.md` (Intent, Goals, Non-goals, Anti-goals, The rule, Constraints, Left to the builder): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons and Consequences.
* `docs/superpowers/plans/2026-11-17-near-miss-distance-rule.md` (Task 1, Task 5, Task 6): the plan proposes `MAX_LANDING_DARTS` at 50,000, provisional until a measurement. It rebuilt no section.
* Commit `63ee1a97` (2026-11-17, "docs(stats): near-miss distance rule decision and catalog"; adds the D560 row): source of the Context and Decision Outcome text.
* Applied in: `docs/superpowers/specs/2026-11-17-doubles-training-statistics-page-design.md`, `docs/superpowers/specs/2026-11-17-track-games-statistics-page-design.md`, `docs/superpowers/specs/2026-11-17-ace-statistics-page-design.md`.

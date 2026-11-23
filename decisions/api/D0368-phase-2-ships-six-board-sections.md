---
id: D0368
status: accepted
date: 2026-09-26
origin: contemporaneous
original-date:
tags: [api, endpoint, session, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Phase 2 ships six board sections over one shared dart-level aggregate, geometry single-sourced in TS, and a `target` parameter gated by registry `params` and the `intent-stored` tag

## Context and Problem Statement
one shared aggregate for three sections avoids three near-identical SQL queries over the same dart-level facts, and keeps the intended×hit cross-tab — the thing all three actually read — computed once. Binding geometry as SQL parameters rather than duplicating ring radii/sector math in SQL keeps `board-geometry.module.ts` the single source of a dartboard's shape, consistent with the read-model rule against game rules in SQL (`05-Views/00-Overview.md` §Business Logic). The `target` parameter needed an explicit accept-list (`params`) rather than a blanket allow, because most sections have no meaningful per-target narrowing and a silently-ignored parameter is a worse failure mode than a rejected one (D365's own rule).

## Decision Drivers
* Board geometry stays single-sourced in TypeScript (catalog § 1.1), so SQL never holds an aim point.
* The `loose-darts` section works over unbounded ranges.
* Sums re-aggregate exactly across buckets (`00-Overview.md` § 5.1).
* A parameter is never silently ignored (`00-Overview.md` § 5).
* A dart aimed at D16 is the same fact under any ruleset version.

## Considered Options
* Keep `loose-darts` at the `server` site, as the catalog earlier listed it.
* Return means from `grouping` instead of moment sums.
* Phase 2 sections on shared aggregates, with geometry bound as SQL parameters (chosen).

## Decision Outcome
Chosen option: "nine decisions for the phase 2 build (`docs/superpowers/plans/2026-09-26-statistics-phase-2-board-sections.md`):
1. Singles Training is out of the intent family in phase 2: D367 decision 7 already re-tagged it `intent-derived` (its engine stores no intent), so its page gains `heatmap` only here; its accuracy sections come with phase 4's derived-intent fold.
2. `target-accuracy`, `confusion` and `loose-darts` all project one intent-cell aggregate: intended (number, zone) × hit (number, zone) counts per bucket (`findIntentCells`). `loose-darts` moves from the catalog's earlier `server` site to `sql`: SQL counts the cells, and `loose-darts.module.ts` classifies each **aggregated cell** with board geometry, so geometry stays single-sourced (catalog §1.1) and the section works over unbounded ranges. A hit is exact pair equality — `isHit` (`intent-cells.module.ts`) is parity-tested against `isHitOn` (`board-progression.module.ts`) for every intent Doubles Training and Bob's 27 store.
3. `grouping` returns additive position moment sums (`n, sumX, sumY, sumXX, sumYY, sumXY`) per intended pair, never means — sums re-aggregate exactly across buckets (`00-Overview.md` §5.1). `groupingSummary` (`grouping.module.ts`) derives mean offset, spread and bearing isomorphically against `zoneCentroid`, so SQL never holds an aim point.
4. `miss-direction` binds its reference points as a `VALUES` table built in TS from `zoneCentroid` + `BOARD_RADII_MM` (`missReferences()`, `miss-direction.module.ts`) and passed as bound parameters (`findMissSectors`) — SQL does only arithmetic: bearing sector (`ATAN2`, split into 8 sectors of 45°, sector 0 centred on "up") and radial class (`INSIDE`/`WITHIN`/`OUTSIDE` the intended ring band; for a double this is the inside/outside-the-wire split). Only missed darts count.
5. The target key format is `<ZONE_KEY>:<number>` (a `TargetKey`), the record key for every intent metric and the value of a new optional `target` query parameter. Only a section declaring it in the registry (`params: ["target"]`) accepts it, and only on a game with the `intent-stored` tag; in phase 2 that is `heatmap` on Doubles Training and Bob's 27. Anything else is `VALIDATION_FAILED`, never silently ignored, and `target` joins the client cache's `paramsKey` (absent-target keys are unchanged, so phase 1 cache entries survive).
6. The heatmap grid uses `HEATMAP_CELL_MM = 5` square cells, origin at the bull, `ix = floor(x / 5)`/`iy = floor(y / 5)`; only non-empty cells are returned as `[ix, iy, darts]` tuples, with the cell size echoed in the result. `bucketable: false`. Changing the cell size bumps the section `version`.
7. None of the six board sections declares `configSensitive`: a dart aimed at D16 is the same fact under any ruleset version, so versions pool. Both games in scope have one version each today.
8. Status and context follow phase 1: none of the six sections has `includesAbandoned`, so only `status=completed` is accepted; `context` filters exactly as in phase 1.
9. `loose-darts` adjacency (a constant in `loose-darts.module.ts`; changing it bumps `version`): **on-target** is exact pair equality; **near-miss** is the same ring in either neighbouring sector (`SECTOR_ORDER`) or the neighbouring ring in the same sector (ring order `INNER_SINGLE`, `TREBLE`, `OUTER_SINGLE`, `DOUBLE`; `INNER_BULL`↔`OUTER_BULL` for the bull); **loose** is anything else, including `MISS`.".

### Consequences
`10-Statistics/00-Overview.md` §2 (`params` field), §5 (`target` parameter) and `01-Section-Catalog.md` §1 (site/reason columns) and §1.1 (adjacency table) are corrected/extended to match this block (version bump 1.2.0). `06-API/04-Endpoint-Contracts.md` gains the six sections' metric shapes and the `target` rule. `sectionsForGame` now filters by the union of a game's ruleset versions' `STATS_TAGS`, exercised for the first time outside `requires: []` sections. Task 3 Step 4's `EXPLAIN` measurement needs `DATABASE_URL`, unavailable in the implementing session's container; recorded as a known limitation in the PR rather than skipped silently, per D344's own carve-out logic (a session with no `DATABASE_URL` cannot produce the proof a schema change would need, and none was made here since this phase adds no migration).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/stats/sections/intent-cells.module.test.ts` pins `isHit` parity with `isHitOn` for every intent Doubles Training and Bob's 27 store. `app/tests/lib/game/rulesets/stats-tags.test.ts` asserts that only Doubles Training and Bob's 27 carry `intent-stored`. `app/tests/modules/stats/sections/heatmap.module.test.ts` covers the heatmap cell size.

## Pros and Cons of the Options
### `loose-darts` at the `server` site
* Bad, because it does not work over unbounded ranges.

### Means from `grouping`
* Bad, because means do not re-aggregate exactly across buckets.

### Shared aggregates with geometry in TypeScript
* Good, because geometry stays single-sourced and sums re-aggregate exactly.

## Evidence / More Information
Decided: 2026-09-26
Refines: D367
Referenced by D0560's `Supersedes:` line.

* `docs/superpowers/plans/2026-09-26-statistics-phase-2-board-sections.md` (Plan-level decisions 1 to 7, Task 9): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Partly superseded by D560 (decision 9). `docs/superpowers/specs/2026-11-17-near-miss-distance-rule-design.md` (Intent) says decision 9 defined a near miss as a neighbouring bed.

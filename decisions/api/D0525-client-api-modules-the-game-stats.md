---
id: D0525
status: accepted
date: 2026-11-05
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Client API modules, the game stats store, ruleset config schemas and intent-cell folds share small helpers

## Context and Problem Statement
the client API modules, the stats store, the ruleset config schemas and the two intent-cell folds were the clone groups left after D522. Each helper takes data (a schema, a field list, an accessor, a seed and a step), so no flags.

## Decision Drivers
* Remove as much duplication as possible, so a rule change is made once (`docs/superpowers/specs/2026-10-31-duplication-backlog-design.md`, Intent).
* Every phase lowers `scripts/dupes-baseline.txt` (spec, Goals 4).
* No behaviour change: every store getter, client API error class and ruleset schema keeps its output (plan, Global Constraints).
* No per-caller boolean flags. Variation goes through data parameters, and a group that needs a flag is skipped and named (plan, Global Constraints).

## Considered Options
* Shared helpers that take data (a schema, a field list, an accessor), with the `validateBatch` copy skipped (chosen).
* Share the `validateBatch` gate of Score Training and TUOD behind a per-mode flag.
* Leave the clone groups in the baseline, which is the state the D513 ratchet leaves.

## Decision Outcome
Chosen option: "`SessionApiError` moves to `lib/client/api/session-api-error.ts` and `sessions.ts` re-exports it, so every importer and every `instanceof` check resolves to one class; `unwrap.ts` imports it from there (the `sessions.ts` ↔ `unwrap.ts` cycle is gone), and `sessions.ts` and `training-sessions.ts` use `unwrapOrThrow`. `statistics.ts` gains the unexported `unwrapStatistics` (throws `StatisticsApiError(code, message)`) and `appendPage`. `modules/stats/sections/hit-rate-rows.module.ts` holds `foldSeriesByKey`, `hitRateRows`, `bestRate`/`worstRate`, `sumInBand` and `seriesKeys`; `HitRateRow` and `HitRateTotals` live in `modules/stats/types.ts`. The `game-stats.store.ts` getters (`accuracyRows`, `doubleRows`, `favoriteTarget`, `weakestTarget`, `favoriteDouble`, `weakestDouble`, `checkoutRateBands`, `bustRateBands`, `atcConfigGroups`, `bobs27ConfigGroups`, `groupingRows`) keep their names and return shapes. `rulesets/types.ts` gains `durationValueRefinement`, `targetOrderRefinement`, `maxDartsPerTurnField`, `maxVisitScoreField`, `singlesPointsFields`, `singlesV2CommonFields`, `startingScoreField` and `fiveOhOneCommonFields`, spread at the keys' old positions. `intent-cells.module.ts` gains `intentCellBuckets(rows, ctx, empty, add)`, the fold of `target-accuracy` and `loose-darts`.".

### Consequences
no HTTP, SQL, schema or store output change. Pinned by `tests/lib/game/rulesets/schema-shape.test.ts` (key order, strictness, refinement messages) and `tests/modules/stats/sections/hit-rate-rows.module.test.ts`. Accepted difference: `fetchSessionReplay` sends `limit` before `cursor` in the query string (same meaning to the server). `sumInBand` returns an array as wide as the data (callers default each slot to 0). Skipped on purpose: the `validateBatch` copy of `score-training.validator.ts` and `tuod.validator.ts` (Score Training checks its rounds limit on both capture modes, TUOD only on quick score, so sharing it needs a per-mode flag; issue #1184 stays open). Baseline 22 → 17 rows (`sessions.ts | training-sessions.ts`, `statistics.ts`, `rulesets/types.ts`, `loose-darts | target-accuracy` and `game-stats.store.ts` rows gone). Plan: `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4a.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`tests/lib/game/rulesets/schema-shape.test.ts` pins key order, strictness and refinement messages. `tests/modules/stats/sections/hit-rate-rows.module.test.ts` pins the hit-rate helpers. `tests/modules/stats/sections/intent-cells.module.test.ts` covers the shared intent-cell fold. The plan lists `scripts/check-refinement-coverage.sh` and `scripts/check-dupes.sh` among its gates; both exist today.

## Pros and Cons of the Options
### Shared helpers that take data
* Good, because a fix no longer lands in one copy and not the others (spec, Intent).
* Good, because `session-api-error.ts` removes the `sessions.ts` and `unwrap.ts` import cycle (plan, Task 1).

### Share the `validateBatch` gate behind a flag
* Bad, because sharing needs a per-mode flag: Score Training checks its rounds limit on both capture modes, TUOD only on quick score. The plan forbids per-caller flags (plan, Task 5 Step 2).

### Leave the clone groups in the baseline
* Bad, because each copy is a place where a fix lands in one game and not the others (spec, Intent).

## Evidence / More Information
Decided: 2026-11-05
Supersedes: none. Extends D513, D521, D522.

* `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4a.md` (Goal, Global Constraints, Review Focus, Tasks 1–5): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Intent, Goals, Phase 4): rebuilt Decision Drivers and Pros and Cons.
* Commit `10e4cc6e` (2026-11-05, "docs(dupes): D525, baseline 22 -> 17, inventory and history for phase 4a"): source of the Context and Decision Outcome text.

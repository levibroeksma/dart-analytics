---
id: D0521
status: accepted
date: 2026-11-04
origin: contemporaneous
original-date:
tags: [api, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Statistics repository readers share one bucket window; section request resolution and timing schema fields are shared

## Context and Problem Statement
the statistics repository, service and API types were the largest clone groups left in the D513 baseline. Each helper takes only what differs, so no flags.

## Decision Drivers
* Remove as much duplication as possible, so a rule change is made once (`docs/superpowers/specs/2026-10-31-duplication-backlog-design.md`, Intent).
* Every phase lowers `scripts/dupes-baseline.txt` (spec, Goals 4).
* No behaviour change: the rendered SQL text and params of every statistics reader stay byte-identical (plan, Global Constraints).
* No per-caller boolean flags. Variation goes through data parameters, and a group that needs a flag is skipped and named (plan, Global Constraints).

## Considered Options
* Shared helpers that take only what differs, with the migrated readers proven by a rendered-SQL golden (chosen).
* Merge the remaining groups with per-caller boolean flags.
* Leave the clone groups in the baseline, which is the state the D513 ratchet leaves.

## Decision Outcome
Chosen option: "`bucketWindow(completedAt, q)` in `statistics.repository.ts` gives each of the nine bucketed readers one query; drizzle drops an empty GROUP BY, so `bucket: "none"` SQL is unchanged, and `findStepBuckets` keeps `sessions > 0` as a post-query step on `"none"`. Other helpers: `X01_FOLD_COLUMNS` reused by `findX01CheckoutDarts`, `selectHeatmapCells`, `gameWindowConditions`, `stepScopeConditions`, `mapSessionTimings`, `newestFirst`. `resolveGameSectionRequest` now uses `resolveSectionRange` (bucket → target → status order kept); `SESSION_TIMING_FIELDS` is spread into the three statistics API schemas (`pages/api/statistics/types.ts`).", because the statistics repository, service and API types were the largest clone groups left in the D513 baseline. Each helper takes only what differs, so no flags.

### Consequences
skipped on purpose: `findRoutineRunBuckets` (raw SQL; its two branches are different statements, so merging needs a flag). Residual clone group kept: page-reader tail of `findGameSessionsPage`/`findStepSessionPage` (different views, selects, mappers). Accepted difference: in the two page mappers (`findGameSessionsPage`, `findStepSessionPage`) the timing block now runs before `session_id`/identity columns, so when more than one non-null column of a page row is null, the thrown `nonNull` error may name a different column (view-invariant breach only); single-null behaviour and the replay mappers' order are unchanged. Safety net: `tests/repositories/statistics-sql-golden.test.ts` snapshots the rendered SQL. Baseline 32 → 30 rows (`types.ts` and `statistics.service.ts` rows gone, `statistics.repository.ts` 11 → 1). Issue #1172.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`tests/repositories/statistics-sql-golden.test.ts` snapshots the rendered SQL and params of the statistics readers. `tests/pages/api/statistics/types.test.ts` asserts the key order of the timing schema fields. `scripts/check-dupes.sh` fails when a clone group count rises and when a baseline row is stale.

## Pros and Cons of the Options
### Shared helpers that take only what differs
* Good, because a fix no longer lands in one copy and not the others (spec, Intent).
* Good, because the plan proves the refactor with a golden over the rendered SQL, with no snapshot update in the PR (plan, Task F1).
* Bad, because a thrown `nonNull` error may name a different column when several columns are null at once. That breach of a view invariant is the one accepted difference (plan, Task F3).

### Merge with per-caller boolean flags
* Bad, because the plan's Global Constraints forbid per-caller boolean flags.

### Leave the clone groups in the baseline
* Bad, because each copy is a place where a fix lands in one game and not the others (spec, Intent).

## Evidence / More Information
Decided: 2026-11-04
Supersedes: none. Extends D513.

* `docs/superpowers/plans/2026-11-04-duplication-backlog-phase-3b-3c.md` (Goal, Global Constraints, Review Focus, PR F Tasks F1–F5): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Intent, Goals, Anti-goals, Phase 3): rebuilt Decision Drivers and Pros and Cons.
* Commit `1878cae2` (PR #1220; adds the D521 row, the SQL golden and the schema test): source of the Context and Decision Outcome text.

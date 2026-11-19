---
id: D0480
status: accepted
date: 2026-10-22
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

# Step metrics can merge to a minimum; Snakes & Ladders' headline is rounds to finish

## Context and Problem Statement
the rules document names a falling rounds count on a finished run as success; a `max` headline of 21 on both of two finished days hid the improvement, and an unfinished run's rounds polluted the sum (#1057).

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* A `min` merge with direction `lower`, and `finishRounds` as the Snakes & Ladders headline (chosen).
* Keep `highestLevel` as the `max`-merged headline with direction `higher`, as the Snakes & Ladders plan specified before this record.

## Decision Outcome
Chosen option: "`StepMetricSpec.metrics` gains a `"min"` merge and `direction` gains `"lower"`. A `"min"` metric is supplied only by sessions that earn it: `stepMetrics` omits the key, `mergeStepMetrics` keeps the other side's value, `foldStepResult` leaves `headlineMin`/`headlineMax` unmoved and a zeroed result carries no such key. `DOUBLES_SNAKES_LADDERS` adds `finishRounds` (its `rounds`, from a run with `finishes` 1), makes it the headline with direction `lower`, and keeps `highestLevel` as a `max` metric. The routine stats store reports a headline total of `null` when no session supplied it.".

### Consequences
replay cells show "—" for an absent headline. Metrics that never carry `"min"` behave as before.

* Neutral, because a `min` metric comes only from sessions that earn it, so its key can be absent (Section Catalog text, commit `78acacad`).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`tests/modules/stats/step-metrics.module.test.ts` asserts that `finishRounds` merges as `min`. `tests/modules/stats/sections/step-result.module.test.ts` and `tests/stores/routine-stats.store.test.ts` cover the headline.

## Pros and Cons of the Options
### A `min` merge with `finishRounds` as the headline
Rationale unknown — no source found.

### Keep `highestLevel` as the `max` headline
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-22
Refines: D372

* `docs/superpowers/plans/2026-10-22-track-t2-snakes-ladders.md` (Spec refinements, item 9, Stats): rebuilt Considered Options. It names the earlier `highestLevel` headline; it does not cite D480.
* Commit `78acacad` (2026-10-22, "feat(stats): Snakes & Ladders headline is rounds to finish via a min merge (#1057)"; `step-metrics.module.ts` and the Section Catalog diff): rebuilt Considered Options, Confirmation, Pros and Cons and Consequences.

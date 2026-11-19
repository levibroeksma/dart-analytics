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
<!-- backfill: pending -->

# Step metrics can merge to a minimum; Snakes & Ladders' headline is rounds to finish

## Context and Problem Statement
the rules document names a falling rounds count on a finished run as success; a `max` headline of 21 on both of two finished days hid the improvement, and an unfinished run's rounds polluted the sum (#1057).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`StepMetricSpec.metrics` gains a `"min"` merge and `direction` gains `"lower"`. A `"min"` metric is supplied only by sessions that earn it: `stepMetrics` omits the key, `mergeStepMetrics` keeps the other side's value, `foldStepResult` leaves `headlineMin`/`headlineMax` unmoved and a zeroed result carries no such key. `DOUBLES_SNAKES_LADDERS` adds `finishRounds` (its `rounds`, from a run with `finishes` 1), makes it the headline with direction `lower`, and keeps `highestLevel` as a `max` metric. The routine stats store reports a headline total of `null` when no session supplied it.".

### Consequences
replay cells show "—" for an absent headline. Metrics that never carry `"min"` behave as before.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-22
Refines: D372

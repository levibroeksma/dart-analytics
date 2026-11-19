---
id: D0143
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, 501, leg, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# 501 V1 rules bound to `501_V1`

## Context and Problem Statement
`dartsOnDouble >= 1` let a visit put one dart in a double, finish on a single and still win; an unvalidated `scoreAttempted` let −100 *raise* the remaining score (review I7/I8/I4)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "501 V1 rules bound to `501_V1`: the win condition is that the **finishing** dart is a double (`finishedOnDouble`), darts-at-a-double are an analytics fact only; `max_visit_score` in the ruleset config makes the score cap ruleset-owned per D15; `legs_to_win` drives one `LEG` stage per leg, so the seeded multi-leg preset is playable", because `dartsOnDouble >= 1` let a visit put one dart in a double, finish on a single and still win; an unvalidated `scoreAttempted` let −100 *raise* the remaining score (review I7/I8/I4).

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-26

---
id: D0541
status: accepted
date: 2026-11-09
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Doubles Lock path variants widen `DOUBLES_LOCK_V1`'s config; no V2 ruleset key

## Context and Problem Statement
a variant that only narrows or reorders the target list changes no rule. Stored sessions and templates hold `{}`, which parses to the same behaviour, so replay is unchanged and no second engine factory, ruleset row, adapter or resume wiring is needed. The rules doc's `V2` is a feature version, not a ruleset key.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`DoublesLockV1Config` takes optional `order` (`DESCENDING`|`ASCENDING`) and `doubles` (`ALL`|`EVEN`); `{}` stays the D20 to D1 ladder. The engine derives its path from config (`doublesLockPath`). Even Doubles Only and Ascending Order ship as system templates (seed `0059`) pinned to the existing `DOUBLES_LOCK_V1` row.".

### Consequences
Strict Lock (changes the lock rule) and Head-to-head stay `V2+` and would need a new ruleset key. A second template per type breaks the one-catalog-row-per-type assumption in `0047_exercise_type_seed_checks.sql` step 4, now `>= 1`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-09

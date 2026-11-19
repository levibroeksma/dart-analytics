---
id: D0364
status: accepted
date: 2026-09-26
origin: contemporaneous
original-date:
tags: [database, migration, table, index, view]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Statistics insight sections compute where cheapest, under three hard constraints, and return additive components

## Context and Problem Statement
the overview endpoint's app-layer-over-raw-facts shape loads a player's full history per request, which does not survive time series over years or Worker CPU limits; a per-game SQL aggregate view would pull engine rules into SQL, which the view rules forbid, and duplicate TS engine logic; a persisted per-session snapshot breaks "statistics live in views only". Additive components make month buckets re-aggregate exactly, make year-over-year a client regrouping instead of an endpoint, and let a future rollup slot in behind the same contract.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the detailed statistics pages are built from insight sections declared in a typed registry (`docs/architecture/10-Statistics/00-Overview.md` §2), each picking a compute site: `sql` for rule-free reductions and mandatory for unbounded ranges, `server` for game-rule folds over bounded input only, `client` for recomputation over a cached bounded window. Sections apply to rulesets by capability tag, not by game list. Every numeric result is returned as additive components (numerator + denominator), never only a ratio. Two owner-scoped base views (`v_stats_session_facts`, `v_stats_dart_facts`) plus thin per-section views carry the SQL side; escalation for a slow fold is SQL reduction → index → materialized monthly rollup, never a persisted stat table.".

### Consequences
nothing is built yet — each rollout phase in `10-Statistics/00-Overview.md` §12 gets its own spec, plan and migration. X01 and Score Training get no intent-based sections, because their engines store no intended target; Shanghai and Around the Clock recover intent by engine fold on the server. The shipped `GET /api/statistics/overview` is unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-26
Referenced by D0555's `Supersedes:` line.

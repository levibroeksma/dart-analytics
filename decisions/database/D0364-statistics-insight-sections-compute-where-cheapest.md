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

# Statistics insight sections compute where cheapest, under three hard constraints, and return additive components

## Context and Problem Statement
the overview endpoint's app-layer-over-raw-facts shape loads a player's full history per request, which does not survive time series over years or Worker CPU limits; a per-game SQL aggregate view would pull engine rules into SQL, which the view rules forbid, and duplicate TS engine logic; a persisted per-session snapshot breaks "statistics live in views only". Additive components make month buckets re-aggregate exactly, make year-over-year a client regrouping instead of an endpoint, and let a future rollup slot in behind the same contract.

## Decision Drivers
* A player's full history must not load per request, which does not survive years of time series or Worker CPU limits.
* The view rules forbid game rules in SQL, and TS engine logic should not be duplicated.
* Statistics live in views only, never persisted.
* Month buckets should re-aggregate exactly, and year-over-year should be a client regrouping.

## Considered Options
* Per-section compute site under explicit constraints, with additive components (chosen).
* App layer over raw facts, the overview endpoint's shape (rejected in Context and the spec: it loads full history per request).
* A per-game SQL aggregate view (rejected: it pulls game rules into SQL and duplicates engine logic).
* A persisted per-session snapshot (rejected: it breaks "statistics live in views only").

## Decision Outcome
Chosen option: "the detailed statistics pages are built from insight sections declared in a typed registry (`docs/architecture/10-Statistics/00-Overview.md` §2), each picking a compute site: `sql` for rule-free reductions and mandatory for unbounded ranges, `server` for game-rule folds over bounded input only, `client` for recomputation over a cached bounded window. Sections apply to rulesets by capability tag, not by game list. Every numeric result is returned as additive components (numerator + denominator), never only a ratio. Two owner-scoped base views (`v_stats_session_facts`, `v_stats_dart_facts`) plus thin per-section views carry the SQL side; escalation for a slow fold is SQL reduction → index → materialized monthly rollup, never a persisted stat table.".

### Consequences
nothing is built yet — each rollout phase in `10-Statistics/00-Overview.md` §12 gets its own spec, plan and migration. X01 and Score Training get no intent-based sections, because their engines store no intended target; Shanghai and Around the Clock recover intent by engine fold on the server. The shipped `GET /api/statistics/overview` is unchanged.

* Good, because additive components let month buckets re-aggregate exactly, make year-over-year a client regrouping, and let a future rollup slot in behind the same contract.
* Neutral, because X01 and Score Training get no intent-based sections, since their engines store no intended target.

### Confidence
Rationale unknown — no source found.

### Revisit When
Escalation for a slow fold goes SQL reduction, then index, then a materialized monthly rollup (Decision Outcome). Each rollout phase gets its own spec, plan and migration (Consequences).

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Per-section compute site with additive components
* Good, because it picks the cheapest site per section and keeps rule-free reductions in SQL.

### App layer over raw facts
* Bad, because it loads a player's full history per request, which does not survive years of time series or Worker CPU limits.

### Per-game SQL aggregate view
* Good, because it is fast (spec).
* Bad, because it pulls game rules into SQL, which the view rules forbid, and duplicates TS engine logic.

### Persisted per-session snapshot
* Good, because it is fast (spec).
* Bad, because it breaks "statistics live in views only".

## Evidence / More Information
Decided: 2026-09-26
Referenced by D0555's `Supersedes:` line.

* `docs/superpowers/specs/2026-09-26-statistics-pages-architecture-design.md` (Decisions made during brainstorming, Approaches weighed, Rollout): rebuilt Considered Options and Pros and Cons.
* Commit `19ab33f1` (2026-09-26; adds the D364 row and `docs/architecture/10-Statistics/`): source of the Context's reasoning on full-history loading and Worker CPU limits. Rebuilt Decision Drivers.
* Applied in: `docs/superpowers/plans/2026-09-26-statistics-phase-1a-database.md` (line 28).

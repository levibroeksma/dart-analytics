---
id: D0063
status: accepted
date: 2026-07-12
origin: contemporaneous
original-date:
tags: [api]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0036
superseded-by:
---

# Statistics endpoints (overview/trends/checkouts) fully deferred post-v1

## Context and Problem Statement
No viewless read at freeze; acquire the data first

The 2026-07-12 validation review found that `GET /api/statistics/overview` was sourced from "overview aggregation" with no `v_*` view, contradicting "the API consumes views, never raw tables" (finding F4).

## Decision Drivers
* `GET /api/statistics/overview` had no defined backing view (F4, D4).
* Shipping a read endpoint sourced from ad-hoc aggregation would violate the view-backed-reads principle at the moment of freeze (D4).
* All dart, turn and session facts are still stored in v1, so deferring the endpoint loses no history (D4).

## Considered Options
* Keep `GET /api/statistics/overview` in v1 with `trends` and `checkouts` deferred (the D36 scope, per the plan's ledger rows).
* Keep `overview` in v1 and author `v_statistics_overview` now as part of the freeze (the alternative the spec names).
* Defer all 3 statistics endpoints post-v1 (chosen).

## Decision Outcome
Chosen option: "Statistics endpoints (overview/trends/checkouts) fully deferred post-v1; each must be view-backed when built", because No viewless read at freeze; acquire the data first.

### Consequences
* Good, because no statistics endpoint ships without a backing view.
* Bad, because the aggregated overview endpoint is deferred although long-term progression tracking is the app's headline goal; the spec calls this "the most debatable call".
* Neutral, because the v1 statistics page renders from data the user already has, or ships after the view lands.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Keep `overview` in v1 as scoped by D36
* Bad, because the endpoint has no backing view, against the view-backed-reads principle.

### Keep `overview` and author `v_statistics_overview` now
* Bad, because it promotes F4 into a read-model-layer change inside the freeze.

### Defer all statistics endpoints
* Good, because the freeze ships no viewless read.
* Good, because the view can be added later without a migration to the runtime layer.
* Bad, because the headline progression-tracking read is not available in v1.

## Evidence / More Information
Decided: 2026-07-12

* `docs/superpowers/specs/2026-07-12-v1-api-freeze-validation-design.md` (§ 3 F4; § 4 D4): rebuilt Context, Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-12-v1-api-freeze-reconciliation.md` (ledger rows D36 and D63): rebuilt Considered Options.
* Partly closed by D258 for `overview` only: `docs/superpowers/specs/2026-09-06-statistics-overview-api-design.md` (Context, Decisions made during brainstorming 4).

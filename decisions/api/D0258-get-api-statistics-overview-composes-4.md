---
id: D0258
status: accepted
date: 2026-09-06
origin: contemporaneous
original-date:
tags: [api, endpoint, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `GET /api/statistics/overview` composes 4 views in the service layer, not one dedicated aggregate view

## Context and Problem Statement
D257's `v_player_visit_facts`/`v_player_leg_facts` were already designed to expose row-level facts, not pre-aggregated numbers — the approximation (best-effort darts-thrown) and exclusion (doubles-excluded scoring average) logic is application judgment a view can't safely encode (`05-Views.md` forbids workflow decisions in views), and duplicating it into a new aggregate view would fork the same logic the pure modules already hold. `00-Overview.md`'s original D63 note suggested "e.g. `v_statistics_overview`" as an example, not a requirement — "view-backed" is satisfied by reading existing views, not by inventing one new view per endpoint.

## Decision Drivers
* The view never fabricates an approximation it cannot prove, so the read layer owns that judgment (spec, Decisions made during brainstorming 4).
* The app is personal-scale, so loading a full history of rows per request is accepted for now (same item).

## Considered Options
* Compose the 4 views in the service layer through pure modules (chosen).
* Add a dedicated `v_statistics_overview` aggregate view, the example the original D63 note named.

## Decision Outcome
Chosen option: "The endpoint D63 reserved is implemented reading `v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, and `v_double_out_checkout_darts` through `repositories/statistics.repository.ts`, with all aggregation (streaks, score bands, averages, best leg, double accuracy) done in `services/statistics.service.ts` via five pure modules under `modules/stats/`/`modules/game/`, rather than a single `v_statistics_overview` view doing the aggregation in SQL.".

### Consequences
Every response field's correctness depends on the pure modules' own tests, not a SQL assertion — `database/verification/` gains no new script for this endpoint. Win-rate is excluded from the response shape entirely, pending a separate session-replay design. If this composition is ever measured slow, `05-Views.md`'s own performance order applies (query structure, then indexes, then materialization) before reaching for a dedicated aggregate view.
* Bad, because each request loads a full history of rows, which the spec accepts for a personal-scale app.

### Confidence
Rationale unknown — no source found.

### Revisit When
The service measures slow because it loads a full history of rows per request; the spec then revisits query structure, indexes and materialization, in that order.

### Confirmation
`app/tests/services/statistics.service.test.ts` composes mocked repository output through the real modules. `app/tests/repositories/statistics.repository.test.ts` asserts the query shape. `app/tests/modules/stats/` holds the pure-module tests.

## Pros and Cons of the Options
### Compose 4 views in the service layer
* Good, because the read layer owns the approximation and exclusion logic the view cannot prove.
* Bad, because each request loads a full history of rows.

### Dedicated `v_statistics_overview` view
* Bad, because it would move the approximation and exclusion logic into SQL, where the view cannot prove it.

## Evidence / More Information
Decided: 2026-09-06

* `docs/superpowers/specs/2026-09-06-statistics-overview-api-design.md` (Context; Decisions made during brainstorming 4; Testing): rebuilt Decision Drivers, Considered Options, Consequences, Revisit When, Confirmation and Pros and Cons.
* Commit `5e67104a` (2026-09-06): added the D258 block to `decisions/api.md`.

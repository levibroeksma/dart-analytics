---
id: D0028
status: accepted
date: 2026-07-12
origin: contemporaneous
original-date:
tags: [database, migration, view]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `session_id` added to `v_dart_analytics` (migration `0014`) so `GET /sessions/:id/darts`

## Context and Problem Statement
Endpoint is per-session but the view was player-global

## Decision Drivers
* `GET /api/sessions/:sessionId/darts` had no session column to filter on, and reads go through views only (spec § 2, C5).

## Considered Options
* Add `session_id` to `v_dart_analytics` through new migration `0014` (chosen, C5).
Rationale unknown — no source found for any other option.

## Decision Outcome
Chosen option: "`session_id` added to `v_dart_analytics` (migration `0014`) so `GET /sessions/:id/darts` filters by session through the view", because Endpoint is per-session but the view was player-global.

### Consequences
* Good, because the per-session darts endpoint filters through the view and stays an array (spec § 3).
* Neutral, because the view keeps `player_id` for future player-global statistics and is otherwise behaviour-preserving (spec § 4).
* Neutral, because the chain range quoted in docs moves from `0001`–`0013` to `0001`–`0014` (spec § 9).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's validation step applies `0013` and `0014` with `db:migrate`, re-runs `drizzle-kit introspect` to regenerate `schema.ts` with `v_dart_analytics.sessionId`, then runs `npx fallow` and `astro check` (spec § 9, Validation).

## Pros and Cons of the Options
Add `session_id` to the view:

* Good, because the endpoint is per-session and the view was player-global.

## Evidence / More Information
Decided: 2026-07-12

* `docs/superpowers/specs/2026-07-12-api-response-contracts-design.md` (§ 2 C5, § 3, § 4, § 9): rebuilt Decision Drivers, Considered Options, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-12-api-response-contracts.md` (Task 1; ledger row D28): rebuilt Consequences.
* Commit `5d2ea348` (PR #7): adds the decision row.

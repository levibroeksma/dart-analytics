---
id: D0365
status: accepted
date: 2026-09-26
origin: contemporaneous
original-date:
tags: [api, endpoint, contract, session, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Statistics endpoints share one query contract: required date range, per-request `tz`, bucket, status, context; replay is paginated

## Context and Problem Statement
a required range bounds every query's cost; month/year buckets need a timezone, and D343 already rules out storing one, so the client supplies it per request the same way it supplies local midnight. One generic section route keeps the route count flat while insights grow. Pagination keeps a long timed session's replay from loading in one payload. A routine-step game stores the same game pair as a standalone game, so the context split is a derived filter, not a schema change.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "every detailed-statistics endpoint (`docs/architecture/10-Statistics/00-Overview.md` §5/§6) requires `from`/`to` (half-open on `completed_at`) and accepts `tz` (IANA, required when bucketing, never stored), `bucket` (`day`…`year`, capped count), `status` (`completed` default, `abandoned`, `all`), `context` (`all` default for game pages, `standalone`, `routine`), `inputMode`, and `limit`/`cursor` on lists. Sections dispatch through one generic route, `GET /api/statistics/games/:rulesetKey/sections/:sectionId`. Replay is `GET /api/statistics/sessions/:sessionId/replay`, paginated by turn pages with the configuration snapshot and stage tree on the first page only. Game pages include games run as routine steps; future routine pages are fixed server-side to `context = routine`.".

### Consequences
planned, not built — contracts enter `06-API/04-Endpoint-Contracts.md` when their phase lands. The previously reserved `GET /api/statistics/trends` and `/checkouts` are replaced by the section route (trends are bucketed sections; checkouts are the checkout-family sections). A parameter a section cannot honour is `VALIDATION_FAILED`, never silently ignored.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-26

* `docs/superpowers/specs/2026-09-26-statistics-pages-architecture-design.md` (Decisions made during brainstorming items 6, 7 and 10; Verified during design): source for the decision items; no section rebuilt from it.
* Commit `19ab33f1` (2026-09-26, adds the D365 row; the spec names decisions D364-D366).
* Applied in: `docs/superpowers/plans/2026-09-26-statistics-phase-5b-replay.md`.

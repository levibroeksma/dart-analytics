---
id: D0556
status: accepted
date: 2026-11-13
origin: contemporaneous
original-date:
tags: [api, endpoint, contract, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The 501 variation is a derived read-time filter on `starting_score`; 501-only, default 501, no stored column

## Context and Problem Statement
a 301 or custom-score game skews 501 averages, checkout rates and leg lengths. The variation is already stored as `starting_score` in the session snapshot, so by the principle "store what happened, derive what it means" it is derived in the read layer: no migration, no column. Rejecting rather than ignoring the parameter on other games keeps a request from silently dropping the filter. Treating an absent snapshot or score as 501 matches every pre-variation game.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "a `variation` query parameter (integer 2–999, the `starting_score`) joins the Common Query Contract for game type `501` only. Every 501 section, the aim-filtered heatmap and the session list read the sessions whose `COALESCE(configuration->>'starting_score', 501)` equals it; absent means `501`. Any other game and every routine route reject it with `VALIDATION_FAILED`, as does a non-numeric, empty or out-of-range value; with `routineStep` set no variation filter applies. A new read, `GET /api/statistics/games/501/variations`, returns `{ variations: { startingScore, sessions }[] }` over the owner's completed `VISUAL_BOARD` sessions, `501` always listed and first, the rest ascending. `dataVersion` stays game-wide and `variation` joins the client cache's `paramsKey`.".

### Consequences
`10-Statistics/00-Overview.md` 1.8.0 (§5 parameter row, §6 route row), `01-Section-Catalog.md` 1.8.0 (§2.1 paragraph) and `06-API/04-Endpoint-Contracts.md` 1.19.0 are updated. `dataVersion` over-invalidates when a game in another variation completes; accepted. The home page's first-9 average still mixes variations (out of scope). Spec: `docs/superpowers/specs/2026-11-13-x01-variation-filter-design.md`; plan: `docs/superpowers/plans/2026-11-13-x01-variation-filter.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-13

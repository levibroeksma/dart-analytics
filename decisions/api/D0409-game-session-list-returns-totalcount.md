---
id: D0409
status: accepted
date: 2026-10-04
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

# Game session list returns `totalCount`

## Context and Problem Statement
a pager that shows "4 / 56" needs the page count, and a keyset cursor cannot give one. A server count is exact and costs one extra aggregate query; walking cursors client-side would cost N sequential requests.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`GameSessionListResponse` gains `totalCount` (non-negative integer): the number of sessions the filters match, ignoring `cursor` and `limit`. `countGameSessions` counts over the same conditions as `findGameSessionsPage`, now shared through `gameSessionConditions`. Cursor paging is unchanged. `CachedSessionPage.totalCount` is optional, since the routine step list does not carry it. Score Training's replay pager reads it to show the last page.".

### Consequences
the list route runs a second query. The Score Training list caches under its own scope key (`:counted`) while sharing the game's `dataVersion` key, so pages cached without a total are not reused. The routine step session list is unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D367 decision 4, D405).

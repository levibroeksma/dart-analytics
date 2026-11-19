---
id: D0458
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/alpine, recovery]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Active sessions load once per page through the `activeSessions` store

## Context and Problem Statement
`/games` renders both scopes (D456), and each fetched the same list.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`activeSessionsStore()` (`$store.activeSessions`) holds the player's active sessions with `loaded`/`failed`. It fetches nothing on registration; the first `load()` calls `fetchActiveSessions()` and every later or concurrent `load()` awaits that same promise. `gamesIndex()` and `resumeDeck()` read it instead of fetching. A failed fetch leaves `sessions` empty and `failed` set; `/games` treats that as no active session, the deck hides.", because `/games` renders both scopes (D456), and each fetched the same list.

### Consequences
one `GET /api/sessions/active` per page that shows the list. The memo lives for the page load; there is no client router, so navigation refetches. Setup and play pages still call `fetchActiveSessions()` directly for recovery, which needs a fresh read after start/abandon.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-13

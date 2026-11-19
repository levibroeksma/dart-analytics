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

# Active sessions load once per page through the `activeSessions` store

## Context and Problem Statement
`/games` renders both scopes (D456), and each fetched the same list.

## Decision Drivers
* `/games` renders both scopes (D456).
* Each scope fetched the same active-sessions list.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`activeSessionsStore()` (`$store.activeSessions`) holds the player's active sessions with `loaded`/`failed`. It fetches nothing on registration; the first `load()` calls `fetchActiveSessions()` and every later or concurrent `load()` awaits that same promise. `gamesIndex()` and `resumeDeck()` read it instead of fetching. A failed fetch leaves `sessions` empty and `failed` set; `/games` treats that as no active session, the deck hides.", because `/games` renders both scopes (D456), and each fetched the same list.

### Consequences
one `GET /api/sessions/active` per page that shows the list. The memo lives for the page load; there is no client router, so navigation refetches. Setup and play pages still call `fetchActiveSessions()` directly for recovery, which needs a fresh read after start/abandon.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/stores/active-sessions.store.test.ts` is added, and `resume-deck.data.test.ts`, `games-index.data.test.ts` and `register-stores.test.ts` change, in the commit.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-13

* Commit `c6a2eed1` (2026-10-13; message and the `decisions/frontend/alpine.md` row): rebuilt Decision Drivers and Confirmation.

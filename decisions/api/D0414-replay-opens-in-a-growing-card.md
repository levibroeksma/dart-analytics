---
id: D0414
status: accepted
date: 2026-10-05
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
<!-- backfill: pending -->

# Replay opens in a growing card; no `/statistics/replay` page

## Context and Problem Statement
a replay is a detail of a list row, and opening it in place keeps the list, its page and its period in view instead of navigating away and back.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The prerendered `/statistics/replay?session=<id>` page is removed. Each row of a game page's replay section (`GameSessionList.astro`) is a `ReplayCard.astro` built on `GrowingCard.astro`: clicking it grows the card into an overlay covering the viewport inset by 1rem, and the open card renders `SessionReplay.astro` (the old page body, minus back link and heading). `GrowingCard` dispatches `expand`; the card binds it to `$store.replay.open(sessionId)`, which replaces `init()`'s `?session=` read: it clears the previous session, applies the same `ReplaySessionIdParam` guard, and starts a new generation so a page that lands after a later `open()` is dropped. Open state is not in the URL. `replayPath`, `replaySessionIdFromLocation`, `statisticsPath`, `backHref`, `sessionRow().href`, `game-stats`' `replayHref` and `routine-stats`' `sessionHref` are removed; the unmounted `GameSectionCards.astro` keeps its Best leg and PB values as plain text. The replay endpoint, cache and fold are unchanged.", because a replay is a detail of a list row, and opening it in place keeps the list, its page and its period in view instead of navigating away and back.

### Consequences
the replay section's card is the only replay entry point; the Routines tab step rows, the `session-result` PB line and the 501 Best leg value open none. No deep link to a replay exists. Only the open card renders `SessionReplay` (`x-if`), so a page of ten rows builds one board. `.astro` markup is untested (D101); `growingCard()` and `replayStore().open()` are covered.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-05
Supersedes: D371 decisions 9 and 12.

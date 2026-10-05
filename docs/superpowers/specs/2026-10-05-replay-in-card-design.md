# Replay in a growing card — design

**Date:** 2026-10-05 · **Branch:** `feat/replay-in-card` (on `feat/growing-card`, PR #783) · **Decision:** D414 (supersedes D371 decisions 9 and 12)

## Goal

Drop the standalone `/statistics/replay` page. A session row in the replay
section (`GameSessionList.astro`) grows in place into a viewport overlay
(`GrowingCard`) and shows everything the page shows today. No URL state:
open and close are in-page only.

## Units

### 1. `GrowingCard` (`components/ui/`, `growingCard()`)

- Card click expands only (`open || expand()`); clicks inside an open card
  do not collapse it. Close is Escape or a caller-placed control calling
  `collapse()` (in scope through Alpine's inherited `x-data`).
- `role="button"`, `tabindex="0"` and the Enter/Space handlers apply only
  while closed (`:role`, `:tabindex`); `aria-expanded` stays.
- `expand()` dispatches `expand` from the root (`this.$dispatch("expand")`)
  after `open = true`, so a caller binds `@expand="..."`.
- Leftover attributes forward to the root element (the `CardWrapper`
  precedent), so `@expand` can be passed in.
- `overflow-y-auto` while open; `overflow-hidden` while closed.

### 2. `ReplayCard.astro` (`components/layout/statistics/`)

- Root is `GrowingCard`. Props: `titleExpr`, `captionExpr`, `sessionIdExpr`
  (replaces `hrefExpr`).
- Closed face: today's title, caption and play icon; no anchor.
- Open: a header row (title, close button calling `collapse()`), then
  `<template x-if="open"><SessionReplay /></template>` — only the open card
  builds the board and turn rows.
- `@expand="$store.replay.open(<sessionIdExpr>)"`.

### 3. `SessionReplay.astro` (`components/layout/statistics/`, new)

The body of `pages/statistics/replay.astro` moved verbatim, minus the back
link and `<h1>`. Its `titles` scope (from `GAME_CARDS`) moves with it.

### 4. `$store.replay` (`stores/replay.store.ts`)

- `init()` and the `?session=` read are removed. New `open(sessionId)`:
  invalid id (`ReplaySessionIdParam`) → `error = "NOT_FOUND"`, no request;
  otherwise reset `header`, `turns`, `nextCursor`, `fold`, `error`,
  `selectedIndex` and the closure's `loadedHeader`/`loadedTurns`, set
  `sessionId`, and `loadNext()`.
- Stale guard: an open-generation counter captured per load; a page that
  resolves after a newer `open()` is dropped (not appended, no error set).
- `backHref` removed.

### 5. Removals

- `pages/statistics/replay.astro`.
- `replay-route.ts`: `replayPath`, `statisticsPath`,
  `replaySessionIdFromLocation` (keeps `routinesLocationFromLocation`).
- `sessionRow().href` (`score-summaries.ts`), `replayHref`
  (`game-stats.store.ts`), `sessionHref` (`routine-stats.store.ts`).
- The two `:href` bindings in the unmounted `GameSectionCards.astro`
  (rendered as plain text). Whether to delete that component is filed as a
  discovered-work issue.

## Data flow

Click closed card → `expand()` → `expand` event → `$store.replay.open(id)` →
pages load into the singleton store → open card's `SessionReplay` renders
from `$store.replay`. One card is open at a time (the overlay covers the
rest), so a singleton store suffices.

## Error handling

Unchanged from the page: `ErrorAlert` with the store's message, "Try again"
on a failed first page, "Loading replay…" until the header lands.

## Tests (written first)

- `replay.store`: `open()` with an invalid id (no fetch, `NOT_FOUND`); state
  reset between two opens; a stale page from an earlier `open()` dropped.
  Existing `init()`/URL tests rewritten onto `open()`.
- `growing-card.data`: `expand` event dispatched; an open card stays open on
  `expand()`.
- `score-summaries`, `game-stats.store`, `routine-stats.store`,
  `replay-route`: href expectations and removed-helper tests deleted.
- `.astro` markup is untested (D101).

## Docs

`10-Statistics/02-Replay.md` §1 rewritten (no route; entry point is the
session-list card); `00-Overview.md`, `01-Section-Catalog.md`,
`07-Frontend/01-Rendering-Strategy.md` drop the route and links;
Component Inventory rows for `ReplayCard`, `SessionReplay` and the
`GrowingCard` API change; File Inventory; Context Map History; D414 in
`decisions/api.md` with `Supersedes: D371` (decisions 9, 12).

## Out of scope

URL/deep-link state; routine-tab or PB replay entry points; deleting
`GameSectionCards.astro`.

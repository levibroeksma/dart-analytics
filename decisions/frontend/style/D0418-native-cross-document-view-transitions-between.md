---
id: D0418
status: superseded
date: 2026-10-06
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, motion]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0420
---
<!-- backfill: pending -->

# Native cross-document view transitions between bottom-nav tabs

## Context and Problem Statement
keeps the MPA, Alpine and the auth gate intact. Astro's `ClientRouter` was rejected because it swaps the DOM in one document. Direction uses `sessionStorage`, not the Navigation API, which ships later in Safari. The handler is one self-contained function inlined via `toString()` because bundled module scripts are deferred and can miss `pagereveal`, while the function stays unit-testable.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`AppLayout` opts in with `@view-transition { navigation: auto; }` (`navigation: none` under reduced motion) and writes `<html data-tab="<index>">` from `NAV_TABS`/`navTabIndex`. `BaseLayout` emits, only when a tab is set, a classic head script that calls `onTabReveal(event, sessionStorage)` on `pagereveal`: higher tab index adds view-transition type `forward`, lower `back`, equal or unknown skips. `main` (`page`) slides ±20% with fade; `nav` (`bottom-nav`) is static; `.nav-indicator` (`nav-indicator`) glides; the root snapshot is not animated. Timing is `--duration-tab` with `--ease-out`.".

### Consequences
Firefox navigates instantly. Same-tab, reload, first load, `GameLayout` and `login` never animate. Deferred: Speculation Rules prerender, drill-down push/pop, game-screen transitions. CSS carries no unit test (D101); `onTabReveal` and `navTabIndex` are tested, and the browser behaviour was checked in Chromium (every tab pair both ways, reload, setup pages, history back/forward, reduced motion).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-06

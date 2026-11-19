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

# Native cross-document view transitions between bottom-nav tabs

## Context and Problem Statement
keeps the MPA, Alpine and the auth gate intact. Astro's `ClientRouter` was rejected because it swaps the DOM in one document. Direction uses `sessionStorage`, not the Navigation API, which ships later in Safari. The handler is one self-contained function inlined via `toString()` because bundled module scripts are deferred and can miss `pagereveal`, while the function stays unit-testable.

## Decision Drivers
* The MPA, Alpine and the auth gate stay intact.
* Astro's bundled module scripts are deferred and can miss `pagereveal`.
* The handler should stay unit-testable.
* Safari ships view transitions earlier than the Navigation API.

## Considered Options
* Native cross-document view transitions with `sessionStorage` direction (chosen).
* Astro's `ClientRouter` (rejected: it swaps the DOM in one document).
* The Navigation API for direction (rejected: it ships later in Safari).

## Decision Outcome
Chosen option: "`AppLayout` opts in with `@view-transition { navigation: auto; }` (`navigation: none` under reduced motion) and writes `<html data-tab="<index>">` from `NAV_TABS`/`navTabIndex`. `BaseLayout` emits, only when a tab is set, a classic head script that calls `onTabReveal(event, sessionStorage)` on `pagereveal`: higher tab index adds view-transition type `forward`, lower `back`, equal or unknown skips. `main` (`page`) slides ±20% with fade; `nav` (`bottom-nav`) is static; `.nav-indicator` (`nav-indicator`) glides; the root snapshot is not animated. Timing is `--duration-tab` with `--ease-out`.".

### Consequences
Firefox navigates instantly. Same-tab, reload, first load, `GameLayout` and `login` never animate. Deferred: Speculation Rules prerender, drill-down push/pop, game-screen transitions. CSS carries no unit test (D101); `onTabReveal` and `navTabIndex` are tested, and the browser behaviour was checked in Chromium (every tab pair both ways, reload, setup pages, history back/forward, reduced motion).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `ded4e15c` added Vitest tests for `onTabReveal` and `navTabIndex`. Commit `02fb0458` removed them with the transitions (D420), so no check covers D418 today.

## Pros and Cons of the Options
### Native cross-document transitions with `sessionStorage` direction
* Good, because it keeps the MPA, Alpine and the auth gate intact.
* Good, because an inlined self-contained function catches `pagereveal` and stays unit-testable.

### Astro `ClientRouter`
* Bad, because it swaps the DOM in one document.

### Navigation API for direction
* Bad, because it ships later in Safari than view transitions.

## Evidence / More Information
Decided: 2026-10-06

* `docs/superpowers/specs/2026-10-06-tab-view-transitions-design.md` (Goal, Units 1–6, Verification): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Commit `ded4e15c` (2026-10-06; adds the D418 row).
* Superseded by D420 (the transitions are removed in full).

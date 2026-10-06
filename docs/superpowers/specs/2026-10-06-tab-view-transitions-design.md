# Tab view transitions — design

**Date:** 2026-10-06 · **Status:** implemented · **Branch:** `feat/tab-view-transitions` · **Decision:** D418 (to be recorded in `decisions/frontend/style.md`)

## Goal

Native cross-document view transitions between the five bottom-nav tabs:
page content slides in tab-order direction, the active nav pill glides to
the new tab. MPA model unchanged; no `ClientRouter`.

## Scope

- In: tab → tab navigation between `AppLayout` pages whose active tab differs.
- Out (instant, as today): same-tab navigation, `GameLayout`, `login`,
  reload, first load.

## Units

### 1. Opt-in

- `@view-transition { navigation: auto; }` in an `AppLayout` style block only.
  Both documents must opt in, so `GameLayout`/`login` hops never animate.
- `@media (prefers-reduced-motion: reduce)` → `navigation: none`.

### 2. Tab identity

- One shared `NAV_TABS` list (`label`, `href`, index by order) replaces
  `BottomNav.astro`'s inline array; icons stay in `BottomNav`.
- A page's tab = the entry `isNavActive` marks (prefix match, so
  `/games/501/setup` is Games).
- `AppLayout` writes `<html data-tab="<index>">`; absent when no tab matches.

### 3. Direction

- One self-contained exported function `onTabReveal(event, storage)`
  (no module bindings), unit-tested directly and inlined into a classic
  render-blocking `<head>` script via `set:html` +
  `onTabReveal.toString()` — Astro's bundled scripts are deferred modules
  and can miss `pagereveal`. It:
  - reads previous index from `sessionStorage`, current from `data-tab`;
  - higher → `event.viewTransition.types.add("forward")`, lower → `"back"`;
  - equal or either missing → `event.viewTransition.skipTransition()`;
  - writes current index to `sessionStorage`.
- `sessionStorage` access wrapped in try/catch; failure = skip.
- No Navigation API dependency (Safari ships view transitions earlier than
  it). Covers back/forward and bfcache restores.

### 4. Page animation

- `<main>`: `view-transition-name: page`.
- `forward`: old `translateX(0 → -20%)` + fade out; new `translateX(20% → 0)`
  + fade in. `back` mirrors. `--duration-tab` (300ms), `--ease-out`.
- Selected via `:active-view-transition-type(forward|back)`.
- `::view-transition-old/new(root)`: `animation: none` — dartboard
  background stays static.

### 5. Nav animation

- `<nav>`: `view-transition-name: bottom-nav` (static, not slid).
- `.nav-active` background moves from the `<a>` to an absolute
  `<span class="nav-indicator" aria-hidden="true">` inside the active
  `NavBtn`, behind icon + label, with `view-transition-name: nav-indicator`.
  Browser morphs position/size between tabs.
- `::view-transition-group(nav-indicator)` `z-index` below
  `::view-transition-group(bottom-nav)` so the pill never darkens icons.
- Icon/label active colour cross-fades inside the nav snapshot.
- Static look identical to today.

### 6. Fallback

- Browsers without cross-document view transitions (Firefox today):
  instant navigation, unchanged visuals.

## Persistence

None. Pure presentation; no state shape, no `turns`/`darts` mapping.

## Verification

- Vitest: `onTabReveal` (forward, back, equal, missing either side, storage
  failure, self-contained when stringified); `navTabIndex`.
- Manual Chromium (Playwright): every tab pair both directions, browser
  back, reload (no animation), setup page → other tab, setup → own tab
  (no animation), reduced motion.
- `validate-app` + `run-all-gates`.
- Docs: `07-Frontend/07-Style-Guide.md` (motion), `05-Astro-Components.md`
  (`AppLayout`/`BottomNav`/`NavBtn`), D418.

## Deferred

- Speculation Rules prerender of tab routes.
- Drill-down push/pop transitions.
- Transitions into/out of game screens.

# Tab view transitions Implementation Plan

Spec: `docs/superpowers/specs/2026-10-06-tab-view-transitions-design.md`. Branch `feat/tab-view-transitions`, off `main`. Decision D418.

**Correction to the spec.** `pagereveal` must be handled by a classic, render-blocking `<head>` script; Astro's bundled `<script>` is a deferred module and can miss the event. A unit-tested function therefore cannot be `import`ed by the handler. Instead the handler is one self-contained exported function, `onTabReveal`, injected via `set:html` as `${onTabReveal.toString()}` and tested directly. It must not reference any module binding (no imports, no helpers outside its body). Fix the spec in Task 1.

Timing uses the existing `--duration-tab` token (300ms) instead of the spec's "~250ms"; note in Task 1.

Each task is red -> green -> commit. Run from `app/`; tests by path (`npx vitest run <path>`). No `//` comments in function bodies; exported types go in `lib/*/types.ts`.

## Task 1: Spec fix + shared tab list

- Spec §3: handler is `onTabReveal`, inlined via `set:html`, self-contained; §4: `--duration-tab`.
- `lib/utils/nav-tabs.ts`:
  - `NAV_TABS: readonly NavTab[]` = Home `/`, Games `/games`, Training `/training`, Stats `/statistics`, Profile `/profile` (today's order).
  - `navTabMatchPrefix(href)` — the `NavBtn` default (`undefined` for `/`, else `href + "/"`).
  - `navTabIndex(pathname): number | null` — first index where `isNavActive(pathname, tab.href, navTabMatchPrefix(tab.href))`.
- `NavTab { label: string; href: string }` in `lib/utils/types.ts`.
- `NavBtn.astro`: use `navTabMatchPrefix` for its default; behaviour unchanged.
- `BottomNav.astro`: iterate `NAV_TABS`; icons from a local `href -> icon` record.
- Tests `tests/utils/nav-tabs.test.ts`:
  - each tab href -> its index; `/games/501/setup` -> 1; `/training/routines/detail` -> 2.
  - `/login`, `/unknown` -> `null`; `/` -> 0 only for exact `/`.
  - `NAV_TABS` hrefs equal today's five in order.

## Task 2: `onTabReveal`

- `lib/utils/tab-transition.ts`:
  - `onTabReveal(event, storage)`; `event` is `{ viewTransition: ViewTransitionLike | null }`, `storage` is `Pick<Storage, "getItem" | "setItem">`.
  - No `viewTransition` -> only record the current tab.
  - Current = `document.documentElement.dataset.tab`; previous = `storage.getItem("da:tab")`; both parsed as integers.
  - Higher -> `types.add("forward")`; lower -> `types.add("back")`; equal or either missing -> `skipTransition()`.
  - Writes current to `"da:tab"` (removes nothing when absent).
  - Every storage call in `try/catch`; a throw on read -> skip.
- `ViewTransitionLike` in `lib/utils/types.ts` (`types: { add(t: string): void }`, `skipTransition(): void`).
- Tests `tests/utils/tab-transition.test.ts` (jsdom/happy-dom per vitest config; set `dataset.tab` directly):
  - 0 -> 3 adds `forward`; 3 -> 1 adds `back`; 2 -> 2 skips.
  - no stored value skips; no `data-tab` skips and stores nothing.
  - `viewTransition: null` stores current, adds nothing.
  - `getItem` throws -> skip, no throw out.
  - self-contained guard: `new Function("return " + onTabReveal.toString())()` runs the 0 -> 3 case identically.

## Task 3: Layout wiring

- `layouts/AppLayout.astro`:
  - compute `tab = navTabIndex(Astro.url.pathname)`; pass to `BaseLayout` as optional `tab` prop.
  - `<main>` gets class `vt-page`.
  - `<style is:global>` block (or `global.css` scoped by `[data-tab]`; pick `global.css` if `astro check`/fallow flag the layout block) with the CSS from Task 4.
- `layouts/BaseLayout.astro`:
  - optional `tab?: number | null` prop -> `<html data-tab={tab ?? undefined}>`.
  - when `tab` is set: `<script is:inline set:html={`addEventListener("pagereveal",e=>(${onTabReveal.toString()})(e,sessionStorage))`} />` in `<head>`, before stylesheets.
- `GameLayout`, `login`: no `tab` -> no script, no opt-in.
- Check: `npm run build`, then grep the built `/games/index.html` for `pagereveal` and `data-tab="1"`; `/login` has neither.

## Task 4: Transition CSS

All under `html[data-tab]` so only `AppLayout` pages opt in.

- `@view-transition { navigation: auto; }` — at-rule cannot be selector-scoped, so place it in an `AppLayout`-only `<style is:global>`; `@media (prefers-reduced-motion: reduce) { @view-transition { navigation: none; } }`.
- `.vt-page { view-transition-name: page; }`; nav `view-transition-name: bottom-nav`; `.nav-indicator { view-transition-name: nav-indicator; }`.
- `::view-transition-old(root), ::view-transition-new(root) { animation: none; }`.
- Keyframes `vt-out-left`, `vt-in-right`, `vt-out-right`, `vt-in-left` (translateX ±20% + opacity).
- `html:active-view-transition-type(forward)::view-transition-old(page)` -> `vt-out-left`, `-new(page)` -> `vt-in-right`; `back` mirrors. Duration `var(--duration-tab)`, easing `var(--ease-out)`.
- `::view-transition-group(nav-indicator)` same duration/easing; `z-index: 1`; `::view-transition-group(bottom-nav)` `z-index: 2`.
- No unit test (CSS); covered by Task 6.

## Task 5: Nav pill element

- `NavBtn.astro`: `relative` on `<a>`; when active render `<span class="nav-indicator absolute inset-0 -z-10 rounded-full" aria-hidden="true">`; icon + label wrapped so they paint above (`relative z-0` / `isolate` on `<a>`).
- `global.css`: `.nav-active` keeps text colour only; its `background` + `box-shadow` move to `.nav-indicator`.
- Visual parity: screenshot each tab before/after (Playwright, 390×844) — must match.
- Existing `NavBtn` tests (if any assert `.nav-active`) re-pointed at the same guarantee, not deleted.

## Task 6: Browser verification

Playwright, `executablePath: '/opt/pw-browsers/chromium'`, against `npm run preview` (auth gate: use the existing dev/test login path, or stub per `07-Frontend/06-Test-Strategy.md`).

- Every tab pair both ways: `document.startViewTransition`-free check via `page.evaluate` listening to `pagereveal` and recording `e.viewTransition?.types` -> expected `forward`/`back`.
- Reload -> skipped; `/games/501/setup` -> Games tab -> skipped; setup -> Training -> `forward`; browser back -> `back`.
- `emulateMedia({ reducedMotion: "reduce" })` -> no `viewTransition`.
- Mid-transition screenshots for the PR (forward, back).
- Not a committed test unless `06-Test-Strategy.md` already has an e2e lane; otherwise record results in the PR.

## Task 7: Docs + gates

- `07-Frontend/07-Style-Guide.md`: new "View transitions" section (scope, types, timing token, reduced motion, fallback).
- `07-Frontend/05-Astro-Components.md`: `AppLayout` opt-in + `data-tab`; `BottomNav`/`NavBtn` pill element.
- `07-Frontend/08-Component-Inventory.md`: `NavBtn` row — pill is `.nav-indicator`; `BottomNav` row — reads `NAV_TABS`.
- `decisions/frontend/style.md`: D418 (native cross-document VT over `ClientRouter`; sessionStorage direction over Navigation API; tab-only scope; deferred list).
- Spec status note: implemented.
- `context-maintenance`, `validate-app`, `run-all-gates`; then `finishing-a-dart-branch` (push + PR).

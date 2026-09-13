<!--
status: historical
scope: design spec
read-when: never (superseded by implementation + this repo's own docs)
updated: 2026-09-13
-->

# Design: Screen Wake Lock (#278)

## Problem

Screen sleeps mid-session when there's no touch interaction (e.g. a timed
warm-up step) — issue #278.

## Scope

Add `navigator.wakeLock.request('screen')` to every game and training-session
page. Explicitly excluded: homepage, statistics, overview (games/training
index), settings/profile, setup pages.

## Why `GameLayout` is the single integration point

`GameLayout.astro` is used by exactly the 11 in-scope routes — 9 game
`play/` pages, `training/balanced-training/play/`, and
`training/quick-subtract/` — and by no excluded route (all of which use
`AppLayout`). One change covers the full scope; no per-page edits.

## Components

- **`app/src/modules/ui/wake-lock.module.ts`** — `WakeLockController` class
  (portable UI kit, `modules/ui/`). `acquire()` feature-detects
  `navigator.wakeLock`, requests `'screen'`, swallows rejection via an
  optional `onError` callback (no user-visible error — a missing lock is a
  degraded, not broken, experience). Listens for `visibilitychange` and
  re-acquires when the tab returns to visible and the lock had been
  released (standard mitigation — the browser silently drops the lock on
  backgrounding). `release()` / `destroy()` release the sentinel and remove
  the listener.
- **`app/src/lib/ui/game-layout.data.ts`** — `gameLayoutData()` Alpine
  factory, replacing `GameLayout.astro`'s inline
  `x-data="{ showExitModal: false }"`. Holds the `WakeLockController` in
  closure (never on the proxied `this` — private fields throw under
  Alpine's deep proxy). `init()` constructs + acquires; `destroy()` tears
  down. `showExitModal` moves in unchanged.
- **`GameLayout.astro`**: `x-data="{ showExitModal: false }"` →
  `x-data="gameLayout()"`.
- **`register-ui-data.ts`**: register `gameLayout` → `gameLayoutData`.

## Testing

- `tests/modules/ui/wake-lock.module.test.ts`: mocked `navigator.wakeLock`
  (acquire/release calls, sentinel `release` event), unsupported-browser
  no-op, visibilitychange re-acquire.
- `tests/lib/ui/game-layout.data.test.ts`: mirrors
  `tests/lib/ui/toggle.data.test.ts`'s mocked-module harness — `init`
  constructs + acquires, `destroy` tears down, `showExitModal` default.

## Out of scope

- No UI indicator for lock state (silent best-effort, per issue).
- No persistence — lock is a page-session behavior only.
- No change to any `AppLayout`-based page.

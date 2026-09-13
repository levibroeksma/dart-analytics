<!--
status: historical
scope: design spec
read-when: never (superseded by implementation)
updated: 2026-09-13
-->

# Design: Self-Healing Wake Lock, Native-Only (#278 follow-up 4)

## Problem

Three shipped attempts (#316 canvas `captureStream`, #317 embedded MP4, #318
gesture gate) did not keep an iOS Home Screen install awake. All three kept
adding to a video fallback. Research for this pass establishes that the
fallback was never viable and that the native API should already work on the
reporting device:

- **The video trick does not work in an iOS Home Screen web app at all.**
  `richtr/NoSleep.js` issue #27 reports exactly this: the library works in a
  Safari tab and stops working once the same page is launched from the Home
  Screen. The canvas and MP4 variants are the same mechanism, so #316 and
  #317 could not have worked whatever their internals.
- **The native API in Home Screen web apps was a WebKit bug, fixed in iOS
  18.4** (WebKit bug 254545; Safari 18.4 release notes). The reporting
  device runs iOS 26 with Low Power Mode off, so the platform-level
  blocker is gone and the native API is the mechanism that must carry this.
- **iOS revokes a held lock with no `visibilitychange`** — under Low Power
  Mode it refuses one outright, and the sentinel's `release` event is the
  only signal. The shipped controller listens for `visibilitychange` only,
  and arms its gesture listeners exactly once: a lock dropped mid-game, or
  a first request that failed, is never retried for the rest of the session.

That last point is the concrete defect. Everything else in the three prior
passes was mechanism substitution around a controller that acquires at most
twice per page load and reports nothing when it fails.

## Components

Confined to `app/src/modules/ui/wake-lock.module.ts`, its caller
`app/src/lib/ui/game-layout.data.ts`, `app/src/layouts/GameLayout.astro`,
and the two tests.

- **Delete the video fallback and standalone detection.** Neither is
  reachable as a working mechanism on any iOS version, and the embedded
  ~5KB base64 MP4 plus its `timeupdate` re-seek loop costs battery on a
  screen that is meant to stay lit for a whole match.
- **One idempotent `ensureHeld()`.** Every re-entry point funnels into it:
  initial `acquire()`, the sentinel's own `release` event, `visibilitychange`,
  `pageshow`, `focus`, any of `pointerdown`/`touchend`/`click`/`keyup`
  (capture phase, so a handler calling `stopPropagation` cannot hide the
  gesture), and a 15s watchdog sweep. It no-ops when the lock is already
  held, a request is in flight, or the document is hidden — so the listeners
  can stay armed for the controller's whole lifetime instead of being
  one-shot.
- **The watchdog** covers the case the `release` event does not: a sentinel
  observed as `released` with no event delivered. 15s is short enough that a
  drop cannot outlive a typical iOS auto-lock timeout, long enough to be
  free.
- **Gesture listeners are not a gate.** The spec does not require transient
  activation (w3c/screen-wake-lock issue 350 is still open) and WebKit does
  not enforce one, so acquisition is attempted immediately at mount; the
  gesture events are retry opportunities, not preconditions. #318's gate was
  the opposite: a precondition that also ended after one event.
- **Observable status.** The controller emits `{status, detail, at}` —
  `idle` | `unsupported` | `requesting` | `held` | `released` | `blocked`,
  with the `DOMException` name as `detail` on `blocked` — deduped against
  the previous event.

## On-device diagnostics

Four rounds of blind fixes shipped because a wake lock has no observable
effect in any environment this repo can test. `gameLayoutData()` therefore
keeps the last 8 status events and renders them in a fixed overlay inside
`GameLayout`, behind `?wakelock=debug` (persisted in `sessionStorage` so it
survives navigation; `?wakelock=off` clears it). This is the deliverable
that ends the guessing: `blocked (NotAllowedError)` and `held` are
distinguishable on the device, from the real game screen.

## Testing

`app/tests/modules/ui/wake-lock.module.test.ts` is rewritten against the new
contract: immediate acquisition, retry after a blocked request, re-acquire on
sentinel revocation with no visibility change, on `visibilitychange`, on
`pageshow` and from the watchdog sweep; no request while hidden; `blocked`
carries the error name; release/destroy stop all retries; a sentinel that
resolves after `release()` is released rather than leaked; no media element
is ever created.

`app/tests/lib/ui/game-layout.data.test.ts` covers the debug flag (default
off, on from the query param, persisted across navigation, cleared by
`?wakelock=off`) and the capped event log.

## What this cannot promise

The native API is the only mechanism that exists. If it reports `held` on
the device and the screen still sleeps, the cause is outside the page —
Low Power Mode, a platform regression, or a Guided Access/MDM policy — and
no page-level code can work around it. The overlay is what tells the two
apart.

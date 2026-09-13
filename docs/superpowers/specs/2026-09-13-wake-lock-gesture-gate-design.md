<!--
status: historical
scope: design spec
read-when: never (superseded by implementation + this repo's own docs)
updated: 2026-09-13
-->

# Design: Gesture-Gated Wake Lock Acquisition (#278 follow-up 3)

## Problem

The embedded-video fix (PR #317) still did not keep an iOS Home Screen
install awake, per user testing. Root cause this time: both mechanisms
`WakeLockController` uses — `navigator.wakeLock.request()` and autoplaying
the fallback `<video>` — require genuine user-gesture transient activation
on iOS Safari. Safari rejects `wakeLock.request()` with `NotAllowedError`,
and refuses to autoplay video, when the call isn't a direct result of a
tap/click; NoSleep.js's own README states its `enable()` "must be wrapped
in a user input event handler" for exactly this reason.

`WakeLockController.acquire()` is called from `gameLayoutData().init()` —
Alpine's mount lifecycle, not a user gesture. Both attempts (#316, #317)
called through this same path, so both mechanisms were likely being
silently rejected/blocked regardless of which fallback technique was used
underneath. This is a more fundamental issue than the mechanism itself.

Separately (informational, not actionable): standalone/PWA-mode Wake Lock
had a WebKit bug only fixed in iOS 18.4 — below that version the native API
cannot work in standalone mode no matter what code does. This is exactly
why the gesture-gated video fallback (which does not depend on the native
API's correctness) is the mechanism that must actually carry the fix.

The user asked to depend on `nosleep.js` instead of maintaining a hand-
rolled copy of its technique. Investigated and rejected: `nosleep.js`'s
constructor picks native-or-video once, based only on `"wakeLock" in
navigator` — true on iOS ≥16.4 regardless of whether standalone mode
actually honors it — with no supported option to force video mode. Using
its public API as intended would pick the (broken pre-18.4) native path
and never build its video element on exactly the iOS versions this fix
targets. Decision (user-confirmed): keep the existing hand-rolled video
code from the #317 fix (already NoSleep.js's own technique, reused
verbatim with attribution) rather than add the dependency.

## Components

Confined to `app/src/modules/ui/wake-lock.module.ts` and its test, as with
every prior iteration of this fix — no change to `gameLayoutData()` or
`GameLayout.astro`.

- **Gesture gating**: `acquire()` no longer immediately requests the native
  sentinel or starts the fallback video. It arms one-time listeners for a
  small set of gesture-indicating event types (`pointerdown`, `keydown`) on
  `document`. The first one to fire removes all of them and performs the
  actual acquisition (native request, plus fallback video if standalone) —
  this now runs inside the browser's transient-activation window.
- **Cancellation**: if `release()` or `destroy()` is called before any
  gesture has fired, the pending gesture listeners are removed so a late
  tap doesn't resurrect a wake lock the caller already gave up.
- **`visibilitychange` re-acquire**: unchanged — re-requesting the sentinel
  and resuming the fallback video when the tab returns to the foreground
  is an established, already-tested pattern and not implicated by this
  root cause; changing it is out of scope.

## Testing

`app/tests/modules/ui/wake-lock.module.test.ts`: every existing test that
called `await controller.acquire()` and immediately asserted the native
request/video fallback ran must now dispatch a qualifying gesture event
(e.g. `document.dispatchEvent(new Event("pointerdown"))`) after `acquire()`
before asserting. New scenarios:

- Does not request the sentinel or start the fallback before any gesture.
- Requests the sentinel / starts the fallback on the first gesture.
- A second gesture after the first does not re-trigger acquisition.
- `release()`/`destroy()` before any gesture cancels the pending listeners
  (a later gesture does nothing).

## Out of scope

- No change to `visibilitychange` re-acquire behavior.
- No change to which gesture events count beyond `pointerdown`/`keydown`
  (covers mouse, touch via pointer events, and keyboard).
- No `nosleep.js` dependency (see Problem section).

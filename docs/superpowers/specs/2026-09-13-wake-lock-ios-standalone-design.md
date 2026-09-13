<!--
status: historical
scope: design spec
read-when: never (superseded by implementation + this repo's own docs)
updated: 2026-09-13
-->

# Design: iOS Standalone Wake Lock Fallback (#278 follow-up)

## Problem

The wake lock fix (`WakeLockController`, PR #311) is correct against the
Screen Wake Lock API — verified against a real Chromium engine, which
requests, holds, and re-acquires the sentinel exactly as designed. On iOS
Safari in standalone mode (added to Home Screen — this app's primary
intended usage, per `manifest.json`'s `"display": "standalone"` and
`apple-mobile-web-app-capable`), the same API is unreliable: it can resolve
successfully without actually keeping the display on. The original design
swallows every failure silently (`onError` optional, no user-visible
signal), so this failure mode is invisible.

Because the native API can report success without effect, failure cannot
be reliably detected. The fallback therefore runs unconditionally whenever
standalone mode is detected, in parallel with the native request, rather
than being gated on native failure.

## Components

All changes live in the existing `app/src/modules/ui/wake-lock.module.ts`
and its test — no other file changes (`gameLayoutData()` and
`GameLayout.astro` are unaffected; the integration point stays the same).

- **Standalone detection**: `navigator.standalone === true` (iOS legacy
  flag) or `matchMedia('(display-mode: standalone)').matches`. Used only
  to gate the fallback — never affects the native `wakeLock.request` path.
- **Video fallback mechanism**: a hidden 2×2 `<canvas>`, captured via
  `canvas.captureStream(1)`, assigned as `srcObject` to an off-screen,
  muted, `playsinline`, `aria-hidden` `<video>` that autoplays. No
  embedded binary/base64 media asset — pure canvas + MediaStream, so the
  diff stays text-only.
- **`acquire()`**: unconditionally attempts the native
  `wakeLock.request('screen')` (unchanged), and additionally starts the
  video fallback when standalone is detected. Both mechanisms run
  independently; neither is conditioned on the other's outcome.
- **`release()` / `destroy()`**: stop the fallback's `MediaStream` track
  and remove the `<video>`/`<canvas>` elements, alongside the existing
  native sentinel teardown.
- **`visibilitychange` handler**: extended to also resume the fallback
  video (`video.play()`) if it is paused when the tab returns to visible —
  the same re-acquire mitigation already applied to the native sentinel.

## Testing

`app/tests/modules/ui/wake-lock.module.test.ts` gains coverage (alongside
existing native-API tests) for:

- Starts the video fallback when standalone mode is detected.
- Does not start the fallback outside standalone mode (regular tab,
  desktop, Android).
- Tears down the fallback on `release()` and `destroy()`.
- Resumes a paused fallback video on `visibilitychange` back to visible.

Mocks: `HTMLCanvasElement.prototype.captureStream`,
`HTMLMediaElement.prototype.play`, `navigator.standalone`, `matchMedia`.

## Out of scope

- No change to the native Wake Lock API path or its existing tests.
- No user-visible indicator of which mechanism (native vs. fallback) is
  active — same silent-degradation stance as the original design.
- No embedded media asset.

<!--
status: historical
scope: design spec
read-when: never (superseded by implementation + this repo's own docs)
updated: 2026-09-13
-->

# Design: Fix iOS Standalone Video Fallback (#278 follow-up 2)

## Problem

The video fallback shipped in PR #316 (`docs/superpowers/specs/2026-09-13-wake-lock-ios-standalone-design.md`)
still does not keep an iOS Home Screen install awake — confirmed by the user
after merge. Root cause: `HTMLCanvasElement.captureStream()` on iOS Safari is
subject to an unresolved WebKit bug (webkit.org bug 181663) — a `<video>`
element cannot actually play back a `MediaStream` sourced from
`canvas.captureStream()` on iOS. The fallback's `video.play()` call resolves
(the tests mock it, and the real API doesn't reject either), but no frames
ever render, so nothing prevents display sleep. The mechanism was broken
specifically on the one platform it was built for.

This supersedes the "no embedded binary/base64 media asset" constraint from
the prior design — that constraint is incompatible with a working iOS
fallback. NoSleep.js (a production library solving this exact problem since
2016) uses a small embedded video file instead of canvas capture, for
precisely this reason.

## Components

All changes remain confined to `app/src/modules/ui/wake-lock.module.ts` and
its test — no other file changes.

- **Video source**: replace the canvas/`captureStream` mechanism with a
  small embedded silent MP4 (H.264/AAC), reused verbatim (MIT-licensed) from
  NoSleep.js (`richtr/NoSleep.js`, `src/media.js`, `mp4` export) as a
  `data:video/mp4;base64,...` string — ~5KB, proven to loop reliably in
  Safari/iOS in production for years. No webm source is included: Safari
  never plays webm, and standalone-mode detection means this path only ever
  runs on WebKit.
- **Looping**: NoSleep.js does not rely on the native `loop` attribute for
  its mp4 asset (only for its sub-1-second webm clip) — it resets
  `currentTime` on `timeupdate` once playback passes 0.5s. Replicated
  verbatim here since it is the specific, tested workaround for a Safari
  looping reliability issue, not an arbitrary choice.
- **`createFallbackVideo()`**: creates the `<video>`, sets `src` to the
  embedded data URI directly (no `<canvas>`, no `<source>` children needed
  for a single format), wires the `timeupdate` re-seek, keeps existing
  hidden/off-screen/`aria-hidden`/`muted`/`playsinline` attributes.
- **`acquire()` / `release()` / `destroy()` / `visibilitychange`**: unchanged
  behaviorally — same gating (standalone-mode detected → start fallback
  unconditionally alongside native request), same teardown triggers. Only
  `stopFallbackVideo()` changes internally (no `MediaStream`/tracks to stop
  — just pause and detach the element).

## Testing

`app/tests/modules/ui/wake-lock.module.test.ts`: replace the
`stubVideoFallback()` helper's `HTMLCanvasElement.prototype.captureStream`
mock with a `HTMLMediaElement.prototype.play` mock only (no canvas
involved anymore). Existing fallback tests (start on standalone signal,
no-op outside standalone, teardown on release/destroy, resume on
visibilitychange) keep the same assertions, minus the
`captureStream`-specific expectation. No new test scenarios — this is a
mechanism swap, not a behavior change.

## Out of scope

- No change to the native Wake Lock API path or its tests.
- No user-visible indicator of which mechanism is active.
- No attempt to re-verify this fix against a real iOS device from this
  sandbox — no iOS hardware or BrowserStack-style access available; the fix
  is verified against the WebKit bug report and NoSleep.js's own
  production-proven implementation of the identical technique.

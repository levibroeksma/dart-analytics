---
id: D0274
status: accepted
date: 2026-09-13
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The screen wake lock is native-only and self-healing; the silent-video fallback is deleted

## Context and Problem Statement
Three shipped fixes (PRs #316, #317, #318) all failed on the same device because they substituted mechanisms around a fallback that cannot work where it was aimed: `richtr/NoSleep.js` issue #27 reports the silent-video technique failing specifically in an iOS Home Screen web app while working in a Safari tab, so the canvas and MP4 variants were both dead on arrival there. The native API's own failure in Home Screen apps was WebKit bug 254545, fixed in iOS 18.4 — the reporting device runs iOS 26 with Low Power Mode off, so nothing platform-level blocks it. What the shipped controller did wrong was assume one acquisition holds: iOS revokes a lock with no `visibilitychange`, signalling only through the sentinel's `release` event, which nothing listened for, and #318's gesture listeners disarmed after the first event, so a request that failed once was never retried for the rest of the page's life. Gesture listening is kept as a retry opportunity rather than a precondition because neither the spec (w3c/screen-wake-lock issue 350, still open) nor WebKit requires transient activation for this API.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`modules/ui/wake-lock.module.ts` keeps `navigator.wakeLock` as its only mechanism. The embedded base64 MP4 fallback, the `canvas.captureStream` fallback before it, and the `navigator.standalone`/`display-mode` detection that gated them are deleted, as is the one-shot gesture gate that replaced immediate acquisition. In their place the controller re-requests the lock from every re-entry point — the sentinel's own `release` event, `visibilitychange`, `pageshow`, `focus`, `pointerdown`/`touchend`/`click`/`keyup` in capture phase, and a 15s watchdog sweep — all funnelled into one idempotent `ensureHeld()` that no-ops when the lock is held, a request is in flight, or the document is hidden. It emits a deduped `{status, detail, at}` event (`idle`/`unsupported`/`requesting`/`held`/`released`/`blocked`, `blocked` carrying the `DOMException` name), which `gameLayoutData()` renders as an on-device overlay behind `?wakelock=debug`.".

### Consequences
A wake lock has no observable effect in jsdom or in any browser this repo can drive, which is why four passes shipped on inference alone; the `?wakelock=debug` overlay makes `held` and `blocked (NotAllowedError)` distinguishable from the real game screen, and it is the evidence the next iteration must start from rather than another mechanism swap. If the overlay reads `held` while the screen still sleeps, the cause is outside the page (Low Power Mode, a platform regression, a Guided Access or MDM policy) and no page-level code can address it. Removing the fallback also removes a ~5KB base64 asset and its `timeupdate` re-seek loop from every game page.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-13

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

# The screen wake lock is native-only and self-healing; the silent-video fallback is deleted

## Context and Problem Statement
Three shipped fixes (PRs #316, #317, #318) all failed on the same device because they substituted mechanisms around a fallback that cannot work where it was aimed: `richtr/NoSleep.js` issue #27 reports the silent-video technique failing specifically in an iOS Home Screen web app while working in a Safari tab, so the canvas and MP4 variants were both dead on arrival there. The native API's own failure in Home Screen apps was WebKit bug 254545, fixed in iOS 18.4 — the reporting device runs iOS 26 with Low Power Mode off, so nothing platform-level blocks it. What the shipped controller did wrong was assume one acquisition holds: iOS revokes a lock with no `visibilitychange`, signalling only through the sentinel's `release` event, which nothing listened for, and #318's gesture listeners disarmed after the first event, so a request that failed once was never retried for the rest of the page's life. Gesture listening is kept as a retry opportunity rather than a precondition because neither the spec (w3c/screen-wake-lock issue 350, still open) nor WebKit requires transient activation for this API.

## Decision Drivers
* The silent-video technique fails in an iOS Home Screen web app (`richtr/NoSleep.js` issue #27), so the canvas and MP4 variants (#316, #317) were dead on arrival.
* The native API's Home Screen bug (WebKit 254545) is fixed in iOS 18.4, and the reporting device runs iOS 26 with Low Power Mode off.
* iOS revokes a held lock without a `visibilitychange`, signalling only through the sentinel's `release` event, which nothing listened for.
* A wake lock has no observable effect in jsdom or in any environment this repo can drive, so four passes shipped on inference alone.
* The embedded ~5KB base64 MP4 and its `timeupdate` re-seek loop cost battery on a screen meant to stay lit for a whole match.

## Considered Options
* Keep adding to the video fallback, as the canvas `captureStream` (#316), embedded MP4 (#317) and gesture gate (#318) passes did.
* Native-only, self-healing controller with on-device diagnostics (chosen).

## Decision Outcome
Chosen option: "`modules/ui/wake-lock.module.ts` keeps `navigator.wakeLock` as its only mechanism. The embedded base64 MP4 fallback, the `canvas.captureStream` fallback before it, and the `navigator.standalone`/`display-mode` detection that gated them are deleted, as is the one-shot gesture gate that replaced immediate acquisition. In their place the controller re-requests the lock from every re-entry point — the sentinel's own `release` event, `visibilitychange`, `pageshow`, `focus`, `pointerdown`/`touchend`/`click`/`keyup` in capture phase, and a 15s watchdog sweep — all funnelled into one idempotent `ensureHeld()` that no-ops when the lock is held, a request is in flight, or the document is hidden. It emits a deduped `{status, detail, at}` event (`idle`/`unsupported`/`requesting`/`held`/`released`/`blocked`, `blocked` carrying the `DOMException` name), which `gameLayoutData()` renders as an on-device overlay behind `?wakelock=debug`.".

### Consequences
A wake lock has no observable effect in jsdom or in any browser this repo can drive, which is why four passes shipped on inference alone; the `?wakelock=debug` overlay makes `held` and `blocked (NotAllowedError)` distinguishable from the real game screen, and it is the evidence the next iteration must start from rather than another mechanism swap. If the overlay reads `held` while the screen still sleeps, the cause is outside the page (Low Power Mode, a platform regression, a Guided Access or MDM policy) and no page-level code can address it. Removing the fallback also removes a ~5KB base64 asset and its `timeupdate` re-seek loop from every game page.

* Good, because the `?wakelock=debug` overlay makes `held` and `blocked (NotAllowedError)` distinguishable on the device.
* Neutral, because a lock that reports `held` while the screen sleeps points outside the page: Low Power Mode, a platform regression, or a Guided Access or MDM policy.

### Confidence
Rationale unknown — no source found.

### Revisit When
The `?wakelock=debug` overlay reads `held` while the screen still sleeps. The next iteration starts from that overlay evidence rather than another mechanism swap.

### Confirmation
Unit tests are the ceiling. The plan's verification bar is on-device: the user runs the `?wakelock=debug` overlay, and the task is not fixed until it reads `held` on the device through a full match.

## Pros and Cons of the Options
### Keep adding to the video fallback
* Bad, because the technique does not work in an iOS Home Screen app, so each variant could not have worked whatever its internals.
* Bad, because the controller acquires at most twice per page load and reports nothing when it fails.

### Native-only, self-healing controller
* Good, because one idempotent `ensureHeld()` runs from every re-entry point, so the listeners stay armed for the controller's lifetime.
* Good, because the deduped `{status, detail, at}` event and the overlay make `held` and `blocked (NotAllowedError)` distinguishable from the real game screen.
* Bad, because if the overlay reads `held` while the screen sleeps, the cause is outside the page and no page-level code can address it.

## Evidence / More Information
Decided: 2026-09-13

* `docs/superpowers/specs/2026-09-13-wake-lock-self-healing-design.md` (Problem, Components, On-device diagnostics, Testing, What this cannot promise): rebuilt Decision Drivers, Considered Options, Pros and Cons and Revisit When.
* `docs/superpowers/plans/2026-09-13-wake-lock-self-healing.md` (Tasks 1–3, Verification bar): rebuilt Confirmation.
* Commit `3b6210b8` (2026-09-13; adds D274): confirmed the decision text and the drivers.

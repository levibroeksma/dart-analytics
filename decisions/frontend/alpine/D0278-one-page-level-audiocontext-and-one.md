---
id: D0278
status: accepted
date: 2026-09-14
origin: contemporaneous
original-date:
tags: [frontend/alpine, stores, x-data]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# One page-level `AudioContext` and one routine-wide `SessionClock`, surfaced through a `trainingSession` store in the layout header

## Context and Problem Statement
three defects with one shape. (a) Each `SegmentTimer` created its own `AudioContext`, so D270's gesture unlocked only the Warm-Up timer's — every later step's timer built a fresh suspended context and stayed silent, which is why cues were heard between warm-up phases but never between exercises. A context is unlocked per page, not per object, so one shared context makes a single gesture cover every later cue. (b) Each step had its own clock and none spanned the routine, so nothing could show total session time. `SessionClock` is a separate primitive rather than a `SegmentTimer` mode because `SegmentTimer` is defined by a total it counts toward and completes at, which a routine-wide clock has not got. (c) The header renders inside `GameLayout`'s own `x-data="gameLayout()"` scope, an ancestor of the page's `x-data`, so an expression there cannot reach a page component's members — `$store` is the only binding both scopes share.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "audio moves out of `SegmentTimer` into `modules/ui/audio-cue.module.ts`, which owns a single lazily-created `AudioContext` for the page and exports `unlockAudioCues()`, `playAudioCue(frequency, duration)` and `resetAudioCues()`; `SegmentTimer.unlockAudio()`/`playBeep()` now delegate to it and the class holds no context of its own. `balanced-training-play.data.ts` additionally plays an explicit step-change cue (660 Hz, 0.25 s) whenever a step other than the routine's first opens. A new `modules/ui/session-clock.module.ts` (`SessionClock`) is one open-ended count-up started by whichever step runs first (`startSessionClock()` is idempotent, called from `startWarmUpTimer`, `startStepTimer` and `startFinishingStep`) and stopped only when the routine completes or is abandoned; its elapsed seconds are derived from `Date.now()` rather than counted per tick. A new non-persisted `stores/training-session.store.ts` holds `active`, `elapsedSeconds` and `stepKey`, and derives `headerLabel` (`"00:38 - warm up"`, with `WARM_UP`/`SWITCHING`/`DOUBLE_PATTERN`/`GAME` reading as warm up / switching / doubles / finishing). `play/index.astro` swaps `gameTitle="Balanced Training"` for `gameTitleExpr="$store.trainingSession.headerLabel"`.".

### Consequences
the routine's title no longer appears during play, by request — the clock and the running exercise are what the header carries. `gameTitleExpr` was already the layout's hook for a live title; `501/play/index.astro` passes a page-scope expression (`matchTitle()`) to it, which by the scope rule above cannot resolve — noticed here, not touched, filed as discovered work. Tests: `SegmentTimer`'s own audio cases now reset the shared context between cases (`resetAudioCues()`), and `balanced-training-play.data.test.ts` mocks `playAudioCue`, so the timer's own completion beep and the step-change cue are told apart by frequency. `SessionClock`'s interval never self-terminates, so a test that leaves a routine mid-flight must clear timers (`vi.clearAllTimers()` in `afterEach`) rather than call `vi.runAllTimersAsync()`; the existing deadline case was switched to a bounded `advanceTimersByTimeAsync`, which also exposed that `vi.clearAllMocks()` leaves a prior case's `mockRejectedValue` implementation in place.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-14

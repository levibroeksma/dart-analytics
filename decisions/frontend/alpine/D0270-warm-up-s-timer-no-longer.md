---
id: D0270
status: accepted
date: 2026-09-13
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, state]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Warm-Up's timer no longer auto-starts; a "Let's play!" tap unlocks audio first

## Context and Problem Statement
the Warm-Up phase-change ping (`docs/architecture/09-Training/01-Routines.md` §16; spec'd in `docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` §6.1) never played. `SegmentTimer`'s `AudioContext` was created and `resume()`-d lazily from inside a `setInterval` tick, on a timer that was itself started automatically by Alpine's `init()` lifecycle hook (no click involved) after two awaited network round-trips. Browser autoplay policy only lifts a suspended `AudioContext` when creation/`resume()` runs synchronously inside a real user-gesture handler; nothing in that chain qualified, so commit `63e0b2a`'s earlier "resume before beep" fix addressed the state check but not the timing, and stayed silently broken. The Warm-Up screen was deliberately built with zero on-screen interaction (`docs/superpowers/specs/2026-09-12-warmup-play-interface-design.md`, "no button, no text"), and this app has no `ClientRouter`/view-transitions, so the routine's own "Start" button — on a separate page, one full navigation earlier — can't carry a gesture forward either. A single deliberate tap on the Warm-Up screen itself was chosen over the alternatives considered: moving the unlock onto the previous page's Start button (would require replacing full-page navigation with a client-side transition for this one flow) or leaving it best-effort on browsers' Media Engagement Index heuristics (unreliable, not acceptable for a training cue).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`balanced-training-play.data.ts`'s `startCurrentStep()` no longer calls `startWarmUpTimer()` from its `WARM_UP` branch — it only calls `buildWarmUpEngine()` and sets two new fields, `warmUpReady = false` and `warmUpConfiguration = result.configuration`. A new `confirmWarmUpReady()` method (no-op if already ready or if `warmUpConfiguration` is unset) flips `warmUpReady` to `true` and calls `startWarmUpTimer(this.warmUpConfiguration)`. `WarmUpPanel.astro` renders two `x-if` branches on `warmUpReady`: `false` shows a centered "Are you ready?" title plus a `Button` titled "Let's play!" wired `@click="confirmWarmUpReady()"`; `true` shows the existing count-up display and dartboard highlight, unchanged. `SegmentTimer` (`app/src/modules/ui/segment-timer.module.ts`) gains a public `unlockAudio()` method — `playBeep()`'s existing suspended-context check is factored out into a shared private `resumeIfSuspended(ctx)` used by both — and `startWarmUpTimer()` calls `this.warmUpTimer.unlockAudio()` immediately after constructing the timer, before `.start()`.".

### Consequences
supersedes the "no button, no text" Warm-Up screen design from `docs/superpowers/specs/2026-09-12-warmup-play-interface-design.md`/`-implementation.md` (both `docs/superpowers/specs/**` — historical, left unedited per `docs/CLAUDE.md`). Every other `SegmentTimer` consumer already starts from a real "Start" button click (Score Training, TUOD, 121, Quick Subtract) and is untouched by this decision; whether any of them can be reached without a preceding click, reproducing the same silent-audio defect, was not investigated here. `app/tests/modules/ui/segment-timer.module.test.ts` gains a direct `unlockAudio()` test; `app/tests/lib/training/routines/balanced-training-play.data.test.ts`'s three existing Warm-Up cases that asserted the timer already running right after `init()` now call `confirmWarmUpReady()` first, plus two new cases cover the gating (`warmUpTimer` stays `null` until confirmed) and the audio-unlock call itself (`SegmentTimer.prototype.unlockAudio` spy).

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
Referenced by D0454's `Supersedes:` line.

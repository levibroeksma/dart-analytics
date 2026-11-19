---
id: D0483
status: accepted
date: 2026-10-23
origin: contemporaneous
original-date:
tags: [frontend/alpine, state, x-data]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Every timed surface offers pause; `SegmentTimer`/`SessionClock` gain `pause()`/`resume()`, and a test pins the rule

## Context and Problem Statement
a timed session with no pause forces an abandon or an unattended clock; four surfaces were left out when D260/D459 covered the MINUTES games and routine game steps. A mechanical check is what makes the rule apply to games and routine steps added later.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "any timed setting — a standalone game, a trivia tool, or a routine step — must offer pause, no exceptions (#1063). `SegmentTimer` gains `pause()`/`resume()` that keep `remaining` and the segment index (`start()` resets the index, which would re-fire a segmented count-up's `onSegmentChange` every tick on resume); `SessionClock` gains `pause()`/`resume()` and excludes paused wall time from `elapsedSeconds()`. `routinePlay` gains `pausable()`, `paused()`, `pauseLabel()` and `togglePause()`: a game step delegates to its own pause (`$store.game.timerPaused`), an exercise or warm-up step freezes its `stepTimer`/`warmUpTimer` through a scope-local `timerPaused`, and the session clock follows either; `recordInto` no-ops while paused, and `clearPause()` runs when a step timer starts and when a step completes. `QuickSubtractGame` gains `pause()`/`resume()`/`isPaused()` and refuses answers while paused; `quickSubtractPlay` gains `paused`, `pausable()`, `pauseLabel()` and `togglePause()`. `CountdownPauseControl` gains `pausedExpr`, `showExpr`, `labelExpr` and `toggleExpr`, and `CountdownResumePrompt` gains `pausedExpr` and `toggleExpr`, each defaulting to the `$store.game` reads, so one pill and one prompt serve every scope; routine play renders the pill for every step type and the prompt in place of an exercise panel, and Quick Subtract mounts `x-data` on `GameLayout` to fill `header-end`. `HeaderClockPill` is removed — every clocked step is now pausable, so the read-only readout has no caller. `tests/lib/timed-surfaces-pause.test.ts` scans `src/lib` and fails when a file that starts a `SegmentTimer` or `startCountdown` has no `togglePause`, so a new timed game or step cannot ship without pause. Pause state is not persisted for exercise steps or Quick Subtract.".

### Consequences
no API or schema change. Exercise steps cannot be paused across a reload: their timers do not survive one today.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-23
Supersedes: D275 (only its "no pause/resume, no `timerPaused` for exercises" clause)

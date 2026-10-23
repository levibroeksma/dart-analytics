# Pause for Every Timed Surface (#1063)

Status: approved (brainstorming)

## Problem

D260/D459 gave pause to the four MINUTES-countdown games and routine game
steps. Four timed surfaces still cannot pause: routine exercise steps (12
engines, one countdown `stepTimer`; D275 ruled "no pause for exercises"),
routine warm-up (count-up `warmUpTimer`), the routine `SessionClock`, and
Quick Subtract (`count` and `timer` modes).

## Rule (architectural)

Any timed setting — standalone game, trivia tool, or routine step — must
offer pause. Mechanically enforced: a test fails when a play-data file
constructs a `SegmentTimer` without owning a `togglePause`.

## Design

1. `SegmentTimer.pause()` / `resume()` keep `segmentIndex`. `start()` resets
   it, so a stop/start resume of a segmented count-up re-fires
   `onSegmentChange` every tick until caught up.
2. `SessionClock.pause()` / `resume()` accumulate elapsed time; paused time
   is excluded.
3. `routine-play.data.ts`: `togglePause()` for non-game steps pauses the
   step or warm-up timer and the session clock; input actions no-op while
   paused. Game steps keep the existing `$store.game.timerPaused` path.
4. `CountdownPauseControl` / `CountdownResumePrompt` gain `pausedExpr` and
   `toggleExpr` props defaulting to today's `$store.game` values. The routine
   header renders one pause pill for every step type, replacing
   `HeaderClockPill`; the resume prompt replaces the step panel while paused.
5. Quick Subtract: `togglePause()` in `quick-subtract-play.data.ts`, same two
   components.
6. Paused state is not persisted for exercise steps or Quick Subtract
   (their timers do not survive a reload today).
7. New decision supersedes D275's "no pause" line; guard test; checklist line
   in `authoring-game-rules` and the frontend guide.

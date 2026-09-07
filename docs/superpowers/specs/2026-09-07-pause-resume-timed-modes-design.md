# Pause/Resume for Timed Game Modes

Status: approved (brainstorming), ready for `writing-plans`

## Problem

Score Training, TUOD, and 121 (`121_V2`) each support a `MINUTES` duration
mode with a live countdown (`SegmentTimer`). Once started, the clock runs
until it expires — there is no way to pause it for a break and resume where
it left off.

## Scope

The 3 rulesets whose config carries `durationType === "MINUTES"`:
Score Training, TUOD, 121 (`121_V2` only — `121_V1` has no duration type).
No other game type is touched.

One toggle button (Pause ⇄ Resume) per timed session. Not a from-scratch
restart — resuming continues the countdown from wherever it was paused
(`SegmentTimer.stop()` already preserves `remaining`; `start()` after `stop()`
resumes from it with no changes to the module).

While paused: countdown stops, and darts/visits are not recordable — pausing
freezes the whole session, not just the clock label.

## State

`game.store.ts` gains `timerPaused: boolean` (persisted, default `false`,
additive field — no `STORE_VERSION` bump per D89). Reset to `false` in
`startSession()`, `reset()`, and each of the 3 pages' `runPlayAgain` reset
callback (alongside the existing `timerRemainingMs`/`timerStartedAt`/
`timerExpired` resets).

`PlayStoreContext.game` (`lib/game/types.ts`) gains `timerPaused?: boolean`,
matching the existing optional `timerExpired?: boolean`.

`timerPaused` is ephemeral client UI state, same precedent as `timerExpired`:
persisted locally, never written to the fact log, never uploaded as part of
the events batch.

## Shared toggle (`play-lifecycle.ts`)

New export:

```ts
export function playToggleTimerPause<TConfig, TEngine extends GameEngine<DartObservation, unknown>, TResults>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults> & { timer: SegmentTimer | null },
): void
```

- paused → `timer.start()`, `$store.game.timerPaused = false`
- running → `timer.stop()`, `$store.game.timerPaused = true`
- no-op when `!timer` or `context.finished`

Each of `score-training-play.data.ts`, `tuod-play.data.ts`,
`one-twenty-one-play.data.ts` exposes a thin wrapper:

```ts
togglePause(this: XPlayContext) {
  playToggleTimerPause(this);
},
```

## Reload/resume honors pause

Each page's `init()` already calls its own `startCountdown()` when
`config.durationType === "MINUTES"` and the timer hasn't expired. After that
call returns, if `$store.game.timerPaused` is already `true` (persisted from
before a reload), call `timer.stop()` immediately — synchronously, before
`SegmentTimer`'s first 1000ms tick, so no time is lost. `startCountdown`
itself is unchanged.

## Blocking input while paused

- **Board darts + DartBot's visual-board loop**: both already funnel through
  the shared `playCommitDart` and `playRunBotVisualBoardVisit` in
  `play-lifecycle.ts`. Add one `if (context.$store.game.timerPaused) return;`
  guard to each. This covers all 3 games in one place and is a no-op for
  every other game type (the flag is always `false`/`undefined` there).
- **Keypad totals** (`submitVisit` in Score Training, `submitVisit`/
  `recordAttempt` in TUOD, `submitVisit`/`recordVisit` in 121 — all call
  `engine.record` directly, bypassing `playCommitDart`): add
  `|| this.$store.game.timerPaused` to each function's existing top-of-function
  guard clause, matching the current style
  (`!this.engine || this.finished || this.showFinishConfirm`).
- **Undo** (`undoVisit`, one per file): same guard addition, for consistency
  — nothing changes state while paused.
- **UI**: `ScoreInput` / `BoardInputPanel` bind their existing
  `submitDisabled`/`padDisabled`/`x-show` expressions to also include
  `$store.game.timerPaused`, mirroring how `showFinishConfirm`/`finished`
  already disable them.

## UI

New Pause/Resume button, inline next to the existing MM:SS countdown label,
in each of the 3 game interface components:
`ScoreTraining.astro`, `TenUpOneDown.astro`, `OneTwentyOne.astro` (each
already renders that block, gated on
`$store.game.configSnapshot?.durationType === 'MINUTES'`).

- Two new icons, `pause.svg` and `play.svg`, matching the existing inline-SVG
  stroke style (`stroke="currentColor"`, `stroke-width="1.5"`, 24×24 viewBox
  — see `exit.svg`).
- Rendered through the existing `Button` primitive (`variant="ghost" icon`),
  `ariaLabel="Pause timer"` / `"Resume timer"`.
- Icon swapped via `x-show="$store.game.timerPaused"` (play icon) /
  `x-show="!$store.game.timerPaused"` (pause icon), each with `x-cloak`.
- `:disabled` bound to `finished || showFinishConfirm` (`|| showDoubleConfirm`
  on TUOD/121, which have that extra confirm state) — same fields each
  page's own guards already reference.

## Out of scope / unaffected

- Server/API and the engine's `record`/`isComplete`/fact log — untouched.
  Pausing is a client-only session-freeze; it never reaches the DB.
- Non-`MINUTES` sessions (`TARGET`/`ROUNDS`) and every other game type — the
  button is never rendered, the flag is never set, the new guards never
  trigger.
- `SegmentTimer` module — no changes; its existing `stop()`/`start()` already
  supports pause/resume.

## Testing

- `lib/game/score-training-play.data.test.ts`,
  `lib/game/tuod-play.data.test.ts`,
  `lib/game/one-twenty-one-play.data.test.ts`: `togglePause()` flips
  `timerPaused` and calls `timer.start()`/`timer.stop()`; reload with
  `timerPaused: true` in the persisted store leaves the rebuilt timer stopped;
  keypad submit / undo / board-dart record are all no-ops while paused.
- `lib/game/play-lifecycle.test.ts`: `playToggleTimerPause` unit-tested
  directly; `playCommitDart` and `playRunBotVisualBoardVisit` gain cases for
  the `timerPaused` guard.
- `stores/game.store.test.ts`: `timerPaused` resets to `false` on
  `startSession()`/`reset()`.

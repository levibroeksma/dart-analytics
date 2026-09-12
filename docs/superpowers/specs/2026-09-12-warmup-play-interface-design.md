<!--
status: design
scope: Balanced Training's Warm-Up play screen — timer, sound, dartboard highlight
read-when: implementing app/src/components/layout/training/WarmUpPanel.astro, the warm-up wiring in app/src/lib/training/balanced-training-play.data.ts, app/src/modules/ui/segment-timer.module.ts, or app/src/components/ui/DartBoard.astro's highlight overlay
updated: 2026-09-12
-->

# Warm-Up Play Interface — Design

## 1. Problem

The approved `docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md`
§6 already specified a Warm-Up play screen with no button, auto-advancing phases, a ping
sound on every phase change, and a dartboard highlight around the current phase's target(s).
None of that shipped. `docs/superpowers/plans/2026-09-12-balanced-training-playable-implementation.md`
Step 5 instead built `WarmUpPanel.astro` as a manual-advance screen: plain text phase
name/counter, a raw target-number list, and a "Next phase" `Button` the player must tap.
`DartBoard.astro` has no highlight geometry at all today.

This spec corrects the Warm-Up play screen to match the approved design, and adds one
requirement the 2026-09-11 spec didn't cover: a single always-visible count-up timer for
the step's total duration.

## 2. Scope

In scope: `WarmUpPanel.astro`, the Warm-Up wiring inside
`app/src/lib/training/balanced-training-play.data.ts`, `SegmentTimer`
(`app/src/modules/ui/segment-timer.module.ts`), a new highlight overlay in
`DartBoard.astro`, and one pure helper extracted from `WarmUpEngine`.

Out of scope: Switching, Double Pattern, Finishing, any schema/migration/seed change, and
`WarmUpEngine`'s contract — it stays clockless (D264); it gains one pure helper function,
nothing else.

## 3. Final interface

`WarmUpPanel.astro` renders exactly two things:

- `DartBoard`, with a highlight around the current phase's target(s).
- A single `mm:ss` count-up readout for the step's total elapsed time (0:00 → the step's
  configured duration, 10:00 in Balanced Training today).

No button. No phase name or counter text. No raw target-number text. The board highlight is
the only indicator of what the player is aiming at; the sound is the only cue that the phase
changed.

## 4. Timing model

### 4.1 Division of responsibility

All time-keeping and scheduling logic lives in `SegmentTimer` (the timer module). All
domain logic — what a phase's duration resolves to, what the next phase's targets are —
lives in `WarmUpEngine` (the engine). The store wires the two together and holds no
scheduling logic of its own.

### 4.2 `WarmUpEngine`: extract `resolveWarmUpPhaseDurations`

Today `deriveState()` computes `phaseDurationSeconds` for the *current* phase only, inline,
each time it's called. Extract the same math into a small pure function exported from
`warm-up.engine.module.ts`:

```ts
function resolveWarmUpPhaseDurations(config: WarmUpEngineInput): number[]
```

Returns one entry per phase, in order — each phase's `Math.round(stepDurationSeconds *
phase.weight / totalWeight)`, the exact rounding `deriveState()` already does for the
current phase. `deriveState()` is refactored to call this helper and index into it, rather
than repeating the calculation — one place owns the rounding rule, matching this spec's
Q&A confirmation. No change to `WarmUpState`'s shape, `advance()`, `undo()`, or
`WarmUpEngine`'s public contract.

The store calls this helper once, right after `startTrainingStep` resolves the step's
configuration, to build the segment schedule described below.

### 4.3 `SegmentTimer`: variable-length count-up segments

`SegmentTimer` gains a new construction shape, additive to its existing
`totalMinutes`/`intervalMinutes` one (unchanged, still used by every existing countdown
caller):

```ts
interface SegmentTimerOptions {
  // existing fields unchanged (totalMinutes, intervalMinutes, direction, onTick, onSegmentChange, onComplete)
  segmentDurationsSeconds?: number[]; // new — variable-length segments, seconds
}
```

When `segmentDurationsSeconds` is supplied, the timer's total is the sum of the array and
segment boundaries are the array's cumulative sums, replacing the fixed
`intervalSeconds`/modulo check. `tickCountup()` gains the same segment-boundary check
`tickCountdown()` already has: when accumulated elapsed time crosses the next cumulative
boundary, increment `segmentIndex`, call `playBeep()`, call `onSegmentChange(segmentIndex)`
— mirroring `tickCountdown()`'s existing shape exactly, just for count-up and variable
lengths instead of a fixed countdown interval. `onComplete` fires once elapsed reaches the
array's total, exactly as today's `completeTimer()` does, including its own final beep.

No existing caller passes `segmentDurationsSeconds`, so no existing behavior changes.

### 4.4 Store wiring

In `balanced-training-play.data.ts`, when `startCurrentStep()` resolves a `WARM_UP` step:

1. Build `warmUpEngine` as today (unchanged).
2. Call `resolveWarmUpPhaseDurations(result.configuration)` to get the 5 phase-second
   lengths.
3. Construct `this.warmUpTimer = new SegmentTimer({ segmentDurationsSeconds, direction:
   "countup", onTick, onSegmentChange, onComplete })` and call `start()`.
4. `onTick(elapsed)`: sets `this.warmUpElapsedSeconds = elapsed` — the field the panel
   formats and displays.
5. `onSegmentChange`: calls `this.warmUpEngine.advance()`. Nothing else — the beep already
   played inside `SegmentTimer`, and the board highlight re-reads `warmUpEngine.state()`
   reactively (see §5), so no separate "update highlight" step is needed.
6. `onComplete`: calls `this.warmUpEngine.advance()` (the engine's own 6th `advance()` call,
   landing it on `status: "COMPLETE"` exactly as the old button-driven path's final tap did),
   then `this.completeCurrentStep()`.

`advanceWarmUp()` is deleted — nothing calls it once the button is gone.

`completeCurrentStep()` gains `this.warmUpTimer?.stop(); this.warmUpTimer = null;` alongside
its existing cleanup (`stepDeadline`, engine nulling), so a step that ends early (e.g. the
player abandons the session) doesn't leave a dangling interval — the same pattern
`armStepDeadline`'s cleanup already establishes for Switching/Double Pattern.

### 4.5 Why not drive this from the store's own elapsed-time check

An earlier option considered a plain store-owned `setInterval` (or a store-side watcher
comparing elapsed time against thresholds) instead of extending `SegmentTimer`. Rejected:
it would duplicate scheduling/threshold logic `SegmentTimer` already owns for every other
timed mode in the app, splitting "when does a segment end" across two places instead of
one. Extending `SegmentTimer` keeps that one rule (owned by the timer module) in one
implementation, reused instead of re-derived.

## 5. Board highlight

### 5.1 Geometry

`DartBoard.astro` gains a new overlay group of 21 outline paths: one per board number
(1–20) plus one for the bull. Computed once, in a small pure TS helper (not inline in the
`.astro` frontmatter, and not hand-authored magic numbers) that reads
`BOARD_RADII_MM`/`SECTOR_ORDER` from `app/src/lib/game/board/board-geometry.module.ts` —
the same authority the rest of the board's own geometry already defers to.

For a number `n`: one continuous outline tracing that number's full angular sector — both
radial edges, the inner arc at `outerBull` (15.9mm, where the number's own single band
starts) and the outer arc at `doubleOuter` (170mm) — with no line drawn at the internal
`trebleInner`/`trebleOuter`/`doubleInner` boundaries. Single, treble and double render as
one silhouette.

For the bull (`targets: [25]`): the outline is the `outerBull` circle alone (15.9mm radius)
— not a sector, and not the inner bull.

The border sits outside the shape's edge with a visible gap (`ring`/`ring-offset-1` as the
closest Tailwind analogy) — a stroke, not the `--dartboard-segment-hover` fill treatment
used elsewhere. Same accent color (blue/sky) as the rest of the app.

### 5.2 Wiring

Each path carries a `data-number` attribute (`"1"`–`"20"`, `"25"` for bull) and is hidden by
default (`opacity-0`). `WarmUpPanel.astro` binds an `:class`/`x-bind:class` expression per
path — or one delegated expression keyed by `data-number` membership in
`warmUpEngine.state().targets` — to toggle an `.active` class that reveals the stroke.
Nothing else that renders `DartBoard` (gameplay input, the nav icon, the page background) is
affected: the new group is additive and inert unless a caller actually marks a number
active.

## 6. Testing

- `warm-up.engine.module.test.ts`: cover `resolveWarmUpPhaseDurations()` directly (equal
  weights, and at least one unequal-weight case), and confirm `deriveState()`'s
  `phaseDurationSeconds` still matches the extracted helper's output for the current phase.
- `segment-timer` tests: new coverage for `segmentDurationsSeconds` — segment boundaries
  fire at the right cumulative times in count-up mode, `onComplete` fires once at the
  array's total, existing `totalMinutes`/`intervalMinutes` countdown tests are unchanged
  and still pass.
- `balanced-training-play.data.test.ts`: replace `advanceWarmUp()`'s existing test with
  coverage of the new timer wiring — fake timers advancing through all 5 phase boundaries
  call `warmUpEngine.advance()` each time, final completion calls `completeCurrentStep()`,
  cleanup stops the timer — mirroring the file's existing `armStepDeadline` fake-timer
  tests.

## 7. Related documents

| Document | Relationship |
|---|---|
| `docs/architecture/09-training-routines.md` §16 | Canonical Warm-Up exercise description; unchanged by this spec. |
| `docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` §6 | The design this spec corrects the implementation against; supersedes §6.1/§6.2's radii detail with §5.1's corrected full-sector geometry above. |
| `docs/superpowers/specs/2026-09-12-balanced-training-playable-design.md` §6 | "Warm-Up: phase countdown, auto-advance" row — this spec is that row's actual design. |
| `app/CLAUDE.md` | `ExerciseEngine`/`TrainingEngine` clockless rule (D264) — `WarmUpEngine` stays clockless; only `SegmentTimer` and the store gain clock logic. |

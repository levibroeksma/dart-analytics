<!--
status: design
scope: Balanced Training's Switching and Double Pattern play screens — game-shaped display, visit preview, step countdown
read-when: implementing app/src/components/layout/training/SwitchingPanel.astro, DoublePatternPanel.astro, or the switching/double-pattern wiring in app/src/lib/training/balanced-training-play.data.ts
updated: 2026-09-14
-->

# Switching / Double Pattern Play Interface — Design

## 1. Problem

Balanced Training steps 2 (Switching) and 3 (Double Pattern) play on a screen that
looks nothing like the app's games. `SwitchingPanel.astro` renders two `StatRow`s
(Target, Points) above `ExerciseBoardInputPanel`; `DoublePatternPanel.astro` renders
the same shape with Double/Points. Neither shows a score the way every game does,
neither confirms a recorded dart, and neither shows how much of the step is left —
the step ends on a hidden `setTimeout`, mid-visit and unannounced.

Reported as: "the second game's scoring on 20's doesn't have an input, and the UI is
inconsistent with the game UI — it should look the same as the scoring training game,
except that the point system works different."

The reported "no input" is not a capture bug. `classify()`
(`app/src/lib/game/board/board-geometry.module.ts`) resolves the whole ±9° arc around
bearing 0 to sector 20 correctly, and `SwitchingEngine`'s `pointsFor` applies
single/double/treble weighting to 20 exactly as to 19 and 18. A dart thrown at 20 is
recorded and scored today. What is missing is every signal that it was: no visit
preview, no score readout in the shape the player recognises from games.

## 2. Scope

In scope: `SwitchingPanel.astro`, `DoublePatternPanel.astro`, and the switching /
double-pattern wiring inside `app/src/lib/training/balanced-training-play.data.ts`
(plus its `types.ts` context type).

Out of scope, explicitly:

- **Engine conversion.** `SwitchingEngine` and `DoublePatternEngine` stay
  `ExerciseEngine`s (D264). They gain no `RulesetVersionKey`, no seats, no
  `game_types` row, no capture/input-mode pair. Their contracts, facts, payload
  assembly and upload path are untouched.
- **Board highlight.** `DartBoard`'s `highlightPathExpr` overlay stays Warm-Up-only.
  Neither panel passes it.
- **Pause/resume.** The step countdown is read-only. `CountdownPauseControl` /
  `CountdownResumePrompt` are not adopted; the exercise path has no `timerPaused`
  and gains none.
- **Warm-Up and Finishing steps**, schema, migrations, seeds.

## 3. Final interface

Both panels render the same skeleton, which is the skeleton every board-input game
already uses (`interfaces/SinglesTraining.astro`, `interfaces/ScoreTraining.astro`):

```
<div class="flex flex-col flex-1 min-h-0 gap-3 p-3">
  <SinglePlayerDisplay isTarget={false} score="…Points()" class="max-h-2/5 h-full">
    <div slot="progress">
      <dl> … three StatRows … </dl>
    </div>
  </SinglePlayerDisplay>
  <VisitPreview />
  <ExerciseBoardInputPanel />
</div>
```

Total points is the big number, as Singles Training does it; the target drops to a
stat row.

| Stat row | Switching | Double Pattern |
| --- | --- | --- |
| 1 | Target → `20` | Double → `D20` |
| 2 | Darts → `7` | Darts → `7` |
| 3 | Time → `3:41` | Time → `3:41` |

`ExerciseBoardInputPanel` is reused unchanged — it already carries the board,
magnifier, markers, undo and bounce-out.

`VisitPreview` is the piece that makes a recorded dart visible: a three-slot strip
marking each dart of the current visit hit or miss. `playPreviewSegments`
(`app/src/lib/game/play-lifecycle.ts`) renders exactly three slots. A Switching visit
is one pass through `config.targets` and a Double Pattern visit is one pattern — both
three in the seeded Balanced Training configuration, so they line up. A future
four-target configuration would show only its first three darts in the strip; that is
accepted, not worked around.

No panel renders its own `ErrorAlert` — the play page already renders one above the
step panels.

## 4. Data layer

All changes land in `app/src/lib/training/balanced-training-play.data.ts` and the
`BalancedTrainingPlayContext` type in `app/src/lib/training/types.ts`.

### 4.1 One clock instead of a deadline

`stepDeadline: ReturnType<typeof setTimeout> | null` is replaced by
`stepTimer: SegmentTimer | null` and `stepRemainingSeconds: number`.
`armStepDeadline(durationSeconds)` becomes `startStepTimer(durationSeconds)`:

```ts
new SegmentTimer({
  segmentDurationsSeconds: [durationSeconds],
  direction: "countdown",
  onTick: (remaining) => { this.stepRemainingSeconds = remaining; },
  onComplete: () => {
    this.switchingEngine?.expireTimer();
    this.doublePatternEngine?.expireTimer();
    void this.completeCurrentStep();
  },
});
```

`segmentDurationsSeconds: [durationSeconds]` rather than `totalMinutes` so the step's
own seconds are used exactly, with no minute rounding. Expiry semantics are unchanged:
the engine's `expireTimer()` then `completeCurrentStep()`, exactly what the
`setTimeout` callback does today.

`completeCurrentStep()` and `abandonAndExit()` call `stepTimer.stop()` and null it
where they currently `clearTimeout(stepDeadline)`.

Two consequences, both intended:

- **The step now ends with an audible beep.** `SegmentTimer.completeTimer()` plays one
  (440 Hz, 0.6 s) unconditionally. The step previously ended silently, mid-visit.
- **No interim beeps.** `intervalMinutes` is not passed, so `intervalSeconds` is 0 and
  `tickCountdown`'s `remaining % 0` is `NaN`, which never matches. Only the completion
  beep fires.

The timer is not started for Warm-Up (which keeps its own count-up `warmUpTimer`) or
for Finishing (whose TUOD session owns its own clock).

### 4.2 View methods

New methods on the play context, each deriving from the active engine's `state()` or
`facts()` — nothing accumulated on the context itself:

| Method | Returns |
| --- | --- |
| `switchingPoints()` / `doublePatternPoints()` | `state().totalPoints` |
| `switchingTargetLabel()` | `state().currentTargetNumber`, e.g. `20` |
| `doublePatternLabel()` | `"D" + state().currentDoubleNumber`, e.g. `D20` |
| `dartsThrown()` | active engine's `state().dartsThrown` |
| `formattedStepRemaining()` | `m:ss`, same shape as the existing `formattedWarmUpElapsed()` |
| `previewSegments()` | `playPreviewSegments(activeDartEngine()?.facts().turns ?? [], null, classify)` |

`dartsThrown()` and `previewSegments()` read through the existing
`activeDartEngine()`, so one implementation serves both panels.

### 4.3 Preview classification

No configuration lookup is needed. Both engines already stamp `intendedTargetNumber`
on every dart fact (`switching.engine.module.ts:166`,
`double-pattern.engine.module.ts:166`), so each dart carries the target it was thrown
at:

- Switching — hit when `dart.hitTargetNumber === dart.intendedTargetNumber`. Every
  on-target ring scores under `SWITCHING_V1` (single 1, double 2, treble 3), so
  on-target is exactly hit.
- Double Pattern — hit when `dart.hitTargetNumber === dart.intendedTargetNumber &&
  dart.hitZoneKey === "DOUBLE"`. Only the double scores; the same test
  `doubles-training.engine.module.ts:119` already uses.

`hiddenTurnKey` is `null`: the exercise path has no results modal and so no turn to
hide from the strip.

## 5. What does not change

`SwitchingEngine`, `DoublePatternEngine`, `ExerciseBoardInputPanel`, `DartBoard`,
`BoardMagnifier`, `boardInputData()`, `resolveSoloParticipantRef`,
`buildEventsBatch`, every API route, and the whole persistence path. The fact log a
step uploads is byte-identical to today's for the same darts.

## 6. Testing

Vitest, under `app/tests/lib/training/balanced-training-play.data.test.ts` (the
existing file), extended with:

- `startStepTimer` arms a countdown over the step's own seconds; on expiry the active
  engine is completed and the step advances (fake timers, asserting the same
  post-conditions the current `setTimeout` test asserts).
- `completeCurrentStep` / `abandonAndExit` stop the timer — no tick after teardown.
- `formattedStepRemaining()` formats `m:ss`, including a sub-minute and a zero case.
- `previewSegments()` classification: on-target ring → `hit` for Switching; an
  on-target single → `miss` for Double Pattern; a not-yet-thrown slot → `empty`.
- `switchingTargetLabel()` / `doublePatternLabel()` / `dartsThrown()` against a
  seeded fact log.

Panel markup is not unit-tested: there is no Astro component test runner in this
project, and per D101 branching stays inline in the component rather than being
extracted to make it testable.

## 7. Context maintenance

- This spec registered in `docs/architecture/00-File-Inventory.md`; version entry
  appended to `00-Context-Map-History.md`.
- One decision appended to `decisions/frontend/astro.md`: exercise play panels adopt
  the game display shape (`SinglePlayerDisplay` + `VisitPreview` + stat rows) while
  their engines stay `ExerciseEngine`s, and a timed exercise step's clock is a
  countdown `SegmentTimer` rather than a bare `setTimeout`.
- `docs/architecture/09-training-routines.md` §17 gains a sentence recording that the
  implemented Switching/Double Pattern play screens render points as the primary
  readout with a three-dart visit preview — the §17 "Implemented" notes already carry
  this kind of statement.
- Gates: `npm run validate:app`, `npm run format:check`, and the structural checks the
  `run-all-gates` skill dispatches for `app/` + `docs/` changes.

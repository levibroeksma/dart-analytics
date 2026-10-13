# Exercise play restyle: routine gate, exercise shell, Warm-Up spotlight

## Goal

Restyle routine exercise play to the claude.ai/design project
`Exercise Play.dc.html` (project `cdea52ee-4746-4efb-b646-81448a40c033`):
exercises read as the same shell as game play. Reuse the game-play
primitives by giving them optional props; delete the exercise-only copy
(`ExerciseBoardInputPanel`). Engines, facts and persistence do not change.

## Scope

In: the 9 scored exercise steps, Warm-Up / Warm-Up Advanced, the routine
play header, one routine-level ready gate.

Out:

- Game steps inside a routine (TUOD, Score Training, 121, Around the
  Clock) keep their own countdown and pause above the game interface. They
  only inherit the new header title/subtitle.
- `dartboard.png` from the design: the existing SVG `DartBoard` stays.
- A per-exercise ready gate.

Lands after #915 task B (`refactor/915-seated-play-screen`), which also
touches `pages/training/routines/play/index.astro`; the plan branches from
`main` once that merges.

## 1. Header and ready gate

### Header (`GameLayout`, every routine step)

- `gameTitleExpr` → the step title: a new Title Case `title` field on
  `StepAdapter` ("Target Scoring", "65 or More", "Warm-Up"). The game adapter
  supplies its game's title. The lowercase `headerLabel` stays: stats
  (`routine-stats.store.ts`) and replay (`replay.store.ts`) copy is unchanged.
- `gameSubtitleExpr` → `STEP n OF m`, from new `stepNumber` / `stepCount` on
  the `trainingSession` store (set in `openStep`). The store's `headerLabel`
  getter is removed. The routine clock keeps running in the store
  (`elapsedLabel`, summary); it just leaves the header.
- While the gate shows: title = `routineName`, no subtitle, no pill.
- `header-end` → new `HeaderClockPill.astro`
  (`components/layout/games/`): the design's 44px `inset-well` mono pill,
  `min-w-19`, no button.
  Props: `valueExpr`, `ariaLabel`, `showExpr`.
  - Scored step: `formattedStepRemaining()`, "Step time remaining".
  - Warm-Up: `formattedWarmUpElapsed()`, "Elapsed".
  - Game step: hidden — its own countdown remains above the game.
- `ExercisePanelShell` drops the appended `Time` row.

### Ready gate (`RoutineReadyGate.astro`, `components/layout/training/routines/`)

Shown once per page load, before the first step this page starts — the
fresh start and the resume/reopen paths both run through `beginRoutine`.
Its only job is the user gesture that unlocks audio; later steps open
straight away.

- Glass `rounded-3xl` card, vertically centred in the play column:
  - mono eyebrow `n STEPS · mm MIN` (sum of step `durationSeconds`, rounded
    up to whole minutes);
  - "Are you ready?" in `font-display`;
  - one `inset-well` row per step: `01`, step title, `m:ss` duration;
  - `SlideToStart`, label "Slide to start".
- Flow: `beginRoutine` builds the engine and sets `routineReady = false`
  instead of calling `startCurrentStep()`. `confirmRoutineReady()` calls
  `unlockAudioCues()` inside the gesture, sets `routineReady = true`, then
  `startCurrentStep()`. No server step starts before the slide, so no step
  time is spent on the gate.
- Warm-Up's own gate is removed: `warmUpReady`, `confirmWarmUpReady()`, the
  panel's `x-if`. The warm-up adapter's `open()` starts its timer directly,
  like the scored adapters. The `startWarmUpTimer` comment about the click
  gesture is reworded to point at the routine gate.

## 2. Scored exercise screen

### `ExercisePanelShell`

Props become `score`, `caption`, `chip?`, `tiles` (replaces `rows`):

```ts
interface ExerciseTile {
  label: string;
  value: string; // Alpine expr
  showWhen?: string; // Alpine expr; tile hidden while false (kept from rows)
}
interface ExerciseChip {
  routeExpr: string; // RouteChips input
  currentExpr?: string; // RouteChips lit part
}
interface Props {
  score: string;
  caption: string;
  chip?: ExerciseChip;
  tiles: ExerciseTile[]; // first tile renders with `highlight`
}
```

- Card: `SinglePlayerDisplay isTarget={false}` with `caption`; `route` slot
  holds `RouteChips` when `chip` is set; default slot holds `PlayStatTile`s
  (`fit`; first one `highlight`). `StatRow` leaves the exercise screen.
- `PlayStatTile` gains:
  - `highlight` — value in the accent-soft colour;
  - `fit` — `flex-1 min-h-0 max-h-19` instead of `h-19`, so 4 tiles fit
    the 40% band.
- `RouteChips` gains optional `currentExpr`: the part equal to it is lit
  (accent-soft), the others muted. Without it, rendering is unchanged.

Per exercise (all values from existing getters unless marked new):

| Exercise                 | Caption   | Tiles                            | Chip                                                         |
| ------------------------ | --------- | -------------------------------- | ------------------------------------------------------------ |
| Switching                | POINTS    | Target, Darts                    | `switchingSequence()` (new), current = target                |
| Double Pattern           | POINTS    | Double, Darts                    | `doublePatternSequence()` (new), current = double            |
| Target Scoring           | CHAIN     | Target, To beat\*, Best          | —                                                            |
| Switching Target Scoring | CHAIN     | Target, To beat\*, Best          | `switchingTargetScoringSequence()` (new), current = target   |
| 65 or More               | BEATS     | This visit, Last\*, Visits, Rate | —                                                            |
| Bullseye Checkouts       | CHECKOUTS | Left, Visits, Rate               | `` `LAST ${bullseyeCheckoutLastResult()}` ``                 |
| Bull Up Practice         | BULLSEYES | Last, Throws, Bulls              | `` `BULL ${bullUpBullRate()} EYE ${bullUpBullseyeRate()}` `` |
| Catch 40                 | POINTS    | Outshot, Left, Dart, Checkouts   | `` `LAST ${checkoutSequenceLastResult()}` ``                 |
| Random Checkout          | CHECKOUTS | Start, Left, Dart, Rate          | `` `LAST ${randomCheckoutLastResult()}` ``                   |

\* keeps its existing `showWhen`. `RouteChips` splits on a plain space, so a
two-word part (Bull Up's `BULL 36%`) joins its words with U+00A0. A `LAST` chip is hidden while there is no
last result (`RouteChips` already hides on a blank route; the expression
returns `''` then).

### `VisitPreview` / `PreviewSegment`

- `PreviewSegment` (`lib/game/types.ts`) gains optional `label?: string`
  and status `"value"`.
- `previewColumnState` passes `label` through; `"value"` counts as filled
  for `next`.
- `VisitPreview`:
  - header text = `column.label` when set, else today's HIT / MISS /
    `DART n`;
  - `"value"`: accent bar and accent label, no tick;
  - grid columns = segment count (`grid-template-columns` from the array
    length) instead of fixed `grid-cols-3`.
- Games pass no labels and always three segments → identical markup.
- Exercise segments come from a new pure
  `exercisePreviewSegments()` in `lib/training/routines/` (replaces the body
  of `previewSegments()` in `routine-play.data.ts`; the hit rules move with
  it unchanged):
  - target exercises (Switching, Double Pattern, both Target Scorings):
    hit → zone label (`T20`, `S20`); miss → MISS; empty → that dart's
    upcoming target (from engine state);
  - free aim (65 or More, Catch 40, Random Checkout, Bullseye setup darts):
    `"value"` + zone label; Bullseye's bull dart keeps hit/miss;
  - Bull Up: one column, empty label `THROW n`.

### Board

- `BoardInputPanel` gains `showExpr` and `undoDisabledExpr`; defaults are
  today's expressions, so game pages pass nothing.
- `ExercisePanelShell` renders `BoardInputPanel showExpr="true"
undoDisabledExpr="!activeDartEngine()?.facts().turns.length"`.
- `ExerciseBoardInputPanel.astro` is deleted. Exercises gain `input-well`,
  `InputButton` undo / Bounce out, `board-dim` and the pointer ring.

## 3. Warm-Up spotlight

`WarmUpPanel.astro` becomes a single board view (no gate, no big clock):

- `input-well` container filling the column under the header; board
  `h-full max-w-full aspect-square`, as in `BoardInputPanel`.
- Inside `DartBoard`, via new prop `dimPathExpr`: an even-odd path (board
  circle + section outline) filled black at 60%, drawn under the existing
  `highlightPathExpr` outline. The outline gains an accent `drop-shadow`.
- Around the board, new `SectionRing.astro` (`components/ui/`): an overlay
  SVG, `viewBox -240 -240 480 480`, with the board inset 220/240 inside it.
  One arc per section, split by duration with a 2.5° gap each side: track
  black/50%, fill accent growing with elapsed time.
  Props: `trackExpr`, `fillExpr`. Generic (any timed sectioned step).
- Elapsed time: header pill (§1).

Pure functions, in `lib/game/board/board-highlight.module.ts`:

- `dartboardDimPath(targets)` → board circle + `dartboardHighlightPath`
  outline, for `fill-rule="evenodd"`.
- `sectionRingPaths(durationsSeconds, elapsedSeconds, radiusMm)` →
  `{ track, fill }`; arcs start at 12 o'clock, clockwise.

`routine-play.data.ts` gains `warmUpDimPath()` and `warmUpRingPaths()`, fed
by `resolveWarmUpPhaseDurations` and `warmUpElapsedSeconds`.

## Verification

- TDD (`app/CLAUDE.md` §Test-Driven Development):
  - `dartboardDimPath`, `sectionRingPaths` (gaps, partial fill, complete);
  - `exercisePreviewSegments` per exercise family (hit / miss / value /
    upcoming-target labels, Bull Up single column);
  - `previewColumnState` with `"value"` and labels;
  - `trainingSession` store: `stepNumber` / `stepCount`; `headerLabel`
    tests deleted with the getter (its guarantee — header shows the step —
    re-pointed at the new title/subtitle);
  - routine play: `beginRoutine` does not call `startTrainingStep` until
    `confirmRoutineReady()`; confirm unlocks audio first; Warm-Up opens and
    starts its timer with no second gate;
  - adapter tests: `title` present.
- Game parity (D445 method): `npm run build` before and after; `diff` every
  game `dist/**/play/index.html`. Pass = byte-identical. Output quoted in
  the PR.
- Visual check at 390×844 for one target exercise, one free-aim exercise,
  Bull Up, Warm-Up and the gate, against the design.
- Gates: `validate-app`, `astro check`, `run-all-gates`.

## Docs

- `docs/architecture/07-Frontend/08-Component-Inventory.md`: add
  `HeaderClockPill`, `RoutineReadyGate`, `SectionRing`; update
  `BoardInputPanel`, `VisitPreview`, `PlayStatTile`, `RouteChips`,
  `DartBoard` (`highlightPathExpr`, `dimPathExpr`), `ExercisePanelShell`,
  `WarmUpPanel`; remove `ExerciseBoardInputPanel`.
- `docs/architecture/07-Frontend/07-Style-Guide.md`: play-header note
  (routine title / step subtitle / clock pill).
- `docs/architecture/09-Training/01-Routines.md`: routine-level ready gate
  replaces the Warm-Up gate.
- Decision entry in `decisions/frontend/` (gate moves to routine start;
  primitives extended, not copied).

## Amendments (from planning, 2026-10-13)

The plan `docs/superpowers/plans/2026-10-13-exercise-play-restyle.md`
refines this spec; where they differ, the plan wins:

- Header: the routine page's `x-data="routinePlay()"` moves onto
  `GameLayout` (D432), so the title / subtitle / clock are page methods
  (`headerTitle()`, `headerSubtitle()`, `headerClock()`, built by a pure
  `routineHeader()`), not new `trainingSession` store fields. The store only
  loses `headerLabel`. After the last step: routine name + `COMPLETE`.
- Visit labels need the step's configuration, so `openStep` keeps it as
  `stepConfiguration` on the play context.
- Bull Up's one preview slot names the next throw (`THROW n`); the last
  throw reads from the board markers and the Last tile.
- `VisitPreview` opts in with one `labelled` prop; `SlideToStart` gains
  `inline` (it is `fixed` today).

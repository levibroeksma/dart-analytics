# Play-screen shells: seated play screen + exercise panel shell (#915)

## Goal

Remove the copy-paste across game play interfaces
(`components/layout/games/interfaces/`) and training exercise panels
(`components/layout/training/exercises/`), so a layout tweak lands in one file
and a new game or exercise is data, not a ~100-line copy. No visible or
behavioural change: rendered markup stays identical.

Batch 2 of the fallow duplication review (batch 1, #914, is closed). Two tasks,
each on its own branch from `main`:

- **A** — `ExercisePanelShell` (smaller; proves the parity method).
- **B** — `SeatedPlayScreen`.

## Evidence

- 9 of 11 game interfaces (AroundTheClock, Bobs27, DoublesTraining, FiveOhOne,
  OneTwentyOne, ScoreTraining, Shanghai, SinglesTraining, TenUpOneDown) share
  one skeleton: wrapper `div.flex.flex-col.flex-1.min-h-0.gap-2` + rest props →
  `<template x-if>` solo `SinglePlayerDisplay` + `PlayStatTile`s →
  `<template x-if>` two-seat `SplitScoreboard` + compact tiles per seat →
  `ErrorAlert` → input stack → `BoardInputPanel` → optional
  `CountdownResumePrompt`.
- Every seat expression is a mechanical expansion of the solo one: solo
  `fn()` ↔ seat `fnFor(state()?.seats[i]?.participantRef)`. The tile list is
  written three times per game.
- Exceptions to the rule, which the design must carry verbatim:
  - ScoreTraining's solo big value is
    `$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0).toLocaleString('en-US')`;
    its seat value is `totalScoreFor(…).toLocaleString('en-US')`.
  - Shanghai's idle stat (Target) is not its first tile (Round). In the other
    8, idle stat = first tile.
  - AroundTheClock's "This visit" tile is wrapped in `<template x-if>`.
  - FiveOhOne has a sets-tally `<p>` between the solo and seated blocks, plus
    `legsExpr` / `legsToWinExpr`.
  - Bobs27 passes a single seat tile with `slot="progressA"` directly instead
    of a `Fragment`; the rendered output is the same.
- Cricket and Tactics are solo-only with `MarkRows`: out of scope.
- 9 exercise panels (BullUp, BullseyeCheckout, CheckoutSequence, DoublePattern,
  RandomCheckout, ScoreThreshold, Switching, SwitchingTargetScoring,
  TargetScoring) share: wrapper `div.flex.flex-col.flex-1.min-h-0.gap-3.p-3` →
  `SinglePlayerDisplay isTarget={false}` → `progress` slot `div` → `dl` of
  `StatRow`s (some wrapped in `div[x-show="… !== null"][x-cloak]`), always
  ending in `Time` / `formattedStepRemaining()` → `VisitPreview` →
  `ExerciseBoardInputPanel`. WarmUpPanel differs: out of scope.

## Design

### Task A — `ExercisePanelShell.astro` (`components/layout/training/exercises/`)

Props:

```ts
interface ExerciseRow {
  label: string;
  value: string;     // Alpine expr
  showWhen?: string; // Alpine expr; wraps the row in div[x-show][x-cloak]
}
interface Props {
  score: string;     // Alpine expr for the big value
  rows: ExerciseRow[];
}
```

Renders the shared markup above, appending the `Time` row itself. Each of the 9
panel files keeps its name and path (the routine play page's imports do not
change) and shrinks to its `score` and `rows`.

### Task B — `SeatedPlayScreen.astro` (`components/layout/games/`)

A pure TS module `playScreenExpr.ts` (beside it) holds the call helper and
types:

```ts
interface Call {
  (fn: string): string; // solo: `fn()`; seat i: `fnFor(state()?.seats[i]?.participantRef)`
  solo: boolean;        // escape hatch for a non-conforming expr
}
type Expr = (c: Call) => string;
interface Tile { label: string; value: Expr; showWhen?: Expr }

soloCall(): Call
seatCall(index: 0 | 1): Call
```

Props:

```ts
interface Props {
  big: { isTarget: boolean; value: Expr }; // solo target/score; seat scoreExpr
  tiles: Tile[];                            // solo tiles; compact tiles per seat
  idle?: Tile;                              // seat idle stat; default tiles[0]
  route?: Expr;                             // solo RouteChips; seat checkoutExpr
  legs?: { won: Expr; toWin: string };      // seat legsExpr; legsToWinExpr
  countdownDisabled?: string;               // set → CountdownResumePrompt
  [key: string]: unknown;                   // rest → wrapper div
}
```

Slots: `between` (between the solo and seated blocks — FiveOhOne's sets tally);
default (the game's input stack: `VisitPreview` + recreational input, or
`ScoreInput` with its game-specific disabled expressions).

The shell owns: wrapper div + rest props, both `x-if` templates, seat
`nameExpr` / `activeExpr`, `ErrorAlert`, `BoardInputPanel` and its comment,
the countdown prompt. Tiles with `showWhen` render inside
`<template x-if={showWhen(c)}>`. ScoreTraining uses `c.solo` to keep its solo
`turns.reduce` expression verbatim. Each interface file keeps its name and
path, so play pages do not change.

## Verification

- **Parity (both tasks):** a throwaway script (scratchpad, not committed)
  renders every touched panel/interface with the Astro container API on `main`
  and on the branch, normalizes whitespace, and diffs. Pass = identical. Output
  quoted in the PR. A committed render-snapshot test is a new test pattern and
  is not introduced here.
- **TDD:** `playScreenExpr.ts` unit tests (solo/seat expansion, `solo` flag).
- **Gates:** `validate-app` (fallow: dupes count before/after quoted),
  `astro check`, `run-all-gates`.

## Docs

- `docs/architecture/07-Frontend/08-Component-Inventory.md`: rows for both
  shells.
- `docs/architecture/07-Frontend/09-Adding-A-Game.md`: interface step points at
  `SeatedPlayScreen`.
- Decision entry in `decisions/frontend/astro.md`.

## Out of scope

Cricket, Tactics, WarmUpPanel, `BlockedStepModal`, batch 3 (#916).

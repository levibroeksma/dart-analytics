# Singles Training: Target-Labeled Buttons + Session Stat Rows

## Scope

Two UI refinements to the already-shipped Singles Training play page (`docs/superpowers/specs/2026-08-13-singles-training-frontend-design.md`), no engine/validator/capability changes:

1. `SinglesRecreationalInput.astro`'s tap row becomes a two-row grid, and the S/D/T buttons show the current target number in their label.
2. `SinglesTraining.astro`'s stat block gains four session-total counters: Misses, Singles, Doubles, Trebles.

## Button Layout

`SinglesRecreationalInput.astro`'s single divided row becomes two stacked rows, each 50% of the container's height, separated by a horizontal divider:

- **Row 1, non-bull visit:** three buttons, `S{target}` / `D{target}` / `T{target}` (e.g. `S1`/`D1`/`T1`, `S13`/`D13`/`T13`), divided by vertical dividers. The label is `'S' + currentTargetLabel()` etc. — safe to concatenate because this branch only ever renders when `!isBullVisit()`, so `currentTargetLabel()` is always a plain number string, never `"BULL"`.
- **Row 1, bull visit:** unchanged from today — `Bull` / `Bullseye`, two buttons, no third slot, no target-number suffix (there's no number to suffix).
- **Row 2, always:** `Undo` / `Miss`, two equal-width buttons.

Both rows keep every existing behavior: `:disabled="finished"` on action buttons, Undo's compound disabled condition (`!$store.game.turns.length || finished`), and the same `recordTap(ring)` calls (`Bull`→`SINGLE`, `Bullseye`→`DOUBLE`).

## Stat Rows

`SinglesTraining.astro`'s progress `<dl>` gains four `StatRow`s directly under the existing "Target" row, in this order: **Misses**, **Singles**, **Doubles**, **Trebles**. All four are session totals (not per-visit), each reading a new getter on the play data module.

Bull-visit darts count toward Singles/Doubles, matching how they already score: a `Bull` hit (`OUTER_BULL`) counts as a Single, a `Bullseye` hit (`INNER_BULL`) counts as a Double. Every thrown dart lands in exactly one of the four counters, so they always sum to the total darts thrown so far.

## Data Flow

`singles-training-play.data.ts` gains four new getters on `SinglesTrainingPlayContext`, each scanning `$store.game.turns` (all turns, all darts — session-wide, matching every other display getter's live-read style) and classifying each dart's `hitZoneKey`:

- `missCount()` — `MISS`
- `singleCount()` — `SINGLE`, `INNER_SINGLE`, `OUTER_SINGLE`, `OUTER_BULL`
- `doubleCount()` — `DOUBLE`, `INNER_BULL`
- `trebleCount()` — `TREBLE`

These four zone-key groups are exhaustive over `DartZoneKey`, and each returns a stringified count (`String(n)`), matching `currentPoints()`'s existing return-type convention. The single/double zone-key groupings intentionally mirror `trainingPointsFor`'s existing classification (extended to fold in the bull's `OUTER_BULL`/`INNER_BULL` per the same scoring equivalence), rather than introducing a second, divergent categorization.

## Testing

- New getters follow this module's existing TDD convention: `app/tests/lib/game/singles-training-play.data.test.ts` gains a `describe("missCount / singleCount / doubleCount / trebleCount")` block covering a mix of hits (number-target singles/doubles/trebles, bull singles/doubles, misses) across multiple turns, confirming the four counts sum to total darts thrown.
- `.astro` markup (button grid, StatRow additions) is not unit-tested in this codebase (D101) — verified by `scripts/check-astro-conventions.sh` and a manual dev-server check.

## Out of Scope

- No change to `recordTap`'s ring vocabulary, `commitDart`, undo, completion, or any engine/validator/capability code.
- No change to the visit preview (`VisitPreview.astro`) or results modal.

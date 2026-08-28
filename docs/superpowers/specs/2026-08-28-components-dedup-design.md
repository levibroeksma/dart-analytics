# Dedupe recurring markup in `components/` — design

Status: approved · 2026-08-28

## Problem

`app/src/components/` has three per-ruleset families
(`layout/games/interfaces/`, `layout/games/result-modals/`,
`layout/games/setup/*SetupForm.astro`) that D215 deliberately kept as
one-file-per-game, deduping only the `.ts` logic behind them
(`createPresetSetupController`, `createThreeDartValidator`,
`play-lifecycle.ts`). The `.astro` markup layer was left untouched and is
marked "out of scope... not reusable" in `08-Component-Inventory.md`.

Within that boundary, three pieces of markup are byte-identical (or
near-identical, differing only in a spacing/size class) across many files:

- The `alert alert-error` block (`role="alert"`, `x-show="error"`,
  `x-text="error"`, `x-cloak`) appears **29 times**: 9× `result-modals/`, 9×
  `setup/*SetupForm.astro`, 9× `interfaces/`, plus `AppModeForm.astro` and
  `PlayerSettingsCard.astro`.
- All 9 `*SetupForm.astro` files repeat that same block verbatim, always
  wrapped in `SetupShell`, always bound to the same `error` expression.
- All 9 `result-modals/*Results.astro` files share identical outer chrome
  (overlay, glass card, `IsLoading`, failed-completion retry, play-again
  error, back/play-again buttons) — only the `<h2>` title logic and the
  `StatRow` list differ per game. This drift already produced a real bug:
  only `AroundTheClockResults.astro` passes `loadingExpr="playAgainLoading"`
  to its play-again `Button`; the other 8 don't, so their spinner never
  shows during a retry.

`interfaces/` is out of scope beyond its `ErrorAlert` swap: its
single/split-scoreboard branching differs per game in *which expressions*
are passed (`currentScore()` vs `currentTargetLabel()`), not in markup
shape — extracting further would invent a per-game config object rather
than record an existing shape, the trap D215 avoided for `play.data.ts`.

## Design

### 1. `ErrorAlert.astro` (new, `components/ui/`)

```ts
interface Props {
  class?: string;
  showExpr?: string; // default "error"
  textExpr?: string; // default "error"
}
```

Renders the `<p role="alert" x-show x-text x-cloak>` block. Base classes
(`alert alert-error rounded-md border border-error/40 px-4 py-3
text-error-foreground`) composed via `cn()` with the caller's spacing/size
override (`mt-2 text-sm` in setup/result-modals vs `mx-3 mt-2 text-xs` in
interfaces). `showExpr`/`textExpr` default to `"error"` rather than being
hardcoded, so a future legitimately-different expression doesn't require
forking the component.

Replaces all 29 raw blocks.

### 2. Fold the setup-form error alert into `SetupShell.astro`

Move `<ErrorAlert />` into `SetupShell` itself (after the slotted content).
Delete the block from all 9 `*SetupForm.astro` files — net removal, not
dedup-in-place.

### 3. `ResultsModalShell.astro` (new, `components/layout/games/`)

```ts
interface Props {
  titleExpr?: string;
}
```

Owns: fixed overlay + glass card, `IsLoading` block, failed-completion
`ErrorAlert` + retry `Button`, play-again `ErrorAlert`, and the
back/play-again `Button` row — with `loadingExpr="playAgainLoading"` built
into the shell, fixing the 8-file drift by construction. Exposes:

- a `title` slot — each game keeps its own `x-text` logic for the `<h2>`
  (AroundTheClock's tie/win-by-darts phrasing genuinely differs from the
  standard win/loss phrasing, so this stays per-game markup, not a prop)
- a default slot for the `<dl>` of `StatRow`s

Each `<Game>Results.astro` shrinks to an import plus a
`<ResultsModalShell>` wrapping its own title and stat rows.

## Migration

Mechanical, one game at a time, behavior-preserving (same pattern as
D215's extractions — existing tests should pass unmodified since D101
exempts `.astro` markup from unit tests). Order: `ErrorAlert` first
(unblocks the other two), then the `SetupShell` fold, then
`ResultsModalShell` per game (9 files). `08-Component-Inventory.md` gains
rows for `ErrorAlert` and `ResultsModalShell`; `SetupShell`'s row note
updates to mention it now owns the error slot.

## Testing

Per D101, no test file for either new `.astro` component.
`npm run validate:app` (astro check + full suite) after each family
confirms nothing broke.

## Findings

The `loadingExpr` drift on 8 of the 9 result modals is fixed as a direct
side effect of extraction #3, not filed separately in `FINDINGS.md` — it
is the change this refactor targets, not incidental discovery.

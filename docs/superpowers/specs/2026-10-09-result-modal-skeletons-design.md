# Result Modals — Cricket/Tactics + Shift-Free Skeletons

Date: 2026-10-09 · Branch: `feat/result-modal-skeletons`
Source design: claude.ai/design project `cdea52ee-…`, file `Result Modals.dc.html`
(each loaded modal paired with its skeleton).

## Intent

- Cricket and Tactics get real result modals (today: generic placeholder tiles,
  `dartsToClose` as one joined string).
- Every result modal (12 game modals + routine summary) shows a skeleton while
  saving, including a `SAVING…` status, and swaps to content with no layout
  shift — or as little as possible.
- Full design parity for all modals: layouts, labels, overlines, button text.

Success: on a phone viewport, the modal's height and every label's position are
identical between `saving` and `succeeded`; only values change.

## Approach — one DOM, values swap

Each value is rendered once, in its final font and line box. Until the data is
ready the box holds an inline pulse bar (`inline-block`, `height: 1lh`, fixed
width, `animate-pulse`) instead of text. Labels, grids, tile heights, title and
overline are static. No parallel loaded/skeleton blocks; the existing ones are
deleted (they are the cause of today's jump).

Ready condition: `completionStatus === 'succeeded'`. In `pending`, `saving`
and `failed` the bars show.

## Components

### `ResultValue.astro` (new, `components/layout/games/`)

Props: `valueExpr` (Alpine expr), `skeletonWidth` (Tailwind width class),
optional `readyExpr` (default `completionStatus === 'succeeded'`), `class`.
Renders a single `<span>` carrying the font classes; inside, `x-text` when
ready, else the pulse bar. Used for every dynamic value below.

### `ResultsModalShell.astro`

- Status row, fixed height, always present when not failed:
  `pending`/`saving` → pulsing `text-error` dot + `SAVING…`;
  `succeeded` → `text-success` dot + `SAVED`. `failed` → ErrorAlert + Retry
  (may shift; error path, accepted).
- `showSavedMessage` prop removed — the status row is mandatory (resolves the
  `TODO` in `AroundTheClockResults.astro`).
- Play-again button label: `Rematch`.

### `SinglePlayerSummary.astro`

Rebuilt on `ResultValue`. Layout per design:

- Hero block: `grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]`. Left: hero value
  (`font-display`, 52px; 40px when a row sets `heroSize: "sm"`) over its label.
  Right: side rows (20px `font-display`) with a left border.
- Tile grid below (optional): `grid-cols-{2|3|4}` from a `tileCols` prop;
  tiles are `StatTile` (18px value).
- Each row carries `skeletonWidth` (design widths: hero `w-30`/`w-28`, side
  `w-[72px]`/`w-[43px]`/`w-[29px]`/`w-6`, tile `w-6`/`w-[26px]`).
- Loading-only block deleted.

### `StatTile.astro`

Value via `ResultValue`; `skeletonWidth` prop replaces the "no valueExpr =
skeleton" convention.

### `TargetGrid.astro` (new, `components/layout/games/`)

"DARTS TO CLOSE" eyebrow + `grid-cols-{n}` of 56px inset tiles: value
(`font-mono` 17px, via `ResultValue`, `w-5` bar) over the target label.
Labels are static (known objectives), so the skeleton shows real labels.
Props: `labels` (static list), `valuesExpr` (array expr), `cols`.

### `ComparisonSummary.astro` (1v1)

Rebuilt on `ResultValue`: seat names (`w-12` bars), legs score (`w-26` bar),
row values (`w-[37px]`/`w-5`). `StatRowComparison` takes skeleton widths;
`StatRowComparisonSkeleton.astro` deleted.

### `RoutineSummaryModal.astro`

Own markup kept (no shell, per its doc comment). Values via `ResultValue`
(`w-5`/`w-[37px]`), status row identical to the shell's (extract a shared
`SaveStatus.astro` used by both).

## Per-modal content (design parity)

Overline / hero / side / tiles. Titles keep `resultsTitle()`.

| Modal | Overline | Hero | Side | Tiles (cols) |
| --- | --- | --- | --- | --- |
| 501 solo | 501 · Match summary | 3-dart average | Legs won, Checkout | Best leg, 60+, 100+, 140+ (2) |
| 121 | 121 · Summary | Average (sm) | Visits, Checkout | — |
| Around the Clock | Around the Clock · Summary | Turns | Accuracy, Darts thrown | timed: Laps, Reached (2) |
| Bob's 27 | Bob's 27 · Summary | Score | Darts, Accuracy, Highest target | — |
| Doubles training | Doubles training · Summary | Hits | Accuracy, Misses | On 1st, On 2nd, On 3rd (3) |
| Score training | Score training · Summary | Total (sm) | 3-dart avg, First 9 avg, Highest | 100+, 120+, 140+, 180s (4) |
| Shanghai | Shanghai · Summary | Score | Round, Accuracy | Trebles, Doubles, Singles (3) |
| Singles training | Singles training · Summary | Total points | Accuracy, Darts missed | Singles, Doubles, Trebles (3) |
| Ten Up One Down | Ten Up One Down · Summary | Target reached | Checkout | — |
| Cricket | Cricket · Solo summary | Darts used | Marks / round, Trebles | TargetGrid: 20…15, Bull (4) |
| Tactics | Tactics · Solo summary | Darts used | Marks / round, Bulls | TargetGrid: 20…15, Bull, Doubles, Triples (3) |
| 501 1v1 | 501 · Match summary | ComparisonSummary (names, legs, rows) | | |

Comparison (2-seat) views of other games keep their current rows, rebuilt on
`ResultValue`.

## Data

- `CricketSeatResult` / `TacticsSeatResult`:
  - `dartsToClose: (number | null)[]` — objective order; replaces joined string.
  - Cricket `trebles: number` — treble darts on 15–20, counted even after the
    target closed.
  - Tactics `bulls: number` — darts on outer or inner bull, counted even after
    close.
- Counts are derived from the dart facts during the fold (shared
  `marks-close.module.ts` seat state gains the tallies needed); never stored.
- No schema, migration or API change. Cricket/Tactics stay solo (multiplayer is
  V2+ in their rulesets), so no comparison view.

Persistence check (hard invariant): no new state is persisted; inputs remain
the existing `turns`/`darts` facts.

## Testing

- TDD (vitest, `app/tests/` mirror): `cricketSeatResult` / `tacticsSeatResult`
  produce the `dartsToClose` array, `trebles`, `bulls`; fold tallies count
  post-close hits.
- `.astro` markup: `astro check` + visual check in the dev server at phone
  width, comparing saving vs saved (D101 carve-out).
- `validate:app`, `run-all-gates`.

## Out of scope

- Cricket/Tactics multiplayer results.
- Building the results snapshot before the save completes.

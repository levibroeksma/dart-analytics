<!--
status: canonical
scope: shared Astro component inventory
read-when: before writing markup for any recurring UI shape
updated: 2026-10-23
-->

# Component Inventory

Every shared, reusable `.astro` component, one row each. `app/CLAUDE.md`
requires checking this list before hand-rolling markup for a recurring UI
shape; if nothing here fits, propose a new component rather than writing
inline markup.

Out of scope: per-game components (`interfaces/`, `result-modals/`,
`setup/*SetupForm.astro`), which are one-per-ruleset by design and are not
reusable.

Alpine-bound props take **expression strings**, not values — the component
renders them into `x-text` / `x-model` / `@click` and the expression is
evaluated in the page's own Alpine scope.

## `components/ui/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `Badge.astro` | Small inline status pill | `variant` (`accent`/`error`/`neutral`) |
| `BoardMagnifier.astro` | Zoomed board detail follows the pointer during visual capture; accent rim, `shadow-magnifier`, the read in a pill inside the circle (D432, 2026-10-08) | `zoom` |
| `CatalogCard.astro` | Catalog entry card on `.catalog-card`: `game` variant is a link wired to `cardThrow()` (dart slides in on hover/focus, throws on tap, then navigates; plain navigation under reduced motion); `exercise` variant is a static card with a config-well body. Slots `title`, `meter`, `caption`, `tags`, default (2026-10-19) | `variant` (`game` needs `href`; `exercise`) |
| `CardWrapper.astro` | Bordered card, optionally a link; `color` takes a tint preset (`sky`, `violet`, `rose`, `teal` — added 2026-09-22, `emerald`, `amber`, `orange`, `fuchsia`, `blue`) or any CSS color | `href`, `title`, `description`, `color`, `external` |
| `Chart.astro` | Line/bar/doughnut chart from a plain `ChartSpec`: glass container, canvas, legend for ≥ 2 series or doughnut slices, table view fallback; `flat` inside an existing glass card (2026-09-30, D374); `table={false}` hides the table view (2026-10-02, D385) | `specExpr`, `title`, `formatter`, `heightClass`, `flat`, `table`, `class` |
| `ConfirmDialog.astro` | Modal with a muted cancel and a raised confirm (`SheetActions`) and an optional `context` slot for an `InlayRow`; `confirmVariant` (`sheet-raised` default, `sheet-destructive`) restored for delete confirms (D477, 2026-10-21) | `title`, `titleId`, `description`, `onCancel`, `onConfirm`, `confirmVariant`, `loadingExpr`, `dismissible` |
| `DifficultyLegend.astro` | Key to the four `DifficultyMeter` levels, shown once per screen (2026-10-19) | none |
| `DifficultyMeter.astro` | Four-bar difficulty meter, `role="img"` with the level name; static `level` or Alpine `levelExpr`; renders nothing for null (2026-10-19) | `level`, `levelExpr` |
| `DartBoard.astro` | Dartboard SVG plus an overlay slot for markers | `boardRef`, `class`, `highlightPathExpr` (outline in `highlight-glow`), `dimPathExpr` (even-odd mask dimming the board outside the highlight; Warm-Up, 2026-10-13) |
| `DeckPager.astro` | Compact `‹ n / N ›` pill (`bg-foreground/12`) of two ghost `IconBtn` chevrons around a polite live position label, optionally prefixed by a screen-reader-only `labelExpr` so the announcement names the item (2026-10-10) | `positionExpr`, `prevExpr`, `nextExpr` (Alpine statements), `prevLabel`, `nextLabel`, `labelExpr` (optional), `class` |
| `ExpandingModal.astro` | Corner 44px `sheet-raised` toggle that opens a `Modal` bottom sheet (Escape or backdrop calls `onClose`). Caller owns the open flag (2026-09-21). `detached` hides the corner toggle so the caller opens it from its own control (2026-09-22). Sheet instead of in-place growth (D429, 2026-10-08) | `openExpr`, `onToggle`, `onClose`, `title`, `titleId`, `overline`, `toggleLabelClosed`, `toggleLabelOpen`, `detached` |
| `ErrorAlert.astro` | Alert-styled error message; `alwaysVisible` drops `x-show`/`x-cloak` for a caller whose ancestor already gates visibility | `class`, `showExpr`, `textExpr`, `alwaysVisible` |
| `GrowingCard.astro` | In-flow glass card that grows from wherever it sits into an overlay covering the viewport inset by 1rem, and shrinks back; its slot holds the card's height while open so the page does not shift. Owns its open flag via `growingCard()` (`open` and `collapse()` in scope for the slot); click, Enter or Space opens it and dispatches `expand`, clicks inside an open card never close it, Escape or a slot control calling `collapse()` closes it; scrolls inside while open. Contents reflow while it grows, unlike `ExpandingModal` (2026-10-05) | `class`; leftover attributes (e.g. `@expand`) forwarded to the root |
| `InfoSection.astro` | `glass-info` rules card: accent title only with right chevron when collapsed, tap folds the description open (`x-collapse`) and turns chevron down (D435, 2026-10-09; collapse restored D455, 2026-10-13); `open` is always expanded with no chevron (setups without settings) (D430, 2026-10-08) | `title`, `description`, `id`, `open` |
| `IsLoading.astro` | Loading skeleton / spinner panel | `title` |
| `Link.astro` | Anchor styled as text link or button | `href`, `variant` (`inline`/`primary`/`secondary`/`ghost`), `external`, `icon`, `ariaLabel` |
| `LogoutButton.astro` | Sign-out action wired to the auth flow; round 44px `glass-button` in the `/profile` header, spinner while signing out (restyled 2026-10-07) | none |
| `Modal.astro` | The one dialog shell: bottom `glass-sheet` over `bg-scrim` with grabber, centred header, `header`/default/`footer` slots; `ConfirmDialog` and every overlay build on it; `fixed inset-0` lives only here (D429, 2026-10-08) | `titleId`, `descriptionId`, `dismissible`, `onDismiss`, `overline` |
| `InlayRow.astro` | Inlay context row: dot-separated Alpine-expression parts left, optional value right; fills `ConfirmDialog`'s `context` slot and the blocked/open-routine sheets (D429, 2026-10-08); `rowExpr` renders a `SessionContextRow | null` from `$store.game.contextRow()`, dropping empty parts with their dot and hiding when empty (D440, 2026-10-10) | `parts`, `valueExpr`, `rowExpr` |
| `SectionRing.astro` | Sectioned progress ring around a square board: a track and an accent fill path in an overlay SVG; the slot (the board) sits inset 220/240 (`section-ring-inset`) so the ring clears the rim; paths come from `sectionRingPaths` (Warm-Up; `Exercise Play.dc.html` 2c, 2026-10-13) | `trackExpr`, `fillExpr` |
| `SheetActions.astro` | Sheet action row: muted `Button` left, raised right (`sheet-muted` / `sheet-raised` variants) (D429, 2026-10-08) | `class`; leftover attributes forwarded |
| `Pagination.astro` | Segmented pager in one glass pill: previous chevron, current page (`/ total` when `totalExpr` is given), next chevron; props are Alpine expressions (2026-10-04) | `pageExpr`, `totalExpr`, `hasPreviousExpr`, `hasNextExpr`, `onPrevious`, `onNext`, `disabledExpr`, `ariaLabel`, `class` |
| `StatsHeatmap.astro` | The `heatmap` statistics section: `DartBoard.astro`'s SVG plus a cell overlay, geometry and intensity read from a section view's `heatmapCells` getter — `$store.gameStats` on the Games tab, a GAME step's view on the Routines tab (2026-09-26; `cellsExpr` 2026-09-29, D372) | `cellsExpr`, `class` |
| `StatsDensityHeatmap.astro` | Density heatmap on the board: `DartBoard.astro`'s SVG under a `<canvas>` that `heatmapCanvas()` repaints whenever the `stampsExpr` stamps change — smooth blue→red blobs, not per-cell squares; Score Training's dedicated layout uses it (2026-10-02, D387) | `stampsExpr`, `class` |
| `Tag.astro` | Catalog tag pill coloured by axis (`tag-*` classes); static slot text, or `nameExpr`/`axisExpr`/`primaryExpr` inside an Alpine `x-for`; `overArt` for pills over artwork (2026-10-19) | `axis`, `primary`, `overArt`, `nameExpr`, `axisExpr`, `primaryExpr` |

## `components/forms/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AppModeForm.astro` | Analytics/recreational app-mode radio picker: shadowless `glass` card, Michroma title, `MODE` eyebrow over a `field-inset` two-pill segmented track, selected pill `accent-orb` (restyled 2026-10-07) | none (reads the settings store) |
| `Button.astro` | **The** standalone action element — never hand-roll a `<button>` | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`/`dashed`/`sheet-muted`/`sheet-raised`/`sheet-destructive`), `icon`, `disabled`, `ariaLabel`, `loadingExpr` (omitted: reads `loading` from the Alpine scope if defined; pass `"false"` when that scope's `loading` is unrelated), default slot (runtime label such as `x-text`; replaces `title`, D394) |
| `IconBtn.astro` | Icon-only button, always a perfect circle (`aspect-square` + `rounded-full`); no built-in padding, no text | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`/`dashed`/`glass`/`destructive`; `glass` = `glass-button`, `destructive` = `glass-destructive`, 2026-10-21), `disabled`, `ariaLabel` (required) |
| `HandednessForm.astro` | Left/right-handed radio picker: `field-inset` two-pill segmented track, selected pill `accent-orb` (restyled 2026-10-07) | none (reads the `boardInput` store) |
| `Input.astro` | Styled text/number/email input | `id`, `type`, `name`, `value`, `placeholder`, `error`, `required`, `disabled` |
| `PlayerSettingsCard.astro` | Shadowless `glass` card grouping the player-settings rows and the `HANDED` picker (restyled 2026-10-07) | none |
| `Select.astro` | Custom glass dropdown (no native `<select>`): full-width 48px glass bar showing the picked label, grows downward into an overlaying option panel on click; closes on pick, outside click, Escape; caller seeds the value (no placeholder) | `options` (`{value,label}[]`, `value` may be `null`, build-time) or `optionsExpr` (Alpine expression yielding them at runtime), `model` (writable Alpine expression in the caller's scope), `ariaLabel`, `class` (2026-09-24; `optionsExpr` 2026-09-25; nullable `value` 2026-10-03) |
| `Switch.astro` | Boolean switch (track + thumb), not a checkbox glyph; label left, `hint` as a muted line under it, switch right (D430, 2026-10-08) | `label`, `hint`, rest props forward onto the native `<input type="checkbox">` |
| `Stepper.astro` | Bounded vertical glass stepper (chevron up, mono value, chevron down); the value is a spinbutton, Arrow Up/Down step; `min`/`max` are live in the Alpine scope, so a parent may reassign `min` (501 cap floor) (D430, 2026-10-08; live bounds 2026-10-10) | `min`, `max`, `ariaLabel`, `x-model` |
| `RangeSlider.astro` | Bounded integer slider: value bubble over a capsule thumb, filled `inset-well` track, ticks, min/max labels; a transparent native range input supplies drag, keys and a11y; unusable models are normalised and written back (D430, 2026-10-08) | `min`, `max`, `label`, `ariaLabel`, `fallback`, `hint`, `x-model` |
| `SlideToStart.astro` | Fixed slide-to-submit above `BottomNav`: release past 85% or Enter/Space submits the enclosing form; a tap does nothing (D430, 2026-10-08) | `disabledExpr`, `failedExpr`, `label`, `inline` (in flow inside a card, not fixed; the routine ready gate, 2026-10-13 — only the positioning classes differ, the focus ring is shared) |
| `SettingRow.astro` | Mono eyebrow label over a `field-inset` field: view mode is a `Button` with value + pencil, edit mode an inset input with accent focus ring; `maxlength` caps the input and shows an `n / max` hint while editing (restyled 2026-10-07) | `id`, `label`, `valueExpr`, `modelExpr`, `saveExpr`, `emptyText`, `numeric`, `inputmode`, `required`, `maxlength`, `disabledExpr` |

## `components/layout/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BottomNav.astro` | The floating `glass-raised` pill five-tab main navigation (D416, D419) (Home, Games, Training, Stats, Profile), one `NavBtn` per `NAV_TABS` entry (2026-10-06) | none |
| `NavBtn.astro` | One bottom-nav tab: icon slot plus label; `aria-current="page"`, accent colour and `glass-tinted-raised` pill (D419, 2026-10-06) when `isNavActive()` matches the current path | `href`, `label`, `matchPrefix` (defaults to `href + "/"`, none for `/`), `class` |
| `PageHeader.astro` | Page header row: glass back link, centred title, optional trailing `actions` slot (40px/1fr/40px grid without it, three equal columns with it); extracted from `SetupShell` (D476, 2026-10-21) | `backHref`, `backLabel`, `title`, `class` |
| `GameLayout.astro` (`app/src/layouts/`) | Play-screen shell: 56px `glass` header pill (exit, display title, live subtitle, `header-end` slot) over the padded play column; leftover attributes (the page's play `x-data`, `@confirm-exit.window`) land on the header+main wrapper (D432, 2026-10-08) | `title`, `gameTitle`, `gameTitleExpr`, `gameSubtitleExpr`, `exitDescription`, slot `header-end` |

## `components/layout/games/` (shared across rulesets)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BoardInputPanel.astro` | Visual-board capture in an `input-well`: square board that dims while pressed (`board-dim`) under a 44px pointer ring, then an undo / Bounce out key row; shown instead of the keypad for `ANALYTICS` + `VISUAL_BOARD` (D432, 2026-10-08) During a Dartbot visit, `BotVisitStrip` tops the panel and `BotDartFlight` draws the dart over the board (D463, 2026-10-16). | `showExpr`, `undoDisabledExpr` (a routine exercise mounts it: always `VISUAL_BOARD`, no pause, unmounts itself when the step ends; 2026-10-13, D454); reads `boardInputData()` from the page scope |
| `CheckoutConfirm.astro` | Double-out confirm (Cancel / Confirm checkout); collects the checkout's darts-to-finish and darts-at-a-double as segmented pill tracks | none (reads `checkoutDartOptions()`, `dartsToFinish`, `dartsAtDouble` from the page scope) |
| `ComparisonSummary.astro` | 1v1 results-modal stat block: seat names (or, with `legsBars`, the legs score and one bar per leg to win) plus an inlay ledger of `StatRowComparison` rows, winner column tinted via `winnerExpr`, shown only for a 2-seat game; names, score and values pulse in place until saved (2026-08-30; ledger, D429, 2026-10-08; D437, 2026-10-09) | `statRows` (`{ label, key, fallback? }[]`), `winnerExpr`, `legsBars` |
| `ContinueSessionModal.astro` | Resume-or-discard prompt for an unfinished session | `gameTitle` |
| `CountdownPauseControl.astro` | Header countdown pill (`GameLayout` `header-end`): pause icon + clock label; stays visible but disabled while paused (`aria-label` "Timer paused"; resume is `CountdownResumePrompt`), hidden when finished or without a session. Defaults read `remainingLabel()`/`togglePause()`/`hasActiveSession`/`finished` and `$store.game.timerPaused` from the play scope, or from `scopeExpr`. Routine play (every step type) and Quick Subtract supply their own pause through `pausedExpr`/`showExpr`/`labelExpr`/`toggleExpr` (D432, 2026-10-08; D459, 2026-10-13; D483, 2026-10-23) | `disabledExpr`, `scopeExpr?`, `pausedExpr?`, `showExpr?`, `labelExpr?`, `toggleExpr?` |
| `CountdownResumePrompt.astro` | Round `glass-button` with an accent play icon, shown in place of the score/board input (or, on routine exercise steps, the panel) while paused; defaults to `$store.game.timerPaused` (#253; restyled D432, 2026-10-08; D483, 2026-10-23) | `disabledExpr`, `pausedExpr?`, `toggleExpr?` |
| `DoublesPathRecreationalInput.astro` | Doubles-path tap row in an `input-well`: undo, MISS, the target key (`target-key-ring`) (D432, 2026-10-08) | none |
| `RingKeyRow.astro` | Row 1 of the Cricket and Tactics recreational inputs: undo, then S/D/T ring keys (S clears D/T; the armed key `glass-blue`) (#848, 2026-10-09) | none (reads the play scope: `ring`, `finished`, `setRing`, `undoVisit`) |
| `CricketRecreationalInput.astro` | Cricket's DETAILED_DARTS input in an `input-well`: undo and S/D/T ring keys (S clears D/T; the armed key `glass-blue`), then the seven objectives and MISS on a four-column grid; Treble off on Bull; one tap records one dart (2026-10-06; D432, 2026-10-08) | none (reads the Cricket page scope: `ring`, `setRing`, `recordObjective`, `recordMiss`, `objectiveRowsFor(state()?.activeParticipantRef)`) |
| `TacticsRecreationalInput.astro` | Tactics' DETAILED_DARTS input in an `input-well`: undo and S/D/T ring keys, then `tapTargets()` and MISS — four columns on a single (20–15, Bull), seven once D/T adds 14…1; Treble off on Bull (2026-10-06; D432, 2026-10-08) | none (reads the Tactics page scope: `ring`, `setRing`, `recordTarget`, `recordMiss`, `tapTargets`) |
| `KillerRecreationalInput.astro` | Killer's DETAILED_DARTS input in an `input-well`: `RingKeyRow`, a 5-column 1-20 grid, then BULL and MISS; reuses the `marks-play.data.ts` taps (D503, 2026-10-28) | none |
| `ExitModal.astro` | Leave-session confirmation | `description` (defaults to the "recorded as abandoned" copy; override for a tool with nothing to persist, e.g. Trivia) (2026-09-09) |
| `GameCard.astro` | Linked card with title, caption and dart (used by `/training/schedules`; `/games` uses `CatalogCard`) | `href`, `title`, `caption`, `duration` (optional pill, e.g. "30 min") (2026-09-11; games index moved off 2026-10-07) |
| `InputButton.astro` | One play key: `inset-well`, `rounded-key`, mono 26px, `key-press` accent ring, 35% when disabled (D432, 2026-10-08) | `type`, `variant` (`well`/`muted`/`target`), `pressedExpr` (`glass-blue` + `aria-pressed` while true) |
| `LegBars.astro` | One seat's legs: a 4px pill per leg to win (accent once won), or a mono `won/target` counter above five legs (`legBarStates`, D432, 2026-10-08) | `wonExpr`, `toWinExpr` |
| `MarkRows.astro` | Cricket/Tactics mark rows (via `MarksPlayScreen`): label + three pips (`pip-on`), closed rows at 50%, a row both seats closed struck through across label and pips, `aria-label` per row (D432, 2026-10-24) | none (reads the `rowsExpr` accessor, `objectiveRowsFor(rowsRef)`) |
| `NoSessionPanel.astro` | Empty state when no session is active | `href` |
| `PlayStatTile.astro` | Inset play stat: value over a mono caps label in a 76px tile, or a 44px label/value row with `compact` (D432, 2026-10-08) | `label`, `valueExpr`, `compact`, `highlight` (lit value, `accent-bright`), `fit` (flexes to share its column, max 76px; 2026-10-13) |
| `ReconciliationBlocked.astro` | Blocked-upload explanation panel | none |
| `ResultsModalShell.astro` | Shared results-sheet chrome: `Modal` sheet, mandatory `SaveStatus` row (failed → error + Retry), play-again error, Back to games / Rematch buttons; named `title` slot plus a default slot for stat rows (D437, 2026-10-09) Rematch on two seats opens `StarterStep` first (`requestPlayAgain`, `playAgainStarterData()`; D464, 2026-10-16). | `overline` |
| `ResultValue.astro` | One results value in its final line box: the value once `readyExpr` holds, else a one-line pulse bar of `skeletonWidth`, so saving → saved never shifts layout (D437, 2026-10-09) | `valueExpr`, `skeletonWidth`, `readyExpr` (default `completionStatus === 'succeeded'`), `class` |
| `RouteChips.astro` | Checkout route as a 28px `inset-well` pill of mono parts split by dots; hidden while blank (D432, 2026-10-08) | `routeExpr`, `currentIndexExpr` (the part at that index lit, the rest dimmed; 2026-10-13, D457) |
| `ScoreInput.astro` | Numeric keypad in an `input-well`: entry row with a `sheet-raised` Submit, a hairline, a 3×4 key grid (D432, 2026-10-08) | same props as today |
| `SinglePlayerDisplay.astro` | Solo play scoreboard: `glass` card in the 40% band; big value sized by `bigValueSize`, optional caption and route chips on the left, stat tiles or mark rows on the right (D432, 2026-10-08) | `score`, `target`, `isTarget`, `caption`; slots `above`, `route`, default, `progress` |
| `SaveStatus.astro` | Fixed-height results save status: pulsing `SAVING…` until the save succeeds, then `SAVED`; hidden when failed (D437, 2026-10-09) | `statusExpr` (default `completionStatus`) |
| `SinglePlayerSummary.astro` | Solo results-modal stat block, one DOM: hero value beside bordered side stats, an optional `StatTile` grid, then the default slot; values pulse in place via `ResultValue`; shown only for a 1-seat game (2026-08-30; D437, 2026-10-09) | `statRows` (`{ label, key, skeletonWidth, fallback?, hero?, side? }[]`), `heroSize` (`lg`/`sm`), `tileCols` (2/3/4), `seatIndex` (default `0`); default slot |
| `SinglesRecreationalInput.astro` | Target-aware S/D/T or BULL/BULLSEYE row over undo + MISS, in an `input-well` (D432, 2026-10-08) | none |
| `SplitScoreboard.astro` | Two-seat scoreboard in the 40% band: the throwing seat's `glass-active-seat` card on top, the waiting seat's 64px row under it (D432, 2026-10-08) Seats keep their order (the starter on top); `seatMorph()` animates the switch (D463, 2026-10-16). | `seatA`, `seatB` (each `{ nameExpr, activeExpr, scoreExpr, idleStatExpr, legsExpr?, checkoutExpr? }`), `idleStatLabel`, `legsToWinExpr`, named slots `progressA`/`progressB` |
| `SplitScoreboardHalf.astro` | One seat in `SplitScoreboard`: the active card (name, `LegBars`, score by `seatValueSize`, `RouteChips`, compact stat rows) or the idle row (name, `LegBars`, muted score, one stat tile), swapped on `activeExpr` (D432, 2026-10-08) Now one card laying out panel and bar layers at once, cross-faded; name/score are `data-seat-twin`s glided by `seatMorph()`; score counts down via `scoreTween` (D463, 2026-10-16). | `nameExpr`, `activeExpr`, `scoreExpr`, `idleStatExpr`, `idleStatLabel`, `legsExpr`, `legsToWinExpr`, `checkoutExpr`; default slot = the active card's rows |
| `MarksPlayScreen.astro` | Marks-game play screen: `SeatedPlayScreen` plus `MarkRows` (`objectiveRowsFor(rowsRef)`), `VisitPreview` and the game's tap input in the default slot; Cricket and Tactics both render it (D487, 2026-10-24) | none |
| `SeatedPlayScreen.astro` | Play-screen shell for a game with solo and two-seat layouts: wrapper, solo `SinglePlayerDisplay`, two-seat `SplitScoreboard`, `ErrorAlert`, slotted input, `BoardInputPanel`, optional `CountdownResumePrompt`. Each value is an `Expr` from `play-screen-expr.ts`, written once and expanded to `fn()` solo and `fnFor(<seat ref>)` per seat (D453, 2026-10-13) Mounts `BotBoardPanel`, which stands in for the input stack while Dartbot throws off the visual board (D463, 2026-10-16). | `big` (`{ isTarget, value }`), `tiles` (`{ label, value, showWhen? }[]`, non-empty), `idle?` (default `tiles[0]`), `route?`, `legs?` (`{ won, toWin }`), `countdownDisabled?`, rest → wrapper; slots `between`, default (input stack) |
| `BotDartFlight.astro` | Dartbot's dart in flight over a `DartBoard` (slot): reticle on aim, dart flies in from below the board (`cqw` offsets), sticks with a ripple; reads `$data.botFlight` (D463, 2026-10-16) | none; mount in the board's slot |
| `BotVisitStrip.astro` | Three-slot strip during a Dartbot visit: `DART n` until landed, then the hit label over an accent bar; the dart in flight gets the ring (D463, 2026-10-16) | none; reads `$data.botFlight` |
| `BotBoardPanel.astro` | Board panel standing in for the input stack while Dartbot throws in a non-VISUAL_BOARD session; keeps the visit's landed darts (D463, 2026-10-16) | none |
| `StarterStep.astro` | Who-throws-first sheet (`Modal`): Bull-off \| Coin toss toggle (bull-off default, remembered), sides with `VS`, cropped-board bull-off (taps, Dartbot throw, distance rings) or 3D coin toss, `<name> throws first` (D464, 2026-10-16) | `showExpr`, `optionsExpr` (`starterStep` options) |
| `PlayStatTileList.astro` | One tile list expanded with a solo or seat `Call` into `PlayStatTile`s, `showWhen` → `<template x-if>`; used by `SeatedPlayScreen` and `ExercisePanelShell` (D453, 2026-10-13) | `tiles`, `call`, `compact?`, `fit?` (tiles flex to share the column; the exercise card), `highlightFirst?` (lights the first tile's value; the exercise card) — both default off |
| `StatTile.astro` | Inlay stat tile: value over mono eyebrow label; with `skeletonWidth` the value pulses until results are saved (2026-10-08; D437, 2026-10-09) | `labelExpr`, `valueExpr`, `skeletonWidth` |
| `StatRowComparison.astro` | 1v1 comparison row: label centered, one seat's value on each side, values pulse in place until saved (2026-08-28; D437, 2026-10-09) | `label`, `leftValue`, `rightValue` |
| `TargetGrid.astro` | Cricket/Tactics "Darts to close" grid, Baseball Darts "Runs per inning": one 56px `inset-well` tile per objective, the closing dart (`–` if never closed) over the static label (D437, 2026-10-09) | `labels`, `valuesExpr`, `cols` (3/4), `title` (default "Darts to close", 2026-10-18) |
| `VisitPreview.astro` | Three-dart `glass` strip for the open visit: HIT / MISS / DART n header over a 6px bar, the next dart ringed (`previewColumnState`); every game adopter builds its `previewSegments()` via the shared `playPreviewSegments()` (Pattern 19; restyled D432, 2026-10-08); the routine exercises build theirs with `exercise-preview.ts`'s `visitPreview()` / `bullUpPreview()` instead | `labelled` (exercise strip, 2026-10-13: one centred column per segment, any count; each dart's `label` replaces HIT / DART n, a `value` dart shows its label alone on an accent bar; built by `lib/training/routines/exercise-preview.ts`; default is the games' three-column strip) |

## `components/layout/games/setup/` (shared shells)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AddGuestButton.astro` | Dashed circle add-guest control; hides once `guests.length` hits 1 (1v1 cap) | none (reads `guests`/`showAddGuestModal` from the page scope) |
| `DurationField.astro` | Solo FORMAT toggle with ROUNDS/MINUTES slider, and the guest/bot ROUNDS slider, bound to `durationType`/`durationValue`; used by Score Training and TUOD (121 keeps its own: third TARGET format, text note for guest/bot) (#914, 2026-10-11) | `formatOptions`, `rounds`, `minutes`, `soloHint` |
| `GameSetupPage.astro` | Page shell for every game setup route: `AppLayout`, the page's `x-data` (rest attribute), continue-session modal, reconciliation-failed alert + Retry, slotted `*SetupForm` (#914, 2026-10-11) | `title`, `x-data` (rest) |
| `GuestNameModal.astro` | Name-entry modal for a new guest | none (reads `newGuestName`/`showAddGuestModal`, calls `addGuest()` on the page scope) |
| `GuestSection.astro` | Runtime guest list (avatar + remove badge per guest) plus `AddGuestButton`; `UserSection` renders `GuestNameModal`/`OpponentChooserModal` after its `glass` card so the sheets are not trapped by its backdrop filter (D430, 2026-10-08) | none (reads `guests`, calls `removeGuest(i)` on the page scope) |
| `OpponentChooserModal.astro` | Guest/DartBot opponent chooser in a `Modal` sheet: two inlay rows, then — for DartBot — a level step (shared `RangeSlider` 1–15 bound to `pendingBotLevel`, two `StatTile`s for the simulated average/checkout range from `allLevelSelectStats()`, Back/Add DartBot); `addBot()` seats at that level (restyled to the design, D429, 2026-10-08) | none (reads `showOpponentChooser`/`showBotLevelPicker`/`pendingBotLevel` from the page scope) |
| `SettingLabel.astro` | Mono caps label above one setup control, optional `setting-badge` chip (e.g. `ANALYTICS`) (D430, 2026-10-08) | `text`, `badge` |
| `SettingSectionShell.astro` | `glass` settings card with a Michroma title wrapping a setup form's controls (D430, 2026-10-08) | none |
| `SetupShell.astro` | Page shell for every game setup screen: `PageHeader` (glass back link + centred Michroma title, D476, 2026-10-21), owns the form's error alert; start is `SlideToStart` (D430, 2026-10-08) Submit runs `beginStart()`: with an opponent it opens `StarterStep` first (D464, 2026-10-16). Optional `startBlockedExpr` (default `"false"`) is OR'd into the slide's `disabledExpr` and the submit guard (Killer, D503, 2026-10-28). | `title`, `startBlockedExpr` |
| `Toggle.astro` | Segmented option control bound via `x-modelable`: `inset-well` track, `glass-blue` pill; `options[].disabled` renders dimmed, unclickable, `aria-disabled` (D430, 2026-10-08) | `options`, `orientation` (`horizontal`/`vertical`), `initial`, `hint` |
| `ToggleListItem.astro` | One option inside a `Toggle` | `value`, `label`, `disabled`, `tall` |
| `UserIconDisplay.astro` | `glass-blue` initials avatar (`$initials`) with the name under it (D430, 2026-10-08) | `name`, `nameExpr`, `initialsExpr` |
| `UserSection.astro` | `glass` Players card with a mono seat count (`$playerCount`) and initials avatars; the guest/opponent sheets render after the card (D430, 2026-10-08) | `allowGuests` (renders `GuestSection` beside the owner icon), `allowDartbot` |

## `components/layout/training/routines/`

D308 split the flat `components/layout/training/` directory into three
children (`routines/`, `exercises/`, `trivia/`); this inventory now follows
that split (2026-09-19, closes issue #423).

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `RoutineFormModal.astro` | `RoutineBuilder` inside `ExpandingModal`; mounts `routineBuilder(mode)` *around* the modal so every close path (Cancel, toggle, Escape) reaches `resetForm()` and discards the draft instead of navigating. `edit` reads its routine id from `?routine=` exactly as the page does (2026-09-21) | `mode` (`create`/`edit`), `openExpr`, `titleId`, `detached` (hide the corner toggle; `/training` opens it from the personal-routines plus button, 2026-10-07) |
| `RoutineDetail.astro` | Routine-detail shell for a data-driven routine: `PageHeader` with `canEdit()`-gated trash (`destructive`) and edit `IconBtn`s, composes `RoutineSummaryCard` + `RoutineStepList` + `Start` (wired to `routineDetail().start()`, navigates to the play route), destructive `ConfirmDialog` for delete (redesign, 2026-10-21) | none — reads `routineDetail()` from the parent scope (`routine-detail.data.ts`) (2026-09-11; rewritten data-driven, Edit/Delete added, 2026-09-19) |
| `RoutineSummaryCard.astro` | Routine-detail summary `glass` card: eyebrow, name, accent `Badge` duration, description, step timeline weighted by `stepWeight` with `stepTone` fills, `N steps / 0:00 → M:00` footer via `totalMinutes`; no tag chips (2026-10-21) | none — reads `routineDetail()` from the parent scope |
| `RoutineStepList.astro` | Routine-detail step list: `.section-eyebrow` STEPS label, `glass` card of rows — tone ring via `stepTone`, name, `stepDuration`, description, one `chip` tag via `stepTag` (`step-tag-set.ts`); does not use `stepWeight` (2026-10-21) | none — reads `routineDetail()` from the parent scope |
| `RoutineRow.astro` | One routine row in a `/training` routine card (replaces `RoutineCard`, 2026-10-07): Michroma name linking to the detail route, `chip` minutes, 40px `glass-button` play link; top divider on all but the first row (2026-10-07) | none — reads `routine`/`index` from the enclosing `x-for` and `trainingIndex()`'s `detailHref`/`durationLabel`/`playHref` |
| `RoutineBuilder.astro` | Builder body for create and edit: name/description inputs, the ordered step list, `ExercisePicker`, duration total, and Cancel/Save | `onCancel` (Alpine expression; defaults to the page flow's `cancel()`, which navigates — a modal host passes a reset-and-close expression instead) — otherwise reads `routineBuilder(mode)` from the host's `x-data` (`routine-builder.data.ts`) (2026-09-19; `onCancel` 2026-09-21) |
| `RoutineStepRow.astro` | One builder step as a 56px raised `glass-button` card: six-dot grip button (`x-sort:handle`, focusable, ArrowUp/ArrowDown reorder), Michroma exercise name, a minutes pill (`inset-well`, bound `:min`/`:max`) and remove (2026-10-09). Reorder is drag or keyboard — the move-up/move-down buttons are gone, freeing their width for the name (D351, supersedes D337; keyboard path D380) | reads `step`/`index` from the enclosing `x-for` plus the builder's helpers (2026-09-19; drag grip 2026-09-21; keyboard reorder 2026-10-01) |
| `ExercisePicker.astro` | Exercise catalog as tappable tiles; tapping appends a step, disabled once the builder is at its step cap | none — reads `catalog`/`steps`/`maxSteps` from the parent scope (2026-09-19) |
| `RoutineSummaryModal.astro` | End-of-routine results overlay: one card per completed exercise (`stepSummaries`), total session time, `completeTraining` save status (`SaveStatus`, values pulse in place via `ResultValue`, D437) with Retry, and a `Done` button that resets the header store and leaves for `/training` | none — reads the play page's `x-data` scope (2026-09-14) |
| `RoutineReadyGate.astro` | The routine's one ready gate (2026-10-13, D454): glass card with an "Are you ready?" title and one row per step (number, title, `m:ss`), started by an inline `SlideToStart`; the slide unlocks audio for the whole routine | none (reads `readyGateView()`, `confirmRoutineReady()`, `confirmingReady` from the routine play scope) |
| `RoutineCompletionStates.astro` | A routine game step's completion states inside the panel's `x-data="game"` scope: optional `showFinishConfirm` dialog (`routine-finish-confirm-title`, `stepContextRow()` inlay), failed-upload `ErrorAlert` with Retry, and the saving line (2026-10-21) | `description?` (finish-confirm text; omit for no confirm), `savingText` |

## `components/layout/training/exercises/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BlockedStepModal.astro` | Resolution overlay when an unfinished Ten Up One Down game blocks the routine's Finishing step: names that game and its start date, `Abandon & continue` (`resolveBlockingSession()`) or `Leave routine` (`abandonAndExit()`) | none — reads the play page's `x-data` scope (2026-09-16) |
| `OpenRoutineModal.astro` | Resolution overlay when the player starts a routine while another is open: names the open routine and its start date, `Resume` (`resumeOpenRoutine()`), `Abandon & start new` (`abandonOpenRoutine()`) or `Leave` to `/training` | none — reads the play page's `x-data` scope (2026-09-30) |
| `ExercisePanelShell.astro` | Shared scored-exercise play surface (#915; restyled to `Exercise Play.dc.html`, 2026-10-13): `SinglePlayerDisplay` with the step's big value and a mono caption, an optional `RouteChips` chip, its tiles through `PlayStatTileList` (`soloCall()`, `fit`, `highlightFirst`), the `labelled` `VisitPreview` and the shared `BoardInputPanel`. No `Time` row — the clock is the header pill | `score`, `caption`, `chip?` (`{ routeExpr, currentIndexExpr? }`), `tiles` (`{ label, value, showWhen? }[]` of Alpine strings, mapped to solo `Tile`s; `showWhen` → `<template x-if>`) |
| `WarmUpPanel.astro` | Warm-Up play surface (2026-10-13): a spotlight board in an `input-well` — `SectionRing` of the phases, `DartBoard` with `dimPathExpr` / `highlightPathExpr` on the current section; no ready gate of its own (the routine gate precedes it, D454) | none (reads `warmUpRingTrack()`, `warmUpRingFill()`, `warmUpDimPath()`, `warmUpHighlightPath()` from the page scope) |
| `SwitchingPanel.astro` | Switching play surface, restyled 2026-10-13: `switchingPoints()` POINTS with the `switchingSequence()` chip (current target lit) and Target / Darts tiles — a call to `ExercisePanelShell` | none (reads the Switching page scope) |
| `SwitchingChainPanel.astro` | Switching Chain play surface (2026-10-20): `switchingChainChain()` CHAIN with the `switchingChainSequence()` chip (current target lit) and Target / To beat (only once a miss has ended a chain) / Best tiles — a call to `ExercisePanelShell` | none (reads the routine play page scope) |
| `DoublePatternPanel.astro` | Double Pattern play surface, restyled 2026-10-13: `doublePatternPoints()` POINTS with the `doublePatternSequence()` chip (current double lit) and Double / Darts tiles — a call to `ExercisePanelShell` | none (reads the Double Pattern page scope) |
| `BullUpPanel.astro` | Bull Up Practice play surface, restyled 2026-10-13: `bullUpBullseyes()` BULLSEYES with a BULL / EYE rate chip and Last / Throws / Bulls tiles; the one-slot preview names the next throw — a call to `ExercisePanelShell` | none (reads the Bull Up page scope) |
| `CheckoutSequencePanel.astro` | Catch 40 play surface (2026-10-06), restyled 2026-10-13: `checkoutSequencePoints()` POINTS with a LAST result chip and Outshot / Left / Dart / Checkouts tiles — a call to `ExercisePanelShell` | none (reads the routine play page scope) |
| `RandomCheckoutPanel.astro` | Random Checkout play surface (2026-10-07), restyled 2026-10-13: `randomCheckoutCheckouts()` CHECKOUTS with a LAST result chip and Start / Left / Dart / Rate tiles — a call to `ExercisePanelShell` | none (reads the routine play page scope) |
| `HitCountPanel.astro` | Hit Count play surface (2026-10-17): `hitCountHits()` HITS with Target / Left / Pass / Rate tiles — a call to `ExercisePanelShell` | none (reads the routine play page scope) |
| `SwitchbladePanel.astro` | SwitchBlade play surface (2026-10-18): `switchbladeTotal()` TOTAL with Target / Round / Pass tiles — a call to `ExercisePanelShell` | none (reads the routine play page scope) |
| `DoublesLockPanel.astro` | Doubles Lock play surface (2026-10-18): `doublesLockBonus()` BONUS with Target / Lock / Pass / Best tiles — a call to `ExercisePanelShell` | none (reads the routine play page scope) |
| `HalveItPanel.astro` | Halve-It play surface (2026-10-21): `halveItTotal()` TOTAL, a route chip of the nine rounds, Round / Pass / Rate tiles — a call to `ExercisePanelShell` | none (reads the routine play page scope) |
| `SnakesLaddersPanel.astro` | Doubles Snakes & Ladders play surface (2026-10-22): `snakesLaddersLevel()` LEVEL, a route chip of the ladder, Highest / Rounds / Rate tiles — a call to `ExercisePanelShell` | none (reads the routine play page scope) |
| `BullseyeCheckoutPanel.astro` | Bullseye Checkouts play surface, restyled 2026-10-13: `bullseyeCheckoutCheckouts()` CHECKOUTS with a LAST result chip and Left / Visits / Rate tiles — a call to `ExercisePanelShell` | none (reads the Bullseye Checkout page scope) |
| `ScoreThresholdPanel.astro` | Score Threshold (65 or More) play surface, restyled 2026-10-13: `scoreThresholdBeats()` BEATS with This visit / Last / Visits / Rate tiles (no chip) — a call to `ExercisePanelShell` | none (reads the Score Threshold page scope) |
| `TargetScoringPanel.astro` | Target Scoring play surface, restyled 2026-10-13: `targetScoringChain()` CHAIN with Target / To beat / Best tiles (no chip) — a call to `ExercisePanelShell` | none (reads the Target Scoring page scope) |

## `components/layout/training/trivia/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `QuickSubtract.astro` | Quick Subtract's whole play surface: idle setup (Fixed Count/Timer toggle, count/minutes input), running state (score display, correct/incorrect `PlayStatTileList` tiles, `ScoreInput` keypad), and a finished overlay with session stats and Play again/Back to Trivia | none — reads the page's `x-data` scope (`status`, `correctAnswers`, `incorrectAnswers`, `attempts`, `startCount()`/`startTimer()`/`submit()`/`exit()`/`reset()`) (2026-10-24); `StatRow.astro` row removed with its last consumer (2026-10-24) |

## `components/layout/training/schedules/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `ScheduleEditor.astro` | Editor body for create/edit: name `Input`, seven `ScheduleDayRow`s, server-issue list, Cancel/Save | none — reads `scheduleEditor(mode)` from the page's `x-data` (2026-09-20) |
| `ScheduleDayRow.astro` | One weekday row: label plus a routine picker built on `Select.astro` (`optionsExpr="routineOptions()"`, a "Rest" option with `null` value) | reads `row`/`index` from the enclosing `x-for` plus `routineOptions()`/`weekdayLabel()` from `scheduleEditor()` (2026-09-20; moved onto `Select`, closes #593, 2026-10-03) |
| `TrainingScheduleCard.astro` | "My schedule" card in its own `trainingWeek()` scope, shared by `/` and `/training`: `N done · N missed · N to go` (or the intro copy without a schedule), the page's own round 44px `glass-button` in the `action` slot (`/training`: pencil opening `ScheduleFormModal`; `/`: play `Button`, `x-show="canStart()"`, `start()`), then `ScheduleStrip` (2026-10-07; shared with the homepage 2026-10-09) | `action` slot — the round button |
| `ScheduleStrip.astro` | Seven weekday circles styled by `trainingWeek().dayClass(index)`: done (accent fill, check), missed (dashed `missed` ring, cross), today (`home-day-today` glow), scheduled, rest; all seven pulse alike while `loading`; each with a `dayLabel` aria-label (2026-10-07; loading pulse 2026-10-09) | none — reads `trainingWeek()` from the parent scope |
| `ScheduleFormModal.astro` | `/training`'s "My schedule" editor in a `detached` `ExpandingModal`, opened from the schedule card's pencil button (2026-10-07). Seven day circles pick the day to edit; the routine list assigns or clears that day's routine; Save needs one mapped day and closes on success. Mounts `myScheduleForm()` around the modal so every close path reaches `resetForm()` (2026-09-22) | `openExpr`, `titleId` |

## `components/layout/home/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `HomeHero.astro` | Homepage hero stat: mono eyebrow, `font-display text-7xl` value, "<Up|Down> <delta> in the <window>" with the delta in accent; the line is `invisible` (keeps its space) until `data-shown` says there is a change to show (2026-10-07; data-driven 2026-10-25; 2026-10-25) | none — reads `homeSnapshot()` from the parent scope |
| `CareerTiles.astro` | Three-column grid of `glass` tiles: mono key, display value, muted hint; values from `GET /api/statistics/overview` via `homeSnapshot().init()`, dashes until loaded (2026-10-07; wired 2026-10-09) | none — reads `homeSnapshot()` from the parent scope |
| `DailyAverageCard.astro` | `glass` card of seven CSS bars sized by `bars[].height`, peak days in `bg-accent`, others `bg-accent/35`, `PEAK` value in the header; no Chart.js; hidden (`x-show`/`x-cloak`) until the stats load and have a measured day (2026-10-07; 2026-10-25) | none — reads `homeSnapshot()` from the parent scope |
| `LandingHeatmapCard.astro` | "Where you land" `glass` card around `StatsDensityHeatmap` fed `landing.stamps`, board in the `dartboard-accent` tone; hidden (`x-show`/`x-cloak`) until `landing.stamps` is non-empty (2026-10-07; 2026-10-25) | none — reads `homeSnapshot()` from the parent scope |

## `components/layout/sessions/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `ResumeSessionDeck.astro` | Homepage and `/games` deck of open games in its own `resumeDeck()` scope: nothing renders until the load settles (`x-if`, no skeleton, D455), then the newest non-routine session on a `CardStack` (persistent `deck-top-card`, gradient) with title, config-derived detail, big number, a `DeckPager` (two or more sessions, else the "started" age) and a `glass-button` `Button` to the game's setup route: "Resume game" with a play icon for the session this device holds, otherwise "Start over" with a "Progress is on another device" note, since setup abandons any other session (#897); swipe steps through the deck; hidden with no sessions or on a load error; reduced motion fades instead of sliding. Replaces `home/ResumeGameCard` (D442, 2026-10-10) and `games/ResumeSessionCard` (D456, 2026-10-13) Now renders up to three real cards from `deckSlots()` (fly-off, rise, return to the back slot; `CardStack` removed) (D463, 2026-10-16). | `class`; owns its `x-data` |

## `components/layout/profile/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `ProfileIdentity.astro` | `/profile` identity row in its own `profileSnapshot()` scope: 56px `accent-orb` avatar with initials and the name from `$store.profile`, fixture stats line (2026-10-07) | none |

## `components/layout/statistics/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `ReplayCard.astro` | Session replay card for any statistics page: a `GrowingCard` row with a play icon that grows into the session's replay (`SessionReplay.astro`), opening it on `$store.replay`; for use inside an Alpine `x-for` (2026-10-03, D401; grows in place 2026-10-05, D414) | `sessionIdExpr`, `titleExpr`, `captionExpr` |
| `SessionReplay.astro` | One session's replay read from `$store.replay`: header, result, score curve, board with the selected turn's darts, turns by stage, Load more; rendered inside an open `ReplayCard` (2026-10-05, D414) | — |
| `RoutineStepButton.astro` | One row of the Routines tab's step list: the step's label and its detail (session count, configured minutes, last run date), marked while it is the selected step; a click selects it. Renders inside an `x-for` whose item is `step`, for both the current steps and "Earlier versions" (2026-09-29, D372) | none — reads `step` from the enclosing `x-for` and `$store.routineStats` |

<!--
status: canonical
scope: shared Astro component inventory
read-when: before writing markup for any recurring UI shape
updated: 2026-10-08
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
| `CardWrapper.astro` | Bordered card, optionally a link; `color` takes a tint preset (`sky`, `violet`, `rose`, `teal` — added 2026-09-22, `emerald`, `amber`, `orange`, `fuchsia`, `blue`) or any CSS color | `href`, `title`, `description`, `color`, `external` |
| `Chart.astro` | Line/bar/doughnut chart from a plain `ChartSpec`: glass container, canvas, legend for ≥ 2 series or doughnut slices, table view fallback; `flat` inside an existing glass card (2026-09-30, D374); `table={false}` hides the table view (2026-10-02, D385) | `specExpr`, `title`, `formatter`, `heightClass`, `flat`, `table`, `class` |
| `ConfirmDialog.astro` | Modal with a muted cancel and a raised confirm (`SheetActions`) and an optional `context` slot for an `InlayRow`; no `confirmVariant` (D429, 2026-10-08) | `title`, `titleId`, `description`, `onCancel`, `onConfirm`, `loadingExpr`, `dismissible` |
| `DartBoard.astro` | Dartboard SVG plus an overlay slot for markers | `boardRef` |
| `ExpandingModal.astro` | Corner 44px `sheet-raised` toggle that opens a `Modal` bottom sheet (Escape or backdrop calls `onClose`). Caller owns the open flag (2026-09-21). `detached` hides the corner toggle so the caller opens it from its own control (2026-09-22). Sheet instead of in-place growth (D429, 2026-10-08) | `openExpr`, `onToggle`, `onClose`, `title`, `titleId`, `overline`, `toggleLabelClosed`, `toggleLabelOpen`, `detached` |
| `ErrorAlert.astro` | Alert-styled error message; `alwaysVisible` drops `x-show`/`x-cloak` for a caller whose ancestor already gates visibility | `class`, `showExpr`, `textExpr`, `alwaysVisible` |
| `GrowingCard.astro` | In-flow glass card that grows from wherever it sits into an overlay covering the viewport inset by 1rem, and shrinks back; its slot holds the card's height while open so the page does not shift. Owns its open flag via `growingCard()` (`open` and `collapse()` in scope for the slot); click, Enter or Space opens it and dispatches `expand`, clicks inside an open card never close it, Escape or a slot control calling `collapse()` closes it; scrolls inside while open. Contents reflow while it grows, unlike `ExpandingModal` (2026-10-05) | `class`; leftover attributes (e.g. `@expand`) forwarded to the root |
| `InfoSection.astro` | `glass-info` rules card: accent title only with right chevron when collapsed, tap reveals description and turns chevron down (D435, 2026-10-09); `open` is always expanded with no chevron (setups without settings) (D430, 2026-10-08) | `title`, `description`, `id`, `open` |
| `IsLoading.astro` | Loading skeleton / spinner panel | `title` |
| `Link.astro` | Anchor styled as text link or button | `href`, `variant` (`inline`/`primary`/`secondary`/`ghost`), `external`, `icon`, `ariaLabel` |
| `LogoutButton.astro` | Sign-out action wired to the auth flow; round 44px `glass-button` in the `/profile` header, spinner while signing out (restyled 2026-10-07) | none |
| `Modal.astro` | The one dialog shell: bottom `glass-sheet` over `bg-scrim` with grabber, centred header, `header`/default/`footer` slots; `ConfirmDialog` and every overlay build on it; `fixed inset-0` lives only here (D429, 2026-10-08) | `titleId`, `descriptionId`, `dismissible`, `onDismiss`, `overline` |
| `InlayRow.astro` | Inlay context row: dot-separated Alpine-expression parts left, optional value right; fills `ConfirmDialog`'s `context` slot and the blocked/open-routine sheets (D429, 2026-10-08) | `parts`, `valueExpr` |
| `SheetActions.astro` | Sheet action row: muted `Button` left, raised right (`sheet-muted` / `sheet-raised` variants) (D429, 2026-10-08) | `class`; leftover attributes forwarded |
| `Pagination.astro` | Segmented pager in one glass pill: previous chevron, current page (`/ total` when `totalExpr` is given), next chevron; props are Alpine expressions (2026-10-04) | `pageExpr`, `totalExpr`, `hasPreviousExpr`, `hasNextExpr`, `onPrevious`, `onNext`, `disabledExpr`, `ariaLabel`, `class` |
| `StatsHeatmap.astro` | The `heatmap` statistics section: `DartBoard.astro`'s SVG plus a cell overlay, geometry and intensity read from a section view's `heatmapCells` getter — `$store.gameStats` on the Games tab, a GAME step's view on the Routines tab (2026-09-26; `cellsExpr` 2026-09-29, D372) | `cellsExpr`, `class` |
| `StatsDensityHeatmap.astro` | Density heatmap on the board: `DartBoard.astro`'s SVG under a `<canvas>` that `heatmapCanvas()` repaints whenever the `stampsExpr` stamps change — smooth blue→red blobs, not per-cell squares; Score Training's dedicated layout uses it (2026-10-02, D387) | `stampsExpr`, `class` |

## `components/forms/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AppModeForm.astro` | Analytics/recreational app-mode radio picker: shadowless `glass` card, Michroma title, `MODE` eyebrow over a `field-inset` two-pill segmented track, selected pill `accent-orb` (restyled 2026-10-07) | none (reads the settings store) |
| `Button.astro` | **The** standalone action element — never hand-roll a `<button>` | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`/`dashed`/`sheet-muted`/`sheet-raised`), `icon`, `disabled`, `ariaLabel`, `loadingExpr` (omitted: reads `loading` from the Alpine scope if defined; pass `"false"` when that scope's `loading` is unrelated), default slot (runtime label such as `x-text`; replaces `title`, D394) |
| `IconBtn.astro` | Icon-only button, always a perfect circle (`aspect-square` + `rounded-full`); no built-in padding, no text | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`/`dashed`), `disabled`, `ariaLabel` (required) |
| `HandednessForm.astro` | Left/right-handed radio picker: `field-inset` two-pill segmented track, selected pill `accent-orb` (restyled 2026-10-07) | none (reads the `boardInput` store) |
| `Input.astro` | Styled text/number/email input | `id`, `type`, `name`, `value`, `placeholder`, `error`, `required`, `disabled` |
| `PlayerSettingsCard.astro` | Shadowless `glass` card grouping the player-settings rows and the `HANDED` picker (restyled 2026-10-07) | none |
| `Select.astro` | Custom glass dropdown (no native `<select>`): full-width 48px glass bar showing the picked label, grows downward into an overlaying option panel on click; closes on pick, outside click, Escape; caller seeds the value (no placeholder) | `options` (`{value,label}[]`, `value` may be `null`, build-time) or `optionsExpr` (Alpine expression yielding them at runtime), `model` (writable Alpine expression in the caller's scope), `ariaLabel`, `class` (2026-09-24; `optionsExpr` 2026-09-25; nullable `value` 2026-10-03) |
| `Switch.astro` | Boolean switch (track + thumb), not a checkbox glyph; label left, `hint` as a muted line under it, switch right (D430, 2026-10-08) | `label`, `hint`, rest props forward onto the native `<input type="checkbox">` |
| `Stepper.astro` | Bounded vertical glass stepper (chevron up, mono value, chevron down); the value is a spinbutton, Arrow Up/Down step (D430, 2026-10-08) | `min`, `max`, `ariaLabel`, `x-model` |
| `RangeSlider.astro` | Bounded integer slider: value bubble over a capsule thumb, filled `inset-well` track, ticks, min/max labels; a transparent native range input supplies drag, keys and a11y; unusable models are normalised and written back (D430, 2026-10-08) | `min`, `max`, `label`, `ariaLabel`, `fallback`, `hint`, `x-model` |
| `SlideToStart.astro` | Fixed slide-to-submit above `BottomNav`: release past 85% or Enter/Space submits the enclosing form; a tap does nothing (D430, 2026-10-08) | `disabledExpr`, `label` |
| `SettingRow.astro` | Mono eyebrow label over a `field-inset` field: view mode is a `Button` with value + pencil, edit mode an inset input with accent focus ring; `maxlength` caps the input and shows an `n / max` hint while editing (restyled 2026-10-07) | `id`, `label`, `valueExpr`, `modelExpr`, `saveExpr`, `emptyText`, `numeric`, `inputmode`, `required`, `maxlength`, `disabledExpr` |

## `components/layout/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BottomNav.astro` | The floating `glass-raised` pill five-tab main navigation (D416, D419) (Home, Games, Training, Stats, Profile), one `NavBtn` per `NAV_TABS` entry (2026-10-06) | none |
| `NavBtn.astro` | One bottom-nav tab: icon slot plus label; `aria-current="page"`, accent colour and `glass-tinted-raised` pill (D419, 2026-10-06) when `isNavActive()` matches the current path | `href`, `label`, `matchPrefix` (defaults to `href + "/"`, none for `/`), `class` |
| `GameLayout.astro` (`app/src/layouts/`) | Play-screen shell: 56px `glass` header pill (exit, display title, live subtitle, `header-end` slot) over the padded play column; leftover attributes (the page's play `x-data`, `@confirm-exit.window`) land on the header+main wrapper (D432, 2026-10-08) | `title`, `gameTitle`, `gameTitleExpr`, `gameSubtitleExpr`, `exitDescription`, slot `header-end` |

## `components/layout/games/` (shared across rulesets)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BoardInputPanel.astro` | Visual-board capture in an `input-well`: square board that dims while pressed (`board-dim`) under a 44px pointer ring, then an undo / Bounce out key row; shown instead of the keypad for `ANALYTICS` + `VISUAL_BOARD` (D432, 2026-10-08) | none (reads `boardInputData()` from the page scope) |
| `CheckoutConfirm.astro` | Double-out confirm (Cancel / Confirm checkout); collects the checkout's darts-to-finish and darts-at-a-double as segmented pill tracks | none (reads `checkoutDartOptions()`, `dartsToFinish`, `dartsAtDouble` from the page scope) |
| `ComparisonSummary.astro` | 1v1 results-modal stat block: seat names (or, with `legsBars`, the legs score and one bar per leg to win) plus an inlay ledger of `StatRowComparison` rows, winner column tinted via `winnerExpr`, shown only for a 2-seat `resultsSnapshot` (2026-08-30; ledger, D429, 2026-10-08) | `statRows` (`{ label, key, fallback? }[]`), `winnerExpr`, `legsBars` |
| `ContinueSessionModal.astro` | Resume-or-discard prompt for an unfinished session | `gameTitle` |
| `CountdownPauseControl.astro` | Header countdown pill (`GameLayout` `header-end`): pause icon + `remainingLabel()`; stays visible but disabled while paused (`aria-label` "Timer paused"; resume is `CountdownResumePrompt`), hidden when finished or without a session. Routine play renders its own above each game interface (its header has no play scope), beside the step's `subtitle()` eyebrow (D432, 2026-10-08) | `disabledExpr` (reads `remainingLabel()`/`togglePause()`/`hasActiveSession`/`finished` from the play scope) |
| `CountdownResumePrompt.astro` | Round `glass-button` with an accent play icon, shown in place of the score/board input while `$store.game.timerPaused` (#253; restyled D432, 2026-10-08) | `disabledExpr` (reads `togglePause()` from the page scope) |
| `DoublesPathRecreationalInput.astro` | Doubles-path tap row in an `input-well`: undo, MISS, the target key (`target-key-ring`) (D432, 2026-10-08) | none |
| `CricketRecreationalInput.astro` | Cricket's DETAILED_DARTS input in an `input-well`: undo and S/D/T ring keys (S clears D/T; the armed key `glass-blue`), then the seven objectives and MISS on a four-column grid; Treble off on Bull; one tap records one dart (2026-10-06; D432, 2026-10-08) | none (reads the Cricket page scope: `ring`, `setRing`, `recordObjective`, `recordMiss`, `objectiveRows`) |
| `TacticsRecreationalInput.astro` | Tactics' DETAILED_DARTS input in an `input-well`: undo and S/D/T ring keys, then `tapTargets()` and MISS — four columns on a single (20–15, Bull), seven once D/T adds 14…1; Treble off on Bull (2026-10-06; D432, 2026-10-08) | none (reads the Tactics page scope: `ring`, `setRing`, `recordTarget`, `recordMiss`, `tapTargets`) |
| `ExitModal.astro` | Leave-session confirmation | `description` (defaults to the "recorded as abandoned" copy; override for a tool with nothing to persist, e.g. Trivia) (2026-09-09) |
| `GameCard.astro` | Linked card with title, caption and dart (used by `/training/schedules`; `/games` moved to `GameRow`) | `href`, `title`, `caption`, `duration` (optional pill, e.g. "30 min") (2026-09-11; games index moved off 2026-10-07) |
| `GameRow.astro` | One row in a `/games` group card: Michroma title, muted caption, accent dart, linking to the setup route; the page's per-row wrapper owns `x-show` and the `isFirstVisible()` divider (2026-10-07) | `href`, `title`, `caption` |
| `ResumeSessionCard.astro` | `/games` in-progress `feature-card`: most recent active game's title (`activeSession`) and a `glass-button` Resume link to its setup route; static detail line until issue #815 (2026-10-07) | none — reads `gamesIndex()` from the parent scope |
| `InputButton.astro` | One play key: `inset-well`, `rounded-key`, mono 26px, `key-press` accent ring, 35% when disabled (D432, 2026-10-08) | `type`, `variant` (`well`/`muted`/`target`), `pressedExpr` (`glass-blue` + `aria-pressed` while true) |
| `LegBars.astro` | One seat's legs: a 4px pill per leg to win (accent once won), or a mono `won/target` counter above five legs (`legBarStates`, D432, 2026-10-08) | `wonExpr`, `toWinExpr` |
| `MarkRows.astro` | Cricket/Tactics mark rows: label + three pips (`pip-on`), closed rows at 50%, `aria-label` per row (D432, 2026-10-08) | none (reads `objectiveRows()`) |
| `NoSessionPanel.astro` | Empty state when no session is active | `href` |
| `PlayStatTile.astro` | Inset play stat: value over a mono caps label in a 76px tile, or a 44px label/value row with `compact` (D432, 2026-10-08) | `label`, `valueExpr`, `compact` |
| `ReconciliationBlocked.astro` | Blocked-upload explanation panel | none |
| `ResultsModalShell.astro` | Shared results-sheet chrome: `Modal` sheet, save-status region, play-again error, back/play-again buttons; named `title` slot plus a default slot for stat rows | `showSavedMessage`, `overline` |
| `RouteChips.astro` | Checkout route as a 28px `inset-well` pill of mono parts split by dots; hidden while blank (D432, 2026-10-08) | `routeExpr` |
| `ScoreInput.astro` | Numeric keypad in an `input-well`: entry row with a `sheet-raised` Submit, a hairline, a 3×4 key grid (D432, 2026-10-08) | same props as today |
| `SinglePlayerDisplay.astro` | Solo play scoreboard: `glass` card in the 40% band; big value sized by `bigValueSize`, optional caption and route chips on the left, stat tiles or mark rows on the right (D432, 2026-10-08) | `score`, `target`, `isTarget`, `caption`; slots `above`, `route`, default, `progress` |
| `SinglePlayerSummary.astro` | Solo results-modal stat block: an optional hero stat plus a two-column `StatTile` grid for the single seat, pulse tiles while loading, shown only for a 1-seat `resultsSnapshot` (2026-08-30) | `statRows` (`{ label, key, fallback?, hero? }[]`), `seatIndex` (default `0`) |
| `SinglesRecreationalInput.astro` | Target-aware S/D/T or BULL/BULLSEYE row over undo + MISS, in an `input-well` (D432, 2026-10-08) | none |
| `SplitScoreboard.astro` | Two-seat scoreboard in the 40% band: the throwing seat's `glass-active-seat` card on top, the waiting seat's 64px row under it (D432, 2026-10-08) | `seatA`, `seatB` (each `{ nameExpr, activeExpr, scoreExpr, idleStatExpr, legsExpr?, checkoutExpr? }`), `idleStatLabel`, `legsToWinExpr`, named slots `progressA`/`progressB` |
| `SplitScoreboardHalf.astro` | One seat in `SplitScoreboard`: the active card (name, `LegBars`, score by `seatValueSize`, `RouteChips`, compact stat rows) or the idle row (name, `LegBars`, muted score, one stat tile), swapped on `activeExpr` (D432, 2026-10-08) | `nameExpr`, `activeExpr`, `scoreExpr`, `idleStatExpr`, `idleStatLabel`, `legsExpr`, `legsToWinExpr`, `checkoutExpr`; default slot = the active card's rows |
| `StatRow.astro` | Label/value row inside a progress or results list | `label`, `value` |
| `StatTile.astro` | Inlay stat tile: value over mono eyebrow label, or a pulse placeholder without `valueExpr` (2026-10-08) | `labelExpr`, `valueExpr` |
| `StatRowComparison.astro` | 1v1 comparison row: label centered, one seat's value on each side (2026-08-28) | `label`, `leftValue`, `rightValue` |
| `StatRowComparisonSkeleton.astro` | Loading-state placeholder for a `StatRowComparison`: a pulsing value bar either side of the label, shown while a 1v1 results modal's `completionStatus` is `pending`/`saving` | `label` |
| `VisitPreview.astro` | Three-dart `glass` strip for the open visit: HIT / MISS / DART n header over a 6px bar, the next dart ringed (`previewColumnState`); every adopter builds its `previewSegments()` via the shared `playPreviewSegments()` (Pattern 19; restyled D432, 2026-10-08) | none |

## `components/layout/games/setup/` (shared shells)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AddGuestButton.astro` | Dashed circle add-guest control; hides once `guests.length` hits 1 (1v1 cap) | none (reads `guests`/`showAddGuestModal` from the page scope) |
| `GuestNameModal.astro` | Name-entry modal for a new guest | none (reads `newGuestName`/`showAddGuestModal`, calls `addGuest()` on the page scope) |
| `GuestSection.astro` | Runtime guest list (avatar + remove badge per guest) plus `AddGuestButton`; `UserSection` renders `GuestNameModal`/`OpponentChooserModal` after its `glass` card so the sheets are not trapped by its backdrop filter (D430, 2026-10-08) | none (reads `guests`, calls `removeGuest(i)` on the page scope) |
| `OpponentChooserModal.astro` | Guest/DartBot opponent chooser in a `Modal` sheet: two inlay rows, then — for DartBot — a level step (1–15 slider bound to `pendingBotLevel`, two `StatTile`s for the simulated average/checkout range from `allLevelSelectStats()`, a level pill on the thumb, Back/Add DartBot); `addBot()` seats at that level (restyled to the design, D429, 2026-10-08) | none (reads `showOpponentChooser`/`showBotLevelPicker`/`pendingBotLevel` from the page scope) |
| `SettingLabel.astro` | Mono caps label above one setup control, optional `setting-badge` chip (e.g. `ANALYTICS`) (D430, 2026-10-08) | `text`, `badge` |
| `SettingSectionShell.astro` | `glass` settings card with a Michroma title wrapping a setup form's controls (D430, 2026-10-08) | none |
| `SetupShell.astro` | Page shell for every game setup screen: glass back link + centred Michroma title, owns the form's error alert; start is `SlideToStart` (D430, 2026-10-08) | `title` |
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
| `RoutineDetail.astro` | Routine-detail shell for a data-driven routine: title + duration pill, ordered step list, `Start` (wired to `routineDetail().start()`, navigates to the play route), and — for the caller's own routine only (`canEdit()`) — `Edit`/`Delete`, the latter behind a `ConfirmDialog` | none — reads `routineDetail()` from the parent scope (`routine-detail.data.ts`) (2026-09-11; rewritten data-driven, Edit/Delete added, 2026-09-19) |
| `RoutineRow.astro` | One routine row in a `/training` routine card (replaces `RoutineCard`, 2026-10-07): Michroma name linking to the detail route, `chip` minutes, 40px `glass-button` play link; top divider on all but the first row (2026-10-07) | none — reads `routine`/`index` from the enclosing `x-for` and `trainingIndex()`'s `detailHref`/`durationLabel`/`playHref` |
| `RoutineBuilder.astro` | Builder body for create and edit: name/description inputs, the ordered step list, `ExercisePicker`, duration total, and Cancel/Save | `onCancel` (Alpine expression; defaults to the page flow's `cancel()`, which navigates — a modal host passes a reset-and-close expression instead) — otherwise reads `routineBuilder(mode)` from the host's `x-data` (`routine-builder.data.ts`) (2026-09-19; `onCancel` 2026-09-21) |
| `RoutineStepRow.astro` | One builder step: six-dot grip button (`x-sort:handle`, focusable, ArrowUp/ArrowDown reorder), exercise name, minutes input (bound `:min`/`:max`) and remove. Reorder is drag or keyboard — the move-up/move-down buttons are gone, freeing their width for the name (D351, supersedes D337; keyboard path D380) | reads `step`/`index` from the enclosing `x-for` plus the builder's helpers (2026-09-19; drag grip 2026-09-21; keyboard reorder 2026-10-01) |
| `ExercisePicker.astro` | Exercise catalog as tappable tiles; tapping appends a step, disabled once the builder is at its step cap | none — reads `catalog`/`steps`/`maxSteps` from the parent scope (2026-09-19) |
| `RoutineSummaryModal.astro` | End-of-routine results overlay: one card per completed exercise (`stepSummaries`), total session time, `completeTraining` save status with Retry, and a `Done` button that resets the header store and leaves for `/training` | none — reads the play page's `x-data` scope (2026-09-14) |

## `components/layout/training/exercises/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BlockedStepModal.astro` | Resolution overlay when an unfinished Ten Up One Down game blocks the routine's Finishing step: names that game and its start date, `Abandon & continue` (`resolveBlockingSession()`) or `Leave routine` (`abandonAndExit()`) | none — reads the play page's `x-data` scope (2026-09-16) |
| `OpenRoutineModal.astro` | Resolution overlay when the player starts a routine while another is open: names the open routine and its start date, `Resume` (`resumeOpenRoutine()`), `Abandon & start new` (`abandonOpenRoutine()`) or `Leave` to `/training` | none — reads the play page's `x-data` scope (2026-09-30) |
| `ExerciseBoardInputPanel.astro` | Visual-board capture surface plus undo/bounce-out row for a non-game exercise session (Switching, Double Pattern) — mirrors `BoardInputPanel.astro` minus the `$store.game` gate, since an exercise session has no game store, is always `VISUAL_BOARD`, and has no clock (2026-09-12) | none (reads `board`, pointer handlers, `recordUnseen`, `visitMarkers`, `finished`, `undoVisit()` from the page scope) |
| `WarmUpPanel.astro` | Warm-Up play surface: an "Are you ready?" gate (`confirmWarmUpReady()`), then the board with the current section's aim | none (reads `warmUpReady` from the page scope) |
| `SwitchingPanel.astro` | Switching play surface: `SinglePlayerDisplay` scored by `switchingPoints()`, `StatRow`s for the target and progress, `VisitPreview`, and `ExerciseBoardInputPanel` | none (reads the Switching page scope) |
| `DoublePatternPanel.astro` | Double Pattern play surface: `SinglePlayerDisplay` scored by `doublePatternPoints()`, `StatRow`s for the current double and progress, `VisitPreview`, and `ExerciseBoardInputPanel` | none (reads the Double Pattern page scope) |
| `BullUpPanel.astro` | Bull Up Practice play surface: `SinglePlayerDisplay` scored by `bullUpBullseyes()`, `StatRow`s for the last visit and progress, `VisitPreview`, and `ExerciseBoardInputPanel` | none (reads the Bull Up page scope) |
| `CheckoutSequencePanel.astro` | Catch 40 play surface: `SinglePlayerDisplay` scored by `checkoutSequencePoints()`, `StatRow`s for outshot, left, dart in attempt, last result, checkouts and time, `VisitPreview`, and `ExerciseBoardInputPanel` (2026-10-06) | none (reads the routine play page scope) |
| `RandomCheckoutPanel.astro` | Random Checkout play surface: `SinglePlayerDisplay` scored by `randomCheckoutCheckouts()`, `StatRow`s for start score, left, dart in attempt, last result, rate and time, `VisitPreview`, and `ExerciseBoardInputPanel` (2026-10-07) | none (reads the routine play page scope) |
| `BullseyeCheckoutPanel.astro` | Bullseye Checkouts play surface: `SinglePlayerDisplay` scored by `bullseyeCheckoutCheckouts()`, `StatRow`s for the score left and progress, `VisitPreview`, and `ExerciseBoardInputPanel` | none (reads the Bullseye Checkout page scope) |
| `ScoreThresholdPanel.astro` | Score Threshold (65 or More) play surface: `SinglePlayerDisplay` scored by `scoreThresholdBeats()`, `StatRow`s for the current visit and progress, `VisitPreview`, and `ExerciseBoardInputPanel` | none (reads the Score Threshold page scope) |
| `SwitchingTargetScoringPanel.astro` | Switching Target Scoring play surface: `SinglePlayerDisplay` scored by `switchingTargetScoringChain()`, `StatRow`s for the target and progress, `VisitPreview`, and `ExerciseBoardInputPanel` | none (reads the Switching Target Scoring page scope) |
| `TargetScoringPanel.astro` | Target Scoring play surface: `SinglePlayerDisplay` scored by `targetScoringChain()`, `StatRow`s for the target and progress, `VisitPreview`, and `ExerciseBoardInputPanel` | none (reads the Target Scoring page scope) |

## `components/layout/training/trivia/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `QuickSubtract.astro` | Quick Subtract's whole play surface: idle setup (Fixed Count/Timer toggle, count/minutes input), running state (score display, correct/incorrect `StatRow`s, `ScoreInput` keypad), and a finished overlay with session stats and Play again/Back to Trivia | none — reads the page's `x-data` scope (`status`, `correctAnswers`, `incorrectAnswers`, `attempts`, `startCount()`/`startTimer()`/`submit()`/`exit()`/`reset()`) (2026-09-19) |

## `components/layout/training/schedules/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `ScheduleEditor.astro` | Editor body for create/edit: name `Input`, seven `ScheduleDayRow`s, server-issue list, Cancel/Save | none — reads `scheduleEditor(mode)` from the page's `x-data` (2026-09-20) |
| `ScheduleDayRow.astro` | One weekday row: label plus a routine picker built on `Select.astro` (`optionsExpr="routineOptions()"`, a "Rest" option with `null` value) | reads `row`/`index` from the enclosing `x-for` plus `routineOptions()`/`weekdayLabel()` from `scheduleEditor()` (2026-09-20; moved onto `Select`, closes #593, 2026-10-03) |
| `TrainingScheduleCard.astro` | `/training` "My schedule" card in its own `trainingWeek()` scope: `N done · N missed · N to go` (or the intro copy without a schedule), a 44px pencil `glass-button` opening `ScheduleFormModal`, then `ScheduleStrip` (2026-10-07) | none |
| `ScheduleStrip.astro` | Seven weekday circles styled by `trainingWeek().dayClass(index)`: done (accent fill, check), missed (dashed `missed` ring, cross), today (`home-day-today` glow), scheduled, rest; each with a `dayLabel` aria-label (2026-10-07) | none — reads `trainingWeek()` from the parent scope |
| `ScheduleFormModal.astro` | `/training`'s "My schedule" editor in a `detached` `ExpandingModal`, opened from the schedule card's pencil button (2026-10-07). Seven day circles pick the day to edit; the routine list assigns or clears that day's routine; Save needs one mapped day and closes on success. Mounts `myScheduleForm()` around the modal so every close path reaches `resetForm()` (2026-09-22) | `openExpr`, `titleId` |

## `components/layout/home/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `HomeHero.astro` | Homepage hero stat: mono eyebrow, `font-display text-7xl` value, "Up <delta> in the <window>" with the delta in accent (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `ResumeGameCard.astro` | Accent-gradient (`home-feature-card`) card for the in-progress game: game, detail, remaining "TO GO", a `glass-button` Resume `Button` with `play-rounded` calling `resumeGame()`. Always shown in the static pass (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `CareerTiles.astro` | Three-column grid of `glass` tiles: mono key, display value, muted hint (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `DailyAverageCard.astro` | `glass` card of seven CSS bars sized by `bars[].height`, peak days in `bg-accent`, others `bg-accent/35`, `PEAK` value in the header; no Chart.js (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `LandingHeatmapCard.astro` | "Where you land" `glass` card around `StatsDensityHeatmap` fed `landing.stamps`, board in the `dartboard-accent` tone (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `WeekdayStrip.astro` | Row of seven day-initial circles inside `TodayRoutineCard`. Today `size-10.5` with the `home-day-today` accent glow ring; a day with a routine `border-foreground/50`; a rest day `border-border` muted. Letters from `weekdayNames()` (2026-09-22; restyled 2026-10-07) | none — reads `homeWeek()` from the parent scope |
| `TodayRoutineCard.astro` | Homepage "Weekly plan" card: while today's routine is not done, the routine name and minutes (or "Rest day") linking to `/training/schedules`, a round `glass-button` play `Button` (`start()`), then the default slot (`WeekdayStrip`). Once done, a `home-feature-card` "COMPLETED · You're on fire!" state. Nothing with no active schedule (2026-09-23; restyled 2026-10-07) | default slot (weekday strip) — reads `homeWeek()` from the parent scope |

## `components/layout/profile/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `ProfileIdentity.astro` | `/profile` identity row in its own `profileSnapshot()` scope: 56px `accent-orb` avatar with initials and the name from `$store.profile`, fixture stats line (2026-10-07) | none |

## `components/layout/statistics/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `GameSectionCards.astro` | A game's insight section cards, rendered against one section view (`game-stats.store.ts`'s getters over a `sections` record); each card shows once its section has loaded. The Games tab passes `$store.gameStats`, the Routines tab `$store.routineStats.stepGame`, so a GAME step shows the exact cards its game's own page does (2026-09-29, D372) | `view`, `heatmapTargets` (off by default; only the Games tab turns on the heatmap's target picker), `class` |
| `ReplayCard.astro` | Session replay card for any statistics page: a `GrowingCard` row with a play icon that grows into the session's replay (`SessionReplay.astro`), opening it on `$store.replay`; for use inside an Alpine `x-for` (2026-10-03, D401; grows in place 2026-10-05, D414) | `sessionIdExpr`, `titleExpr`, `captionExpr` |
| `SessionReplay.astro` | One session's replay read from `$store.replay`: header, result, score curve, board with the selected turn's darts, turns by stage, Load more; rendered inside an open `ReplayCard` (2026-10-05, D414) | — |
| `RoutineStepButton.astro` | One row of the Routines tab's step list: the step's label and its detail (session count, configured minutes, last run date), marked while it is the selected step; a click selects it. Renders inside an `x-for` whose item is `step`, for both the current steps and "Earlier versions" (2026-09-29, D372) | none — reads `step` from the enclosing `x-for` and `$store.routineStats` |

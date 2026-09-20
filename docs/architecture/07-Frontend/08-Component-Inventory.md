<!--
status: canonical
scope: shared Astro component inventory
read-when: before writing markup for any recurring UI shape
updated: 2026-09-20
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
| `BoardMagnifier.astro` | Zoomed board detail follows the pointer during visual capture | `zoom` |
| `CardWrapper.astro` | Bordered card, optionally a link | `href`, `title`, `description`, `color`, `external` |
| `ConfirmDialog.astro` | Modal with cancel/confirm actions | `title`, `titleId`, `description`, `onCancel`, `onConfirm`, `confirmVariant`, `loadingExpr`, `dismissible` |
| `DartBoard.astro` | Dartboard SVG plus an overlay slot for markers | `boardRef` |
| `ErrorAlert.astro` | Alert-styled error message; `alwaysVisible` drops `x-show`/`x-cloak` for a caller whose ancestor already gates visibility | `class`, `showExpr`, `textExpr`, `alwaysVisible` |
| `InfoSection.astro` | Titled explanatory block | `title`, `description`, `id` |
| `IsLoading.astro` | Loading skeleton / spinner panel | `title` |
| `Link.astro` | Anchor styled as text link or button | `href`, `variant` (`inline`/`primary`/`secondary`/`ghost`), `external`, `icon`, `ariaLabel` |
| `LogoutButton.astro` | Sign-out action wired to the auth flow | none |
| `Modal.astro` | Base dialog shell; `ConfirmDialog` builds on it | `titleId`, `descriptionId`, `dismissible`, `onDismiss` |
| `StatCard.astro` | Career-stat tile: static label plus an Alpine-bound value/hint; no width/loading opinion of its own (2026-09-08) | `label`, `valueExpr`, `hintExpr` |
| `StatCardSkeleton.astro` | Loading placeholder pairing with `StatCard` (2026-09-08) | `label` |

## `components/forms/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AppModeForm.astro` | Analytics/recreational app-mode radio picker | none (reads the settings store) |
| `Button.astro` | **The** standalone action element — never hand-roll a `<button>` | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`/`dashed`), `icon`, `disabled`, `ariaLabel`, `loadingExpr` |
| `IconBtn.astro` | Icon-only button, always a perfect circle (`aspect-square` + `rounded-full`); no built-in padding, no text | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`/`dashed`), `disabled`, `ariaLabel` (required) |
| `HandednessForm.astro` | Left/right-handed radio picker | none (reads the settings store) |
| `Input.astro` | Styled text/number/email input | `id`, `type`, `name`, `value`, `placeholder`, `error`, `required`, `disabled` |
| `PlayerSettingsCard.astro` | Bordered card grouping the player-settings rows | none |
| `Switch.astro` | Boolean switch (track + thumb), not a checkbox glyph | `label`, `hint`, rest props forward onto the native `<input type="checkbox">` |
| `SettingRow.astro` | Label plus inline-editable value with a save action | `id`, `label`, `valueExpr`, `modelExpr`, `saveExpr`, `emptyText`, `numeric`, `inputmode`, `required`, `disabledExpr` |

## `components/layout/games/` (shared across rulesets)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BoardInputPanel.astro` | Visual-board capture surface plus undo/bounce-out row; shown instead of the keypad for `ANALYTICS` + `VISUAL_BOARD` | none (reads `boardInputData()` from the page scope) |
| `CheckoutConfirm.astro` | Double-out confirm (Confirm / Cancel only); also collects the checkout's darts-to-finish and darts-at-a-double | none (reads `checkoutDartOptions()`, `dartsToFinish`, `dartsAtDouble` from the page scope) |
| `ComparisonSummary.astro` | 1v1 results-modal stat block: seat names header plus one `StatRowComparison` per row, shown only for a 2-seat `resultsSnapshot` (2026-08-30) | `statRows` (`{ label, key, fallback? }[]`) |
| `ContinueSessionModal.astro` | Resume-or-discard prompt for an unfinished session | `gameTitle` |
| `CountdownPauseControl.astro` | MINUTES-mode countdown label plus Pause/Resume toggle (2026-09-07) | `disabledExpr` (reads `remainingLabel()`/`togglePause()`/`$store.game.timerPaused` from the page scope) |
| `CountdownResumePrompt.astro` | Centered large resume button shown in place of the score/board input while `$store.game.timerPaused` is true, so a paused timer doesn't leave a disabled input on screen (#253, 2026-09-10) | `disabledExpr` (reads `togglePause()` from the page scope) |
| `DoublesPathRecreationalInput.astro` | Doubles-path tap input row | none |
| `ExitModal.astro` | Leave-session confirmation | `description` (defaults to the "recorded as abandoned" copy; override for a tool with nothing to persist, e.g. Trivia) (2026-09-09) |
| `GameCard.astro` | Games-index entry | `href`, `title`, `caption`, `duration` (optional pill, e.g. "30 min") (2026-09-11) |
| `InputButton.astro` | Single key in a tap/keypad input row | `type` |
| `NoSessionPanel.astro` | Empty state when no session is active | `href` |
| `ReconciliationBlocked.astro` | Blocked-upload explanation panel | none |
| `ResultsModalShell.astro` | Shared results-modal chrome: overlay, glass card, save-status region, play-again error, back/play-again buttons; named `title` slot plus a default slot for stat rows | `showSavedMessage` |
| `ScoreInput.astro` | Numeric keypad with submit/delete/undo | `value`, `digitHandler`, `onDelete`, `onSubmit`, `submitDisabled`, `padDisabled`, `undoClick`, `undoDisabled` |
| `SinglePlayerDisplay.astro` | Score-or-target panel with `above`/`progress` slots | `score`, `target`, `isTarget`, `size` (`lg`/`sm`), `fluid` (container-query sizing + no-wrap for variable-length content, e.g. Quick Subtract's equation — 2026-09-09), `activeExpr` (accent border while true), `pinnedHeight` (default `true` — the 40% scoreboard band; `false` only for the card nested inside `SplitScoreboardHalf` — 2026-09-19) |
| `SinglePlayerSummary.astro` | Solo results-modal stat block: one `StatRow` per row for the loading state and the single seat, shown only for a 1-seat `resultsSnapshot` (2026-08-30) | `statRows` (`{ label, key, fallback? }[]`), `seatIndex` (default `0`) |
| `SinglesRecreationalInput.astro` | Target-aware S/D/T or Bull tap row | none |
| `SplitScoreboard.astro` | Two-seat scoreboard shell; two `SplitScoreboardHalf` columns side by side; occupies the same 40% band as an unnested `SinglePlayerDisplay` (2026-09-19) | `seatA`, `seatB` (each `{ nameExpr, activeExpr, scoreExpr, legsExpr?, checkoutExpr? }`), `isTarget`, `legsToWinExpr`, named slots `progressA`/`progressB` |
| `SplitScoreboardHalf.astro` | One seat's column inside `SplitScoreboard`: centered name, then a compact `SinglePlayerDisplay` (`size="sm"`, accent border while active) with the optional leg-wins pill centered above the big number (`above` slot), optional checkout chips, optional leg dot pager; whole column dims to 90% opacity while inactive | `nameExpr`, `activeExpr`, `scoreExpr`, `isTarget`, `legsExpr`, `legsToWinExpr`, `checkoutExpr`; default slot renders in the progress region |
| `StatRow.astro` | Label/value row inside a progress or results list | `label`, `value` |
| `StatRowComparison.astro` | 1v1 comparison row: label centered, one seat's value on each side (2026-08-28) | `label`, `leftValue`, `rightValue` |
| `StatRowSkeleton.astro` | Loading-state placeholder for a `StatRow`, shown while `completionStatus` is `pending`/`saving` | `label` |
| `VisitPreview.astro` | Three-dart preview strip for the open visit; every adopter builds its `previewSegments()` via the shared `playPreviewSegments()` (Pattern 19) | none |

## `components/layout/games/setup/` (shared shells)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AddGuestButton.astro` | Dashed circle add-guest control; hides once `guests.length` hits 1 (1v1 cap) | none (reads `guests`/`showAddGuestModal` from the page scope) |
| `GuestNameModal.astro` | Name-entry modal for a new guest | none (reads `newGuestName`/`showAddGuestModal`, calls `addGuest()` on the page scope) |
| `GuestSection.astro` | Runtime guest list (avatar + remove badge per guest) plus `AddGuestButton`/`GuestNameModal` | none (reads `guests`, calls `removeGuest(i)` on the page scope) |
| `SettingSectionShell.astro` | Bordered section wrapper inside a setup form | none |
| `SetupShell.astro` | Page shell for every game setup screen; owns the form's error alert | `title` |
| `Toggle.astro` | Segmented option control bound via `x-modelable` | `options`, `orientation` (`horizontal`/`vertical`), `initial`, `hint` |
| `ToggleListItem.astro` | One option inside a vertical `Toggle` | `value`, `label` |
| `UserIconDisplay.astro` | Avatar/initial badge | `name`, `nameExpr` |
| `UserSection.astro` | Player row on the setup screen | `allowGuests` (501 only — renders `GuestSection` beside the owner icon) |

## `components/layout/training/routines/`

D308 split the flat `components/layout/training/` directory into three
children (`routines/`, `exercises/`, `trivia/`); this inventory now follows
that split (2026-09-19, closes issue #423).

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `RoutineDetail.astro` | Routine-detail shell for a data-driven routine: title + duration pill, ordered step list, `Start` (wired to `routineDetail().start()`, navigates to the play route), and — for the caller's own routine only (`canEdit()`) — `Edit`/`Delete`, the latter behind a `ConfirmDialog` | none — reads `routineDetail()` from the parent scope (`routine-detail.data.ts`) (2026-09-11; rewritten data-driven, Edit/Delete added, 2026-09-19) |
| `RoutineCard.astro` | One routine in the `/training` list; renders inside `x-for`, links to the detail route, shows a "mine" badge for a non-system routine | none — reads `routine` (`RoutineSummaryData`) and `trainingIndex()`'s `detailHref`/`durationLabel` from the parent scope (2026-09-19) |
| `RoutineBuilder.astro` | Builder body for create and edit: name/description inputs, the ordered step list, `ExercisePicker`, duration total, and Cancel/Save | none — reads `routineBuilder(mode)` from the page's `x-data` (`routine-builder.data.ts`) (2026-09-19) |
| `RoutineStepRow.astro` | One builder step: position, exercise name, minutes input (bound `:min`/`:max`), move-up/move-down (D337) and remove | reads `step`/`index` from the enclosing `x-for` plus the builder's helpers (2026-09-19) |
| `ExercisePicker.astro` | Exercise catalog as tappable tiles; tapping appends a step, disabled once the builder is at its step cap | none — reads `catalog`/`steps`/`maxSteps` from the parent scope (2026-09-19) |
| `RoutineSummaryModal.astro` | End-of-routine results overlay: one card per completed exercise (`stepSummaries`), total session time, `completeTraining` save status with Retry, and a `Done` button that resets the header store and leaves for `/training` | none — reads the play page's `x-data` scope (2026-09-14) |

## `components/layout/training/exercises/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BlockedStepModal.astro` | Resolution overlay when an unfinished Ten Up One Down game blocks the routine's Finishing step: names that game and its start date, `Abandon & continue` (`resolveBlockingSession()`) or `Leave routine` (`abandonAndExit()`) | none — reads the play page's `x-data` scope (2026-09-16) |
| `ExerciseBoardInputPanel.astro` | Visual-board capture surface plus undo/bounce-out row for a non-game exercise session (Switching, Double Pattern) — mirrors `BoardInputPanel.astro` minus the `$store.game` gate, since an exercise session has no game store, is always `VISUAL_BOARD`, and has no clock (2026-09-12) | none (reads `board`, pointer handlers, `recordUnseen`, `visitMarkers`, `finished`, `undoVisit()` from the page scope) |

## `components/layout/training/trivia/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `QuickSubtract.astro` | Quick Subtract's whole play surface: idle setup (Fixed Count/Timer toggle, count/minutes input), running state (score display, correct/incorrect `StatRow`s, `ScoreInput` keypad), and a finished overlay with session stats and Play again/Back to Trivia | none — reads the page's `x-data` scope (`status`, `correctAnswers`, `incorrectAnswers`, `attempts`, `startCount()`/`startTimer()`/`submit()`/`exit()`/`reset()`) (2026-09-19) |

## `components/layout/training/schedules/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `TodayCard.astro` | `/training`'s Today card: active schedule's routine for today (or rest), `Start`, link to Schedules; whole card `x-show="schedule"`, hidden with no active schedule | none — reads `todayCard()` from the parent scope (2026-09-20) |
| `ScheduleEditor.astro` | Editor body for create/edit: name `Input`, seven `ScheduleDayRow`s, server-issue list, Cancel/Save | none — reads `scheduleEditor(mode)` from the page's `x-data` (2026-09-20) |
| `ScheduleDayRow.astro` | One weekday row: label plus a routine picker; uses a native `<select>` (a "Rest" `""` option) rather than a shared primitive — no select component exists in `components/forms/`, the accepted exception | reads `row`/`index` from the enclosing `x-for` plus `routineLabel()`/`routines` from `scheduleEditor()` (2026-09-20) |

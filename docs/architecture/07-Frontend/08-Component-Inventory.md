<!--
status: canonical
scope: shared Astro component inventory
read-when: before writing markup for any recurring UI shape
updated: 2026-08-21
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
| `InfoSection.astro` | Titled explanatory block | `title`, `description`, `id` |
| `IsLoading.astro` | Loading skeleton / spinner panel | `title` |
| `Link.astro` | Anchor styled as text link or button | `href`, `variant` (`inline`/`primary`/`secondary`/`ghost`), `external`, `icon`, `ariaLabel` |
| `LogoutButton.astro` | Sign-out action wired to the auth flow | none |
| `Modal.astro` | Base dialog shell; `ConfirmDialog` builds on it | `titleId`, `descriptionId`, `dismissible`, `onDismiss` |

## `components/forms/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AppModeForm.astro` | Analytics/recreational app-mode radio picker | none (reads the settings store) |
| `Button.astro` | **The** standalone action element — never hand-roll a `<button>` | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`/`dashed`), `icon`, `disabled`, `ariaLabel`, `loadingExpr` |
| `IconBtn.astro` | Icon-only button, always a perfect circle (`aspect-square` + `rounded-full`); no built-in padding, no text | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`/`dashed`), `disabled`, `ariaLabel` (required) |
| `HandednessForm.astro` | Left/right-handed radio picker | none (reads the settings store) |
| `Input.astro` | Styled text/number/email input | `id`, `type`, `name`, `value`, `placeholder`, `error`, `required`, `disabled` |
| `PlayerSettingsCard.astro` | Bordered card grouping the player-settings rows | none |
| `SettingRow.astro` | Label plus inline-editable value with a save action | `id`, `label`, `valueExpr`, `modelExpr`, `saveExpr`, `emptyText`, `numeric`, `inputmode`, `required`, `disabledExpr` |

## `components/layout/games/` (shared across rulesets)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BoardInputPanel.astro` | Visual-board capture surface plus undo/bounce-out row; shown instead of the keypad for `ANALYTICS` + `VISUAL_BOARD` | none (reads `boardInputData()` from the page scope) |
| `CheckoutConfirm.astro` | Double-out confirm (Confirm / Cancel only); also collects the checkout's darts-to-finish and darts-at-a-double | none (reads `checkoutDartOptions()`, `dartsToFinish`, `dartsAtDouble` from the page scope) |
| `ContinueSessionModal.astro` | Resume-or-discard prompt for an unfinished session | `gameTitle` |
| `DoublesPathRecreationalInput.astro` | Doubles-path tap input row | none |
| `ExitModal.astro` | Leave-session confirmation | none |
| `GameCard.astro` | Games-index entry | `href`, `title`, `caption` |
| `InputButton.astro` | Single key in a tap/keypad input row | `type` |
| `NoSessionPanel.astro` | Empty state when no session is active | `href` |
| `ReconciliationBlocked.astro` | Blocked-upload explanation panel | none |
| `ScoreInput.astro` | Numeric keypad with submit/delete/undo | `value`, `digitHandler`, `onDelete`, `onSubmit`, `submitDisabled`, `padDisabled`, `undoClick`, `undoDisabled` |
| `SinglePlayerDisplay.astro` | Score-or-target panel with `above`/`progress` slots | `score`, `target`, `isTarget`, `size` (`lg`/`sm`), `activeExpr` (accent border while true) |
| `SinglesRecreationalInput.astro` | Target-aware S/D/T or Bull tap row | none |
| `SplitScoreboard.astro` | Two-seat scoreboard shell; two `SplitScoreboardHalf` columns side by side | `seatA`, `seatB` (each `{ nameExpr, activeExpr, scoreExpr, legsExpr?, checkoutExpr? }`), `isTarget`, `legsToWinExpr`, named slots `progressA`/`progressB` |
| `SplitScoreboardHalf.astro` | One seat's column inside `SplitScoreboard`: centered name, then a compact `SinglePlayerDisplay` (`size="sm"`, accent border while active) with the optional leg-wins pill centered above the big number (`above` slot), optional checkout chips, optional leg dot pager; whole column dims to 90% opacity while inactive | `nameExpr`, `activeExpr`, `scoreExpr`, `isTarget`, `legsExpr`, `legsToWinExpr`, `checkoutExpr`; default slot renders in the progress region |
| `StatRow.astro` | Label/value row inside a progress or results list | `label`, `value` |
| `VisitPreview.astro` | Three-dart preview strip for the open visit | none |

## `components/layout/games/setup/` (shared shells)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AddGuestButton.astro` | Dashed circle add-guest control; hides once `guests.length` hits 1 (1v1 cap) | none (reads `guests`/`showAddGuestModal` from the page scope) |
| `GuestNameModal.astro` | Name-entry modal for a new guest | none (reads `newGuestName`/`showAddGuestModal`, calls `addGuest()` on the page scope) |
| `GuestSection.astro` | Runtime guest list (avatar + remove badge per guest) plus `AddGuestButton`/`GuestNameModal` | none (reads `guests`, calls `removeGuest(i)` on the page scope) |
| `SettingSectionShell.astro` | Bordered section wrapper inside a setup form | none |
| `SetupShell.astro` | Page shell for every game setup screen | `title` |
| `Toggle.astro` | Segmented option control bound via `x-modelable` | `options`, `orientation` (`horizontal`/`vertical`), `initial`, `hint` |
| `ToggleListItem.astro` | One option inside a vertical `Toggle` | `value`, `label` |
| `UserIconDisplay.astro` | Avatar/initial badge | `name`, `nameExpr` |
| `UserSection.astro` | Player row on the setup screen | `allowGuests` (501 only — renders `GuestSection` beside the owner icon) |

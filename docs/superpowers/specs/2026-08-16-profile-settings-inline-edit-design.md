# Design: Profile settings inline-edit redesign

Status: approved. Author: agent, brainstorming session, 2026-08-16.

## Problem

The profile page's newly-shipped display name / darts / weight fields are three separate always-visible-input cards, each with its own `InfoSection` heading and Save button. The player wants them grouped as a single settings list under a plain "Player settings" heading, with each value shown as text (edit via a pencil button) rather than a permanently-open input, and handedness folded into the same list.

## Scope

- Regroup `DisplayNameForm`, `DartsConfigForm`, and (visually) `HandednessForm` under one card, itself under a plain `h2` "Player settings" heading (not an `InfoSection`).
- Replace the always-visible text/number inputs with text + pencil-edit-button rows; clicking the pencil turns that row's value into an input, auto-saving on blur/Enter.
- Handedness keeps its existing two-button picker unchanged, just relocated and stripped of its `InfoSection` wrapper.
- `AppModeForm` is unaffected — keeps its own `InfoSection` ("App mode").
- Out of scope: any store, API, service, repository, or database change. `profile.store.ts`'s `save()` already PATCHes all three profile fields together; this redesign only changes how that call is triggered from the UI.

## Components

- New `app/src/icons/pencil.svg` — 24×24 stroke icon, matching the existing icon set's style (`check.svg`, `delete.svg`: `stroke="currentColor" stroke-width="2"`).
- New `app/src/components/forms/SettingRow.astro` — generic label + text/pencil row, reused for the three profile fields.
  - Props: `id`, `label`, `valueExpr` (Alpine text expression for the display span), `modelExpr` (Alpine `x-model` target for the input), `saveExpr` (Alpine call fired on blur/Enter), `type` (`"text"`; grams uses `type="text" inputmode="numeric"` like today), `placeholder`, `emptyText` (shown when `valueExpr` is empty/null), `disabledExpr`.
  - Local `x-data="{ editing: false }"`. Pencil button (`Button` primitive, `icon`, `variant="ghost"`, pencil icon) click → `editing = true` + `$nextTick(() => $refs.input.focus())` (same pattern `HandednessForm`/`AppModeForm` already use for focus management). Input `@blur`/`@keydown.enter` → run `saveExpr`, then `editing = false`.
  - View mode: `<span x-show="!editing" x-text="...">` for the value (falls back to `emptyText` when empty) + the pencil `Button`. Edit mode: `<Input x-show="editing" x-ref="input" x-model="modelExpr" @blur=... @keydown.enter.prevent=...>`.
- New `app/src/components/forms/PlayerSettingsCard.astro` — plain bordered card reusing `InfoSection`'s own card classes directly (`bg-tab-card border-tab-border rounded-3xl p-3 border`), **not** the `InfoSection` component itself (no collapsible heading/description — this card has no heading of its own, only the rows). Contains, in order:
  1. `SettingRow` — Display name (`$store.profile.displayName`, required, no `emptyText` needed since the column is `NOT NULL`)
  2. `SettingRow` — Darts (`$store.profile.dartsDescription`, `emptyText="Not set"`)
  3. `SettingRow` — Weight (g) (`$store.profile.dartsWeightGrams`, `x-model.number`, `emptyText="Not set"`)
  4. Handedness row — label "Handed" + the (unchanged) two-button picker moved out of `HandednessForm.astro`
  5. One shared error banner (existing `$store.profile.error` alert markup, reused from the current `DisplayNameForm`/`DartsConfigForm`)
- `HandednessForm.astro`: strip the `InfoSection` import/usage and the outer `<section aria-labelledby="handedness-heading">` wrapper down to just the `role="radiogroup"` `<div>` (control markup, roving tabindex, and `$store.boardInput.handedness` binding are all unchanged). Still its own file/component — the roving-tabindex logic is real enough to keep isolated — imported into `PlayerSettingsCard.astro`.
- Delete `DisplayNameForm.astro` and `DartsConfigForm.astro` — fully superseded by the two `SettingRow` instances in `PlayerSettingsCard.astro`.
- `app/src/pages/profile/index.astro`: renders `<h1>Profile</h1>`, then a plain `<h2>Player settings</h2>` (no `InfoSection`), then `<PlayerSettingsCard />`, then `<AppModeForm />` unchanged.

## Save behavior

Auto-save on blur/Enter — each `SettingRow`'s `saveExpr` is `$store.profile.save()`, which already sends `displayName`/`dartsDescription`/`dartsWeightGrams` together (the existing "replace all three fields" PATCH contract). No partial-field API exists or is needed. Handedness continues to save immediately on click, unchanged (local `$persist` only, no network call, no shared error state with the profile fields).

## Empty-value display

`dartsDescription`/`dartsWeightGrams` show literal text "Not set" when their store value is `null`/empty; entering edit mode still opens an empty input (not pre-filled with the placeholder text).

## Testing

No unit tests — `.astro` markup and its inline branching logic are not unit-tested in this project (D101, `app/CLAUDE.md`). Verified with the existing full test suite (regression-only, since no `.ts` logic changes) plus a manual dev-server smoke check of the redesigned page.

# Setup page + duration field extraction (#914, task A)

## Goal

Remove copy-paste across the 11 `pages/games/*/setup/index.astro` pages and the
duration selector repeated in three setup forms, so setup screens cannot drift.
No visible or behavioural change.

Task A of three under #914 (B: `MetricTile`, C: setup-controller reconciliation
mixin). Each lands on its own branch from `main`.

## Evidence

- All 11 setup pages are identical to `501/setup/index.astro` except four
  strings: game title, `x-data` factory, form component, modal game title.
  `score-training` omits `gameTitle` on `ContinueSessionModal`; its default
  (`"Score Training"`) equals the page title, so passing the title is
  equivalent.
- The "Could not clean up a previous session" alert + Retry button is inlined
  in all 11 pages. (`ReconciliationBlocked` is the *play-side* equivalent with
  different markup and is out of scope.)
- The FORMAT toggle + ROUNDS/MINUTES `RangeSlider` + guest/bot ROUNDS slider
  block is repeated in `OneTwentyOneSetupForm`, `ScoreTrainingSetupForm`,
  `TuodSetupForm` (fallow: 37-42 line clones).

## Design

### `GameSetupPage.astro` (`components/layout/games/setup/`)

Props: `title: string` (display name, e.g. `"Bob's 27"`), `xData: string`
(e.g. `"bobs27Setup()"`). Default slot: the game's `*SetupForm`.

Renders `AppLayout title="{title} — Setup"` → `div.p-4[x-data]` →
the three `<template x-if>` blocks (continue modal with `gameTitle={title}`,
reconciliation-failed alert, slotted form). Page files shrink to:

```astro
<GameSetupPage title="501" xData="fiveOhOneSetup()">
  <FiveOhOneSetupForm />
</GameSetupPage>
```

Pages keep `export const prerender = true`. The alert is a private piece of
`GameSetupPage` (single consumer); no separate component file.

Alpine scope is unchanged: `x-data` stays on the same `div`; the slotted form
renders inside the same `<template x-if>`.

### `DurationField.astro` (`components/layout/games/setup/`)

Props: `formatOptions` (Toggle options), `rounds` / `minutes` (`{min,max}`),
`soloHint`. Renders the solo FORMAT toggle + conditional sliders and the
guest/bot ROUNDS slider, bound to `durationType` / `durationValue` /
`guests` / `bot` exactly as today. Used inside each form's
`SettingSectionShell`; per-form extras (e.g. TUOD's `Switch`) stay in the form.
121's form is checked line-for-line against the two others before adoption; any
divergence stays in the form rather than adding props.

## Out of scope

Controllers (task C), `MetricTile` (task B), `ReconciliationBlocked` (play
side), game-specific form fields.

## Verification

- Build output for each setup route is identical before/after, modulo
  whitespace (diff rendered HTML from `astro build`).
- `npm test`, `npm run check`, fallow gate, repo gate scripts via
  `run-all-gates`.
- Docs: `08-Component-Inventory.md` rows for the two new components;
  `09-Adding-A-Game.md` setup-page row updated; context-maintenance pass.

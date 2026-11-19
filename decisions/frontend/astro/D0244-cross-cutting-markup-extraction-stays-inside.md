---
id: D0244
status: accepted
date: 2026-08-28
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro, component, layout, slot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Cross-cutting markup extraction stays inside D215's per-game boundary

## Context and Problem Statement
All three blocks were verified byte-identical (not merely similar) before extraction, and none of them intersects the setup-controller/validator logic D215 measured and left alone — that decision's "one shape per game" holds for `*-play.data.ts` and the setup/validator `.ts` pair; it never covered markup chrome. Building `ResultsModalShell` surfaced a real drift: only `AroundTheClockResults.astro` passed `loadingExpr="playAgainLoading"` to its play-again button, so retrying a failed save showed a spinner on one game and not the other eight. The shell's button always sets `loadingExpr`, fixing the drift by construction rather than filing it as a separate finding, since the fix is inseparable from the extraction that exposed it.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Three extractions from `components/`, none of which restructure the per-game families D215 named out of scope. `ErrorAlert.astro` (`components/ui/`) replaces the byte-identical `alert alert-error` `<p>` block that recurred 29 times across `interfaces/`, `setup/*SetupForm.astro`, `AppModeForm.astro`, and `PlayerSettingsCard.astro`, taking `showExpr`/`textExpr` (both defaulting to `"error"`) and an `alwaysVisible` flag that drops `x-show`/`x-cloak` for the one call site (a results-modal completion error) whose ancestor already gates visibility. `SetupShell.astro` absorbs the setup-form error alert directly (all 9 `*SetupForm.astro` children rendered the identical block just above `</SetupShell>`), so no per-game setup file carries it anymore. `ResultsModalShell.astro` (`components/layout/games/`) replaces each of the 9 `result-modals/*.astro` files' outer chrome (overlay, glass card, save-status region, play-again error, back/play-again buttons) with a named `title` slot (a plain string prop cannot express Bob's 27's two separately-gated `<h2>` elements) plus a default slot for each game's own stat markup; a `showSavedMessage` prop (default `false`) reproduces the fact that only 4 of the 9 games ever showed "Saved!".".

### Consequences
`docs/architecture/07-Frontend/08-Component-Inventory.md`'s "out of scope: per-game components... one-per-ruleset by design" note is unchanged — `interfaces/`, `result-modals/`, and `setup/*SetupForm.astro` still hold one file per game each, now consuming the three new shared pieces instead of repeating their chrome. D101 applies throughout: no test file was added or edited, and the existing 2996-test suite passed unmodified, which is the same behavior-preserving proof D215 used for its own two extractions.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-28

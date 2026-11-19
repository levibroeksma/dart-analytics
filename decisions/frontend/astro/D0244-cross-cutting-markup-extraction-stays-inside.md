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

# Cross-cutting markup extraction stays inside D215's per-game boundary

## Context and Problem Statement
All three blocks were verified byte-identical (not merely similar) before extraction, and none of them intersects the setup-controller/validator logic D215 measured and left alone — that decision's "one shape per game" holds for `*-play.data.ts` and the setup/validator `.ts` pair; it never covered markup chrome. Building `ResultsModalShell` surfaced a real drift: only `AroundTheClockResults.astro` passed `loadingExpr="playAgainLoading"` to its play-again button, so retrying a failed save showed a spinner on one game and not the other eight. The shell's button always sets `loadingExpr`, fixing the drift by construction rather than filing it as a separate finding, since the fix is inseparable from the extraction that exposed it.

## Decision Drivers
* The `alert alert-error` block appears 29 times, and all 9 `*SetupForm.astro` files repeat it verbatim.
* All 9 `result-modals/*Results.astro` files share identical outer chrome, and only `AroundTheClockResults.astro` passes `loadingExpr="playAgainLoading"`.
* D215 kept the per-game families as one file per game and left the markup layer alone, so the extraction must not restructure those families.

## Considered Options
* Keep the markup per game, as D215's boundary left it.
* Extract further inside `interfaces/` than its `ErrorAlert` swap.
* Extract `ErrorAlert`, fold the setup alert into `SetupShell`, and add `ResultsModalShell` (chosen).

## Decision Outcome
Chosen option: "Three extractions from `components/`, none of which restructure the per-game families D215 named out of scope. `ErrorAlert.astro` (`components/ui/`) replaces the byte-identical `alert alert-error` `<p>` block that recurred 29 times across `interfaces/`, `setup/*SetupForm.astro`, `AppModeForm.astro`, and `PlayerSettingsCard.astro`, taking `showExpr`/`textExpr` (both defaulting to `"error"`) and an `alwaysVisible` flag that drops `x-show`/`x-cloak` for the one call site (a results-modal completion error) whose ancestor already gates visibility. `SetupShell.astro` absorbs the setup-form error alert directly (all 9 `*SetupForm.astro` children rendered the identical block just above `</SetupShell>`), so no per-game setup file carries it anymore. `ResultsModalShell.astro` (`components/layout/games/`) replaces each of the 9 `result-modals/*.astro` files' outer chrome (overlay, glass card, save-status region, play-again error, back/play-again buttons) with a named `title` slot (a plain string prop cannot express Bob's 27's two separately-gated `<h2>` elements) plus a default slot for each game's own stat markup; a `showSavedMessage` prop (default `false`) reproduces the fact that only 4 of the 9 games ever showed "Saved!".".

### Consequences
`docs/architecture/07-Frontend/08-Component-Inventory.md`'s "out of scope: per-game components... one-per-ruleset by design" note is unchanged — `interfaces/`, `result-modals/`, and `setup/*SetupForm.astro` still hold one file per game each, now consuming the three new shared pieces instead of repeating their chrome. D101 applies throughout: no test file was added or edited, and the existing 2996-test suite passed unmodified, which is the same behavior-preserving proof D215 used for its own two extractions.

* Neutral, because the Component Inventory note "out of scope: per-game components... one-per-ruleset by design" is unchanged. `interfaces/`, `result-modals/` and `setup/*SetupForm.astro` still hold one file per game each.
* Good, because the shell's play-again button always sets `loadingExpr`, which fixes the drift by construction.
* Neutral, because D101 applies: no test file was added or edited, and the existing 2996-test suite passed unmodified. D215 used the same behavior-preserving proof.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec runs `npm run validate:app` (astro check plus the full suite) after each family. The record reports the 2996-test suite passing unmodified.

## Pros and Cons of the Options
### Keep the markup per game
* Bad, because the 29 alert blocks and the 9 result-modal chromes stay duplicated.
* Bad, because the `loadingExpr` drift on 8 of the 9 result modals stays.

### Extract further inside `interfaces/`
* Bad, because the interfaces differ in which expressions they pass, not in markup shape. Extracting further would invent a per-game config object, the trap D215 avoided for `play.data.ts`.

### Three extractions that leave the per-game families alone
* Good, because the byte-identical blocks collapse into `ErrorAlert`, `SetupShell` and `ResultsModalShell`.
* Good, because the `title` slot keeps each game's own `<h2>` logic, which a string prop cannot express.

## Evidence / More Information
Decided: 2026-08-28

* `docs/superpowers/specs/2026-08-28-components-dedup-design.md` (Problem, Design 1-3, Migration, Testing, Findings): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Commit `1e75341f` (2026-08-28; adds the D244 row): rebuilt Consequences.

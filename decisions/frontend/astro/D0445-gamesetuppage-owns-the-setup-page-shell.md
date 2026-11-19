---
id: D0445
status: accepted
date: 2026-10-11
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro, component, layout, props, page, slot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `GameSetupPage` owns the setup page shell; `DurationField` is shared by two forms only

## Context and Problem Statement
the 11 pages differed in four strings only (Score Training omitted `gameTitle`, equal to its default), and the alert block was copy-pasted in each, so any change to setup chrome had to land eleven times (#914). 121 has a third TARGET format and shows a text note, not a slider, for guest/bot sessions; folding it in would add props only 121 uses.

## Decision Drivers
* The 11 setup pages differ in four strings only, and the alert block is copy-pasted in each, so a change to setup chrome lands 11 times (#914).
* `scripts/check-game-wiring.sh` greps `x-data="(\w+)\(\)"` in each page, so the literal attribute must stay in each page file.
* `OneTwentyOneSetupForm` has a third TARGET format and shows a text note, not a slider, for guest/bot sessions.

## Considered Options
* Keep the 11 setup pages as they are.
* Extract `GameSetupPage` and `DurationField`, with `OneTwentyOneSetupForm` outside `DurationField` (chosen).
* Fold `OneTwentyOneSetupForm` into `DurationField`.

## Decision Outcome
Chosen option: "`components/layout/games/setup/GameSetupPage.astro` renders `AppLayout`, the `x-data` wrapper `div`, the continue-session modal, the reconciliation-failed alert with Retry, and the game's `*SetupForm` in its default slot. The page's `x-data="<codeSlug>Setup()"` is passed as a rest attribute and spread onto the wrapper, so each page file still carries the literal attribute `scripts/check-game-wiring.sh` greps. All 11 `pages/games/*/setup/index.astro` files now reduce to that call. `DurationField.astro` holds the solo FORMAT toggle with ROUNDS/MINUTES sliders and the guest/bot ROUNDS slider; Score Training and TUOD use it. `OneTwentyOneSetupForm` does not.".

### Consequences
a new game's setup page is one component call. `.astro` carries no unit test (D101); proof was a byte-for-byte comparison of the built HTML for all 11 setup routes before and after. The alert stays private to `GameSetupPage` (single consumer). `ReconciliationBlocked` (play side) is unchanged.

* Good, because a new game's setup page is one component call.
* Neutral, because `.astro` carries no unit test (D101). Proof was a byte-for-byte comparison of the built HTML for all 11 setup routes before and after.
* Neutral, because the alert stays private to `GameSetupPage`, its single consumer.
* Neutral, because `ReconciliationBlocked` on the play side is unchanged.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec compares the rendered HTML of each setup route from `astro build` before and after, modulo whitespace. It also runs `npm test`, `npm run check` and the fallow gate.

## Pros and Cons of the Options
### Keep the 11 pages as they are
* Bad, because each setup-chrome change lands 11 times and the pages can drift.

### Fold `OneTwentyOneSetupForm` into `DurationField`
* Bad, because it would add props only that form uses.

### `GameSetupPage` plus `DurationField`
* Good, because the page files shrink to one component call while keeping the literal `x-data` attribute the wiring gate greps.
* Good, because the duplicated FORMAT toggle and sliders of Score Training and TUOD (a 37-line fallow clone) live in one component.

## Evidence / More Information
Decided: 2026-10-11

* `docs/superpowers/specs/2026-10-11-setup-page-extraction-design.md` (Goal, Evidence, Design, Verification): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Commit `3bc62ac8` (PR #918, 2026-10-11; adds the D445 row, both components and the spec): rebuilt Consequences.
* Applied in: `docs/superpowers/specs/2026-10-13-play-screen-shells-design.md` (the "D445 method" parity check), `docs/superpowers/specs/2026-10-13-exercise-play-restyle-design.md`.

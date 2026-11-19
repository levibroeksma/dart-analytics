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
<!-- backfill: pending -->

# `GameSetupPage` owns the setup page shell; `DurationField` is shared by two forms only

## Context and Problem Statement
the 11 pages differed in four strings only (Score Training omitted `gameTitle`, equal to its default), and the alert block was copy-pasted in each, so any change to setup chrome had to land eleven times (#914). 121 has a third TARGET format and shows a text note, not a slider, for guest/bot sessions; folding it in would add props only 121 uses.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`components/layout/games/setup/GameSetupPage.astro` renders `AppLayout`, the `x-data` wrapper `div`, the continue-session modal, the reconciliation-failed alert with Retry, and the game's `*SetupForm` in its default slot. The page's `x-data="<codeSlug>Setup()"` is passed as a rest attribute and spread onto the wrapper, so each page file still carries the literal attribute `scripts/check-game-wiring.sh` greps. All 11 `pages/games/*/setup/index.astro` files now reduce to that call. `DurationField.astro` holds the solo FORMAT toggle with ROUNDS/MINUTES sliders and the guest/bot ROUNDS slider; Score Training and TUOD use it. `OneTwentyOneSetupForm` does not.".

### Consequences
a new game's setup page is one component call. `.astro` carries no unit test (D101); proof was a byte-for-byte comparison of the built HTML for all 11 setup routes before and after. The alert stays private to `GameSetupPage` (single consumer). `ReconciliationBlocked` (play side) is unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-11

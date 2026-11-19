---
id: D0171
status: accepted
date: 2026-07-29
origin: contemporaneous
original-date:
tags: [frontend/astro, icon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `Button.astro`'s built-in loading spinner (D138-adjacent UI convention, not a game-engine

## Context and Problem Statement
Task-scoped reviews for the spinner addition and the button-misusage fixes each saw only one half of this collision; only visible at whole-branch review
The Alpine loading-state spec gives `Button.astro` a built-in spinner. It leaves the `iconBefore` and `iconAfter` slots untouched, so call sites that manage custom icons keep control. Once the built-in spinner shipped, `login/index.astro` and `LogoutButton.astro` rendered two overlapping spinners.

## Decision Drivers
* A button must not show two overlapping spinners for one loading state.

## Considered Options
* Remove the call sites' manual `LoadingIcon` slots and rely on the built-in spinner (chosen).
* The commit records no other option.

## Decision Outcome
Chosen option: "`Button.astro`'s built-in loading spinner (D138-adjacent UI convention, not a game-engine decision) must not be paired with a call site's own manually-wired `iconAfter`/`iconBefore` loading icon keyed on the same variable — `login/index.astro` and `LogoutButton.astro` had both, rendering two overlapping spinners once the built-in one shipped; their manual `LoadingIcon` slots were removed in favor of the built-in one", because Task-scoped reviews for the spinner addition and the button-misusage fixes each saw only one half of this collision; only visible at whole-branch review.

### Consequences
* Good, because each button shows one spinner per loading state.
* Neutral, because `login/index.astro` and `LogoutButton.astro` lose their `LoadingIcon` imports and slot elements.
* Neutral, because call sites must not pair a manual `iconAfter` or `iconBefore` loading icon with the built-in spinner on the same variable.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The whole-branch review found the collision. The commit adds no mechanical gate for it.

## Pros and Cons of the Options
### Built-in spinner only
* Good, because one spinner shows per loading state.

## Evidence / More Information
Decided: 2026-07-29

* `docs/superpowers/specs/2026-07-28-alpine-loading-state-design.md` (§ 2 "Spinner rendering", § 4): rebuilt Context.
* `docs/superpowers/plans/2026-07-28-alpine-loading-state.md` (Task 4): the built-in spinner task.
* Commit `49b3ebdf` (2026-07-29; removes the manual `LoadingIcon` slots and adds the D171 row): rebuilt Decision Drivers, Considered Options, Consequences and Confirmation.
* Commit `a55be538` (2026-07-29; adds the built-in spinner): the change that produced the collision.

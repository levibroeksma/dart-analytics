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
<!-- backfill: pending -->

# `Button.astro`'s built-in loading spinner (D138-adjacent UI convention, not a game-engine

## Context and Problem Statement
Task-scoped reviews for the spinner addition and the button-misusage fixes each saw only one half of this collision; only visible at whole-branch review

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`Button.astro`'s built-in loading spinner (D138-adjacent UI convention, not a game-engine decision) must not be paired with a call site's own manually-wired `iconAfter`/`iconBefore` loading icon keyed on the same variable — `login/index.astro` and `LogoutButton.astro` had both, rendering two overlapping spinners once the built-in one shipped; their manual `LoadingIcon` slots were removed in favor of the built-in one", because Task-scoped reviews for the spinner addition and the button-misusage fixes each saw only one half of this collision; only visible at whole-branch review.

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-29

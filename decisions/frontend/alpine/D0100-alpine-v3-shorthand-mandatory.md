---
id: D0100
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Alpine v3 shorthand mandatory

## Context and Problem Statement
Consistent templates; matches Alpine 3 defaults. The login-page spec lists `x-bind:*` and `x-on:*` as anti-patterns where `:attr` or `@event` works, and requires v3 shorthand. It names D100 as the rule.

## Decision Drivers
* Consistent templates.
* Match Alpine 3 defaults.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Alpine v3 shorthand mandatory: `:attr` and `@event` instead of `x-bind:*` / `x-on:*`; `x-on:*` only inside Astro `{}` when linter rejects `@`", because Consistent templates; matches Alpine 3 defaults.

### Consequences
* Neutral, because `x-on:*` stays allowed inside Astro `{}` when the linter rejects `@`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The login-page plan forbids `x-bind:class`, `x-bind:disabled`, `x-on:submit` and `x-on:click` on native elements in its markup task. No check for the rule exists in the sources.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-15

* `docs/superpowers/specs/2026-07-15-login-page-design.md` (Anti-Patterns table, BaseLayout markup): rebuilt Context.
* `docs/superpowers/plans/2026-07-15-login-page.md` (Global Constraints, Task 5): rebuilt Confirmation.
* Commit `2904b646` (2026-07-15, adds the D100 row and the `app/CLAUDE.md` handbook non-negotiables): rebuilt Consequences.

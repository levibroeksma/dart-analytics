---
id: D0380
status: accepted
date: 2026-10-01
origin: contemporaneous
original-date:
tags: [frontend/alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Routine step reorder gains a keyboard path on the drag grip

## Context and Problem Statement
D351 left pointer drag as the only reorder affordance, stranding keyboard and screen-reader users on a meaningful order (D337's own argument). Restoring the move-button pair would undo D351's layout gain; a keyboard handler on the existing handle is additive.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`RoutineStepRow.astro`'s grip becomes a focusable `IconBtn` that keeps `x-sort:handle`. ArrowUp/ArrowDown call `routineBuilder().nudgeStep(key, ±1)`, which delegates to `moveStep`, then refocus the grip. `moveStep` sets `moveAnnouncement` (`<name>, position N of M`), rendered in an `aria-live="polite"` `sr-only` paragraph in `RoutineBuilder.astro`. The grip is no longer `aria-hidden`.".

### Consequences
drag reorders are announced too. The key handler refocuses after `$nextTick` because the keyed row is moved in the DOM. No new dependency; `.astro` markup is untested (D101), coverage is `routine-builder.data.test.ts` on `nudgeStep` and `moveAnnouncement`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-01

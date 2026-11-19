---
id: D0477
status: accepted
date: 2026-10-21
origin: contemporaneous
original-date:
tags: [frontend/style, glass, surface, icon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Destructive confirms return as coral glass; `ConfirmDialog` regains `confirmVariant`

## Context and Problem Statement
the routine-detail redesign needs a delete action and a confirm that reads as destructive.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`ConfirmDialog` takes `confirmVariant` (`sheet-raised` default, `sheet-destructive`). `glass-destructive` plus `--error-glass-*` tokens (`error-glass-icon`, `error-glass-foreground`) give a coral-tinted frosted surface; `Button` `sheet-destructive` and `IconBtn` `destructive` use it, and `IconBtn` gains `glass` and `destructive` variants. `glass-destructive` and `chip` are registered in `merge-tokens.ts` so `cn()` keeps them.", because the routine-detail redesign needs a delete action and a confirm that reads as destructive.

### Consequences
D429's "no coral fill on destructive confirms" consequence is partly reversed: coral returns as glass, not a solid fill. Other confirms keep the raised default.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-21
Supersedes: D429 in part (the removal of `ConfirmDialog`'s `confirmVariant`).

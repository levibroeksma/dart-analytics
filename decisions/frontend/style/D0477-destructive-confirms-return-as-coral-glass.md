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

# Destructive confirms return as coral glass; `ConfirmDialog` regains `confirmVariant`

## Context and Problem Statement
the routine-detail redesign needs a delete action and a confirm that reads as destructive.

## Decision Drivers
* The routine detail page needs a delete action and a confirm that reads as destructive (spec "Goals" 1 and 4).
* The `--error*` tokens and `btn-error` are solid fills, and no error glass existed (spec "Destructive glass").

## Considered Options
* Add `confirmVariant` to `ConfirmDialog` as an opt-in prop (chosen; spec "ConfirmDialog").
* Change the look of other `ConfirmDialog` call sites. The spec lists this as a non-goal: the destructive confirm is opt-in (spec "Non-goals").

## Decision Outcome
Chosen option: "`ConfirmDialog` takes `confirmVariant` (`sheet-raised` default, `sheet-destructive`). `glass-destructive` plus `--error-glass-*` tokens (`error-glass-icon`, `error-glass-foreground`) give a coral-tinted frosted surface; `Button` `sheet-destructive` and `IconBtn` `destructive` use it, and `IconBtn` gains `glass` and `destructive` variants. `glass-destructive` and `chip` are registered in `merge-tokens.ts` so `cn()` keeps them.", because the routine-detail redesign needs a delete action and a confirm that reads as destructive.

### Consequences
D429's "no coral fill on destructive confirms" consequence is partly reversed: coral returns as glass, not a solid fill. Other confirms keep the raised default.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
* Opt-in `confirmVariant` with a `sheet-raised` default, credited to the chosen option: other confirms keep their look (spec "ConfirmDialog"; plan "Architecture").

## Evidence / More Information
Decided: 2026-10-21
Supersedes: D429 in part (the removal of `ConfirmDialog`'s `confirmVariant`).
* `docs/superpowers/specs/2026-10-21-routine-detail-redesign-design.md`: rebuilt Decision Drivers, Considered Options, Pros and Cons ("Goals", "Non-goals", "Destructive glass", "ConfirmDialog").
* Commit `173d0ad5` (2026-10-21, "fix(routines): final review fixes — docs accuracy, decision split, step count"): adds the D477 row, whose text is the existing Context, Decision Outcome and Consequences.

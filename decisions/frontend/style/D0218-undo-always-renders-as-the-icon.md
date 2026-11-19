---
id: D0218
status: accepted
date: 2026-08-20
origin: contemporaneous
original-date:
tags: [frontend/style, style, icon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Undo always renders as the icon, never a text label

## Context and Problem Statement
Four of the five undo controls were already icon-only; TUOD's play screen had shipped a full-width `Button title="Undo"` under its action row, which read as a different control doing a different thing. The convention existed in the code and nowhere in the guidance, so nothing caught the fifth one.

## Decision Drivers
* 4 of the 5 undo controls were already icon-only, and TUOD's play screen had a full-width titled `Button`.
* The convention existed in code and in no guidance, so nothing caught the fifth control.

## Considered Options
* Every undo control is an icon-only `UndoIcon` with an `aria-label` (chosen).
* A titled text `Button` beside the input component, as TUOD had shipped.

## Decision Outcome
Chosen option: "Every undo control in the app is an icon-only `UndoIcon` with an `aria-label` naming what it undoes. A play screen that wants undo takes it from the input component that already carries it — `ScoreInput.astro`, `BoardInputPanel.astro`, `SinglesRecreationalInput.astro`, `DoublesPathRecreationalInput.astro` — rather than placing a titled `Button` beside it. Recorded in `07-Style-Guide.md` §Buttons and on the Frontend Agent Guide's pre-completion checklist.".

### Consequences
TUOD's text undo is gone with the keypad that replaced its binary buttons (D217), so no screen presently violates the rule. The rule is prose, not a gate — `scripts/check-astro-conventions.sh` has no notion of which component an icon belongs in — so it holds only as far as the checklist is read.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The Frontend Agent Guide checklist item reads: undo renders as `UndoIcon` plus `aria-label`, never a titled text button. Review applies it; no script checks it.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-20

* Commit `19ebfff0` (PR #149, 2026-08-20; adds the D218 row, the Style Guide § Buttons bullet and the Agent Guide checklist item): rebuilt Confirmation.

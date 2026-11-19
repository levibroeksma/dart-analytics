---
id: D0124
status: accepted
date: 2026-07-21
origin: contemporaneous
original-date:
tags: [frontend/astro, props]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Portable `Modal.astro` shell + `ConfirmDialog.astro` preset in `components/ui/`

## Context and Problem Statement
One overlay contract; stop duplicating backdrop/panel markup
Three near-copies of overlay markup existed: the finish-confirm dialog inline in the play page, `ExitModal.astro` and `ContinueSessionModal.astro`. The style guide already carried forward guidance for a modal primitive, and `05-Astro-Components.md` listed `Modal.astro` under `components/ui/`, but no primitive existed. The design spec adds a shell and a confirm preset and migrates all three call sites.

## Decision Drivers
* One overlay contract; stop duplicating backdrop and panel markup.
* Dialog actions should always use `Button.astro`, never a raw `<button class="btn ...">`.

## Considered Options
* Shell (`Modal`) plus confirm preset (`ConfirmDialog`), the spec's Approach 1 (chosen).
* The spec does not list the other approaches.

## Decision Outcome
Chosen option: "Portable `Modal.astro` shell + `ConfirmDialog.astro` preset in `components/ui/`; parent owns visibility; Alpine expression props for dismiss/cancel/confirm; all dialog actions use `Button.astro`; `dismissible` opt-out for hard gates (finish-confirm, continue-session). ExitModal and ContinueSessionModal compose these primitives.", because One overlay contract; stop duplicating backdrop/panel markup.

### Consequences
* Good, because the three call sites share one backdrop and panel implementation.
* Neutral, because `dismissible` defaults to `true`, and the finish-confirm and continue-session dialogs pass `false` so the player must pick an action.
* Neutral, because `ExitModal.astro` becomes a thin `ConfirmDialog` wrapper and `ContinueSessionModal.astro` uses `Modal` with a custom `footer` slot.
* Neutral, because focus trap and return-focus management are out of scope.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Review applies the spec. `.astro` markup has no Vitest coverage (D101).

## Pros and Cons of the Options
### Shell plus confirm preset
* Good, because one contract replaces three near-copies of overlay markup.

### Other approaches
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-21

* `docs/superpowers/specs/2026-07-21-modal-confirm-dialog-design.md` (Context, brainstorming decisions, Scope): rebuilt Context, Decision Drivers, Considered Options and Consequences.
* `docs/superpowers/plans/2026-07-21-modal-confirm-dialog.md` (Modal and ConfirmDialog tasks): rebuilt Consequences.
* Commit `2e1c55e2` (PR #31 rebase reconcile, 2026-07-21; adds the D124 row): confirmed the origin.
* Applied in: `docs/superpowers/plans/2026-07-22-style-guide-alignment.md`, `docs/superpowers/plans/2026-07-22-score-input-buffer.md`.

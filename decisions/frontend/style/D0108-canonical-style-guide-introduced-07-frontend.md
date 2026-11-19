---
id: D0108
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, token, primitive, typography, font, motion]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Canonical style guide introduced (`07-Frontend/07-Style-Guide.md`) documenting the

## Context and Problem Statement
Token/primitive system existed only as unregistered tribal knowledge in one CSS file; writing the canonical doc surfaced concrete, fixable drift

## Decision Drivers
* The token and primitive system lived only inside one CSS file, unregistered in the Context Map and absent from the Frontend handbook.
* The audit found 3 `font-medium` uses in `.btn`, `.badge` and `.nav-item`, which the supplied concept forbids.
* `.badge-accent` reused `bg-success-muted` because no `--color-accent-muted` token existed.
* `NavBtn.astro` built its classes with a manual `.filter(Boolean).join(" ")`, an anti-pattern that `05-Astro-Components.md` already documents.

## Considered Options
* Replace `font-medium` with `font-semibold` in `.btn`, `.badge` and `.nav-item` (chosen).
* Replace `font-medium` with `font-normal`.

## Decision Outcome
Chosen option: "Canonical style guide introduced (`07-Frontend/07-Style-Guide.md`) documenting the dark-only token/primitive/typography/motion contract already implemented in `global.css`; audit fixed three `font-medium` violations (`.btn`/`.badge`/`.nav-item` → `font-semibold`), added `--color-accent-muted` (`.badge-accent` had been borrowing `success-muted`), and replaced `NavBtn.astro`'s manual class-merge with `cn()`", because Token/primitive system existed only as unregistered tribal knowledge in one CSS file; writing the canonical doc surfaced concrete, fixable drift.

### Consequences
* Good, because the spec registers the guide in the Context Map, the Handbook Index, the Frontend Agent Guide and the decisions ledger, so the contract is no longer unregistered.
* Good, because `.badge-accent` now uses the accent token, which keeps a future rebrand of either colour independent of the other.
* Neutral, because `Button.astro`, `Input.astro`, `BottomNav.astro` and `LogoutButton.astro` already complied and need no change.
* Neutral, because the change adds no Vitest coverage: it is a styling change, not a behaviour change.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`astro check` passes, and a manual browser check covers the bottom nav active and inactive states, a button and a badge. `scripts/check-context-map.sh` and `scripts/check-file-locations.sh` must both pass.

## Pros and Cons of the Options
### `font-semibold` for `.btn`, `.badge` and `.nav-item`
* Good, because these are emphasis contexts that still need visual weight.

### `font-normal` for `.btn`, `.badge` and `.nav-item`
* Bad, because the spec says it would flatten the button, badge and nav hierarchy the current design relies on.

## Evidence / More Information
Decided: 2026-07-16
Referenced by D0428's `Supersedes:` line.

* `docs/superpowers/specs/2026-07-16-style-guide-hardening-design.md` (Context, Design § 1–5, Testing, Context Maintenance): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Commit `24cb9997` (PR #26, 2026-07-16; adds the D108 row; its commit list covers the style guide, handbook index, agent guide and context-map registrations): confirmed the registrations named in Consequences.

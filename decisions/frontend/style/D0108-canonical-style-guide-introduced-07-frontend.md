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
<!-- backfill: pending -->

# Canonical style guide introduced (`07-Frontend/07-Style-Guide.md`) documenting the

## Context and Problem Statement
Token/primitive system existed only as unregistered tribal knowledge in one CSS file; writing the canonical doc surfaced concrete, fixable drift

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Canonical style guide introduced (`07-Frontend/07-Style-Guide.md`) documenting the dark-only token/primitive/typography/motion contract already implemented in `global.css`; audit fixed three `font-medium` violations (`.btn`/`.badge`/`.nav-item` → `font-semibold`), added `--color-accent-muted` (`.badge-accent` had been borrowing `success-muted`), and replaced `NavBtn.astro`'s manual class-merge with `cn()`", because Token/primitive system existed only as unregistered tribal knowledge in one CSS file; writing the canonical doc surfaced concrete, fixable drift.

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
Decided: 2026-07-16
Referenced by D0428's `Supersedes:` line.

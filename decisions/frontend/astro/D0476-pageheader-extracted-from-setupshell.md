---
id: D0476
status: accepted
date: 2026-10-21
origin: contemporaneous
original-date:
tags: [frontend/astro, layout, page, slot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `PageHeader` extracted from `SetupShell`

## Context and Problem Statement
the routine-detail redesign needs the same header as the setup screens plus a trailing action slot.

## Decision Drivers
* The routine-detail redesign needs the same header as the setup screens, plus a trailing action slot for its delete and edit buttons.
* `SetupShell` must keep its current look when no `actions` slot is passed.

## Considered Options
* Keep the header inline in `SetupShell`.
* Extract `PageHeader` and have `SetupShell` and the routine-detail page use it (chosen).

## Decision Outcome
Chosen option: "`components/layout/PageHeader.astro` (glass back link, centred title, optional `actions` slot) is the one page-header row; `SetupShell` and the routine-detail page both use it. Destructive-confirm styling: D477.", because the routine-detail redesign needs the same header as the setup screens plus a trailing action slot.

### Consequences
the style-token allowlist entry moved from `SetupShell` to `PageHeader`.

* Neutral, because the style-token allowlist entry moved from `SetupShell` to `PageHeader`.
* Neutral, because `PageHeader` keeps the `grid-cols-[40px_1fr_40px]` grid of `SetupShell` without an `actions` slot and uses `grid-cols-3` with one. It branches on `Astro.slots.has("actions")`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Keep the header inline in `SetupShell`
* Bad, because the routine-detail page would need its own copy of the header plus the action slot.

### Extract `PageHeader`
* Good, because one header row serves the setup screens and the routine-detail page.
* Good, because `SetupShell` has no visual change when no `actions` slot is passed.

## Evidence / More Information
Decided: 2026-10-21

* `docs/superpowers/specs/2026-10-21-routine-detail-redesign-design.md` (the `PageHeader.astro` bullets and the component table): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-10-21-routine-detail-redesign.md` (Task 5): confirmed the extraction scope.
* Commit `5a183856` (2026-10-21; adds the D476 row): rebuilt Consequences.

---
id: D0435
status: accepted
date: 2026-10-09
origin: contemporaneous
original-date:
tags: [frontend/style]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Setup rules card collapses to its title; setup form and slide match the nav

## Context and Problem Statement
reported on production after D430 — the two-line clamp still read as an open card, the 384px form sat narrower than the nav and slide, and the slide crowded the nav.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "a collapsed `InfoSection` shows only its title and a right-pointing chevron; tap reveals the description and turns the chevron down. `SetupShell`'s form drops `max-w-sm`, so setup fields span the same width as `BottomNav` and `SlideToStart`. `SlideToStart` sits 5.5rem above the nav's bottom edge (was 4.875rem), doubling its gap to the nav from about 10px to 20px.", because reported on production after D430 — the two-line clamp still read as an open card, the 384px form sat narrower than the nav and slide, and the slide crowded the nav.

### Consequences
markup only; `.astro` carries no unit test (D101). `open` keeps its always-expanded form.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-09
Supersedes: D430 (`InfoSection` two-line clamp clause only).

* Commit `edf2e5a1` (2026-10-09; subject "fix(setup): rules card collapses to title, full-width form, wider slide gap (D435)"): origin of the existing Context, Decision Outcome and Consequences text. It rebuilt no section here.

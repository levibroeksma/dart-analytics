---
id: D0425
status: accepted
date: 2026-10-07
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, token, font]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Homepage redesign, static pass behind `homeSnapshot()`

## Context and Problem Statement
ship the redesign now without blocking on new views. A single factory seam means the data pass swaps internals, not markup.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the home page follows the Claude Design "Darts Home" mock. It has a hero stat, a resume card, career tiles, a daily-average bar card, the weekly plan and a "Where you land" heatmap. The stat sections bind to `homeSnapshot()` (`lib/home/home-snapshot.data.ts`), a fixture-only Alpine factory whose returned shape is the contract for the later data pass. The weekly plan stays live on `homeWeek()`, restyled. Display values use Michroma (`font-display`), per the design. Bars are plain CSS, not Chart.js. The heatmap reuses `StatsDensityHeatmap` through `heatStamps()`. `LogoutButton` moves to `/profile`. The design's colours that no token covered became `--accent-deep`, `.home-feature-card` and `.home-day-today`.", because ship the redesign now without blocking on new views. A single factory seam means the data pass swaps internals, not markup.

### Consequences
home shows sample numbers and an always-visible resume card linking to `/games` until the data pass. Per-day done/missed markers and the weekly "2 of 4" ring are deferred, because they need weekly completion history. `.astro`/CSS carry no unit test (D101); `homeSnapshot()` derivations are tested.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-07
Referenced by D0442's `Supersedes:` line.

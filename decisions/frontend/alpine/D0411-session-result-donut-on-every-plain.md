---
id: D0411
status: accepted
date: 2026-10-04
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

# Session-result donut on every plain board game's `/statistics` page

## Context and Problem Statement
the `completion` section is `any`-tag and already served for every game; only the client hard-coded Score Training.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scoreCompletionSection()` becomes `gameCompletionSection()` (`GameCompletionSection.astro`). `periodSection()` resolves the page-level `game` to its game type (`gameTypeKey()`), reloads on `game` and `rangeKey`, and makes no request for an unknown game. `HeatmapStatsOverview.astro` mounts the donut in a two-column grid above the heatmap, so every `HEATMAP_ONLY_LAYOUTS` game gets it. Design and logic are Score Training's: completed against abandoned, never-started left out, abandon rate as abandoned over started.", because the `completion` section is `any`-tag and already served for every game; only the client hard-coded Score Training.

### Consequences
no API or schema change. The donut fills the left cell only; the right cell is empty until another stat card lands there.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D401, D402, D410).

---
id: D0387
status: accepted
date: 2026-10-02
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

# Score Training heatmap section renders a density layer, not cell squares

## Context and Problem Statement
the cell squares read as a scatter plot, not a heatmap; the owner asked for the smooth-blob look of common sports heatmaps. Overlapping radial stamps on an alpha canvas, then a colour lookup, is the standard way to get that from already-binned cells without a second query or a client-side KDE over raw coordinates. The SQL grid stays the only data contract, so the section shares the cache entry and version of the existing `heatmap` section.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Score Training's dedicated layout gains a heatmap section (`ScoreHeatmapSection.astro`, `scoreHeatmapSection()`) that fetches `heatmap` un-bucketed over the score trend's *current* period only (`heatmapWindow()`: the trend's boundary to now; the trend's all-time start for all time), with no target. The `HEATMAP_CELL_MM` cells are drawn as a density layer: `heatStamps()` turns each cell into a radial stamp of radius `HEAT_RADIUS_CELLS` cells with alpha `HEAT_PEAK_ALPHA · √(darts / busiest cell)`, so a lone cell reads warm and only overlapping cells reach the hot end; `drawHeatmap()` accumulates the stamps' alpha on a `<canvas>` over `DartBoard.astro` and recolours it through the module's ramp (blue → green → yellow → red, square-root lift, capped at `HEAT_MAX_ALPHA`). `StatsDensityHeatmap.astro` is a sibling of `StatsHeatmap.astro`, whose per-cell squares stay for the generic cards.".

### Consequences
the ramp is a deliberate exception to the `dataviz` skill's single-hue sequential rule — the owner's explicit request and the convention of the genre; it is not the pattern for other sequential encodings in the app. The canvas backing is a fixed 512 px square, scaled by CSS; the generic `StatsHeatmap.astro` is unchanged. Canvas drawing is covered through a fake `HeatCanvasContext`; `.astro` markup is untested (D101).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-02
Supersedes: none (extends D385, D386).

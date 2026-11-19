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

# Score Training heatmap section renders a density layer, not cell squares

## Context and Problem Statement
the cell squares read as a scatter plot, not a heatmap; the owner asked for the smooth-blob look of common sports heatmaps. Overlapping radial stamps on an alpha canvas, then a colour lookup, is the standard way to get that from already-binned cells without a second query or a client-side KDE over raw coordinates. The SQL grid stays the only data contract, so the section shares the cache entry and version of the existing `heatmap` section.

## Decision Drivers
* The owner asked for the smooth-blob look of common sports heatmaps, because cell squares read as a scatter plot.
* The SQL grid stays the only data contract, so the section shares the cache entry and version of the existing `heatmap` section.
* No second query and no client-side KDE over raw coordinates.

## Considered Options
* Overlapping radial stamps on an alpha canvas, then a colour lookup, from the already-binned cells (chosen).
* Keep the per-cell squares of `StatsHeatmap.astro`.
* A client-side KDE over raw coordinates, or a second query.

## Decision Outcome
Chosen option: "Score Training's dedicated layout gains a heatmap section (`ScoreHeatmapSection.astro`, `scoreHeatmapSection()`) that fetches `heatmap` un-bucketed over the score trend's *current* period only (`heatmapWindow()`: the trend's boundary to now; the trend's all-time start for all time), with no target. The `HEATMAP_CELL_MM` cells are drawn as a density layer: `heatStamps()` turns each cell into a radial stamp of radius `HEAT_RADIUS_CELLS` cells with alpha `HEAT_PEAK_ALPHA · √(darts / busiest cell)`, so a lone cell reads warm and only overlapping cells reach the hot end; `drawHeatmap()` accumulates the stamps' alpha on a `<canvas>` over `DartBoard.astro` and recolours it through the module's ramp (blue → green → yellow → red, square-root lift, capped at `HEAT_MAX_ALPHA`). `StatsDensityHeatmap.astro` is a sibling of `StatsHeatmap.astro`, whose per-cell squares stay for the generic cards.".

### Consequences
the ramp is a deliberate exception to the `dataviz` skill's single-hue sequential rule — the owner's explicit request and the convention of the genre; it is not the pattern for other sequential encodings in the app. The canvas backing is a fixed 512 px square, scaled by CSS; the generic `StatsHeatmap.astro` is unchanged. Canvas drawing is covered through a fake `HeatCanvasContext`; `.astro` markup is untested (D101).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `8bcf24bc` adds unit tests for the density module, the canvas module and the canvas data factory: `app/tests/modules/stats/sections/heatmap-density.module.test.ts`, `app/tests/modules/ui/heatmap-canvas.module.test.ts` and `app/tests/lib/ui/heatmap-canvas.data.test.ts`.

## Pros and Cons of the Options
### Radial stamps on an alpha canvas
* Good, because a lone cell reads warm and only overlapping cells reach the hot end, through alpha `HEAT_PEAK_ALPHA · √(darts / busiest cell)`.
* Good, because it needs no second query and no client-side KDE.
* Bad, because the colour ramp breaks the `dataviz` single-hue sequential rule.

### Per-cell squares
* Bad, because the Context says they read as a scatter plot, not a heatmap.

## Evidence / More Information
Decided: 2026-10-02
Supersedes: none (extends D385, D386).

* Commit `8bcf24bc` (2026-10-02, adds the D387 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons from the row's Reason and Consequences and the commit's tests.
* No spec or plan in `docs/superpowers/` cites D387.

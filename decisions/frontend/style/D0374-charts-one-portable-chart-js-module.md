---
id: D0374
status: accepted
date: 2026-09-30
origin: contemporaneous
original-date:
tags: [frontend/style, token, glass, surface]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Charts: one portable Chart.js module, glass containers with plain canvases, colors named after CardWrapper's

## Context and Problem Statement
the portable-kit contract (`04-Modules-And-OOP.md`) forbids tokens in `modules/ui`, so the theme is injected. The dataviz validator fails all nine names together on adjacent-pair CVD (`teal`/`emerald`, `blue`/`sky`, `fuchsia`/`rose` are near-twins), so only six are default and the rest are explicit. `CardWrapper`'s free-color escape hatch cannot be validated and is not part of the chart contract. Chart.js breaks behind Alpine's proxy, so the factory passes a JSON-plain copy.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the statistics charts share one module. `modules/ui/chart.module.ts` (`buildConfig`, `ChartView`, HTML tooltip) takes an injected `ChartTheme` and imports no store, token or Alpine; `lib/ui/chart-theme.ts` reads `--chart-<name>` tokens; `lib/ui/chart.data.ts` holds the instance in a closure; `components/ui/Chart.astro` is the glass container with a legend and a table view. V1 is line and bar. A series' color is one of `CardWrapper.astro`'s color names (`sky, violet, rose, teal, emerald, amber, orange, fuchsia, blue`); the default assignment order is `sky, orange, emerald, violet, rose, amber` and is never cycled; a repeated or missing color is a `RangeError`. The canvas is plain; the containers are glass.".

### Consequences
`chart.js` is a new dependency, loaded by dynamic import on the statistics page only. Pie/donut and datalabels are deferred until a section needs them. The `--chart-<name>` values are tuned for marks on the black surface and differ from `CardWrapper`'s wash tints; a test keeps the name lists equal. `scoring-trend` is the first consumer; other sections and the heatmap are later cycles.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-30

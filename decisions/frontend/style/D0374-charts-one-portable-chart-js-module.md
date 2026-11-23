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

# Charts: one portable Chart.js module, glass containers with plain canvases, colors named after CardWrapper's

## Context and Problem Statement
the portable-kit contract (`04-Modules-And-OOP.md`) forbids tokens in `modules/ui`, so the theme is injected. The dataviz validator fails all nine names together on adjacent-pair CVD (`teal`/`emerald`, `blue`/`sky`, `fuchsia`/`rose` are near-twins), so only six are default and the rest are explicit. `CardWrapper`'s free-color escape hatch cannot be validated and is not part of the chart contract. Chart.js breaks behind Alpine's proxy, so the factory passes a JSON-plain copy.

## Decision Drivers
* The portable-kit contract (`04-Modules-And-OOP.md`) forbids tokens in `modules/ui`, so the theme is injected.
* The dataviz validator fails all 9 color names together on adjacent-pair CVD, since `teal`/`emerald`, `blue`/`sky` and `fuchsia`/`rose` are near-twins.
* Chart.js breaks behind Alpine's proxy.
* `CardWrapper`'s free-color escape hatch cannot be validated.

## Considered Options
* A shared Chart.js module with an injected `ChartTheme`, line and bar V1, glass containers and plain canvases (chosen).
* Pie/donut and `chartjs-plugin-datalabels` (deferred).
* `CardWrapper`'s "any CSS color" escape hatch for series colors (excluded from the chart contract).

## Decision Outcome
Chosen option: "the statistics charts share one module. `modules/ui/chart.module.ts` (`buildConfig`, `ChartView`, HTML tooltip) takes an injected `ChartTheme` and imports no store, token or Alpine; `lib/ui/chart-theme.ts` reads `--chart-<name>` tokens; `lib/ui/chart.data.ts` holds the instance in a closure; `components/ui/Chart.astro` is the glass container with a legend and a table view. V1 is line and bar. A series' color is one of `CardWrapper.astro`'s color names (`sky, violet, rose, teal, emerald, amber, orange, fuchsia, blue`); the default assignment order is `sky, orange, emerald, violet, rose, amber` and is never cycled; a repeated or missing color is a `RangeError`. The canvas is plain; the containers are glass.".

### Consequences
`chart.js` is a new dependency, loaded by dynamic import on the statistics page only. Pie/donut and datalabels are deferred until a section needs them. The `--chart-<name>` values are tuned for marks on the black surface and differ from `CardWrapper`'s wash tints; a test keeps the name lists equal. `scoring-trend` is the first consumer; other sections and the heatmap are later cycles.

* Good, because a series color uses the `CardWrapper` color names, so a card and the chart inside it can share one name.
* Good, because Chart.js loads by dynamic import on the statistics page only.
* Bad, because `chart.js` is a new dependency.
* Neutral, because the `--chart-<name>` values differ from `CardWrapper`'s wash tints and a test keeps the name lists equal.
* Neutral, because `scoring-trend` is the first consumer; other sections and the heatmap are later cycles.

### Confidence
Rationale unknown — no source found.

### Revisit When
Pie/donut and datalabels are deferred until a section needs them.

### Confirmation
`app/tests/lib/ui/chart-tokens.test.ts` asserts the `--chart-<name>` token names equal `CardWrapper.astro`'s `tintPresets` keys. The spec also ran all 9 color names through the dataviz validator before merge.

## Pros and Cons of the Options
### Shared module, injected theme, glass containers with plain canvases
* Good, because the module imports no store, token or Alpine, which fits the portable-kit contract.
* Good, because the closure-held instance and a plain copy keep Chart.js clear of Alpine's proxy.

### Free colors from `CardWrapper`
* Bad, because a free color cannot be validated.

## Evidence / More Information
Decided: 2026-09-30

* `docs/superpowers/specs/2026-09-29-chart-module-design.md` (Module contract, Tokens, Component and Alpine wiring, Testing, Risks): rebuilt Decision Drivers, Considered Options, Consequences, Revisit When, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-09-30-chart-module.md` and commit `b44ea3fc` (PR #665, 2026-09-30; adds the D374 row): the plan resolves token values and `DEFAULT_ORDER`.
* Applied in: `docs/superpowers/plans/2026-10-08-brand-tokens.md`.

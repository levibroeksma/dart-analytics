# Chart module — design

Date: 2026-09-29. Status: draft for review. Sub-project 1 of 2; sub-project 2
(per-game stats curation, which sections become charts) gets its own cycle.

## Goal

A reusable Chart.js module for the statistics page, with glass containers and
plain, readable canvases. Proven by one real consumer: the `scoring-trend`
card on Score Training.

## Scope

In:
- Line and bar charts.
- Portable-kit layout (`04-Modules-And-OOP.md` §Portable UI Kit).
- Chart tokens in `global.css`, validated with the dataviz validator.
- `scoring-trend` card: monthly text rows replaced by a line chart.

Out (deferred):
- Pie/donut, `chartjs-plugin-datalabels`.
- Heatmap changes (own cycle).
- Any other section's chart; choosing which sections show per game.
- Stacked/multi-axis charts. One y-axis only (dataviz rule).

Assumptions (confirmed): dark-only app; Alpine-driven; the canvas need not be
glass, its containers are.

## Files

| File | Role |
| ---- | ---- |
| `app/src/modules/ui/chart.module.ts` | `ChartView` + pure `buildConfig`. No Alpine, stores or tokens. |
| `app/src/modules/ui/types.ts` (or `interfaces.ts`) | `ChartSpec`, `ChartSeries`, `ChartTheme`. |
| `app/src/components/ui/Chart.astro` | Glass container, canvas, HTML legend, table view. Paired with the module. |
| `app/src/lib/ui/chart.data.ts` | Alpine factory `chartData`. Registered in `register-ui-data.ts`. |
| `app/src/lib/ui/chart-theme.ts` | App adapter: tokens → `ChartTheme`. |
| `app/src/styles/global.css` | `--chart-<name>` per `CardWrapper` color name, chart grid token. |
| `app/src/stores/game-stats.store.ts` | `scoringTrendChart` getter. |
| `app/src/components/layout/statistics/GameSectionCards.astro` | Scoring trend card swaps rows for `<Chart>`. |

New dependency: `chart.js` only.

## Module contract

```ts
type ChartKind = "line" | "bar";

interface ChartSeries {
  key: string;                 // stable identity; color follows it
  label: string;
  data: (number | null)[];     // null = gap
  color?: TintName;            // named color; default = DEFAULT_ORDER[position in `series`]
}

type TintName =                // the names `CardWrapper.astro`'s `color` prop accepts
  | "sky" | "violet" | "rose" | "teal" | "emerald"
  | "amber" | "orange" | "fuchsia" | "blue";

interface ChartSpec {
  kind: ChartKind;
  labels: string[];
  series: ChartSeries[];
  ariaLabel: string;
  format?: (n: number) => string;   // axis + tooltip value text
}

interface ChartTheme {
  palette: Record<TintName, string>;  // canvas-safe color per name
  order: TintName[];           // fixed default assignment order, validator-checked
  text: string;
  grid: string;
  font: string;
  tooltipClass: string;        // injected class string for the HTML tooltip
  reducedMotion: boolean;
}

class ChartView {
  constructor(canvas: HTMLCanvasElement, theme: ChartTheme, deps?: ChartDeps);
  mount(spec: ChartSpec): Promise<void>;
  update(spec: ChartSpec): void;
  destroy(): void;
}
```

- `buildConfig(spec, theme)` is pure and returns the Chart.js config. It is the
  unit-tested surface.
- `ChartDeps` injects `loadChartJs` (default: dynamic `import("chart.js")`),
  so tests never need a DOM or the library.
- Only line/bar pieces are registered (`LineController`, `BarController`,
  `LineElement`, `PointElement`, `BarElement`, `CategoryScale`, `LinearScale`,
  `Tooltip`, `Filler`). The Chart.js legend and title plugins stay off.
- Colors: series color = `theme.palette[series.color ?? theme.order[index]]`,
  never cycled. A series with no `color` past the end of `order`, or two series
  resolving to the same name, is a `RangeError` at `buildConfig`. A series
  names its color explicitly to keep it when a filter drops sibling series
  (color follows the entity, never its rank).
- The color names are the `CardWrapper.astro` `color` names, so a card and
  the chart inside it can share one name (`<CardWrapper color="teal">` +
  `color: "teal"`). `CardWrapper`'s "any CSS color" escape hatch is not part of
  the chart contract: a free color cannot be validated.

### Marks (dataviz specs)

- Line: 2px stroke, `spanGaps: false`, faint gradient area under a single
  series (a series-color-to-transparent fill; two or more series get no area).
  Point markers ≥ 8px only when the series has ≤ 12 points; otherwise hidden,
  shown on hover.
- Bar: 4px rounded data end anchored at the baseline, 2px surface gap between
  bars.
- Grid and axes recessive: `theme.grid` at low alpha, no axis border, y grid
  only. Tick text in `theme.text`. Text never wears the series color.
- No animation under `theme.reducedMotion`; otherwise ≤ 300ms ease-out.
- Tooltip: Chart.js `external` handler drives one absolutely positioned HTML
  element carrying `theme.tooltipClass`. Values via `spec.format`.
- Responsive with `maintainAspectRatio: false`; the container owns the height.

## Theme adapter

`chart-theme.ts` builds a `ChartTheme` from `global.css` tokens:

- Reads each token through `getComputedStyle(document.documentElement)`.
- A CSS color (`oklch(...)`, `color-mix(...)`) is normalized to `rgb()`/`rgba()`
  by painting one pixel on a scratch canvas and reading it back, so gradients
  and alpha stops are safe in every canvas implementation. Pure parsing lives in
  a testable function; the canvas readback is injected.
- `tooltipClass` = `"glass-strong rounded-lg px-3 py-2 text-xs text-foreground"`.
- `reducedMotion` from `matchMedia("(prefers-reduced-motion: reduce)")`.

### Tokens

`global.css` gains one token per `TintName`: `--chart-sky`, `--chart-violet`,
`--chart-rose`, `--chart-teal`, `--chart-emerald`, `--chart-amber`,
`--chart-orange`, `--chart-fuchsia`, `--chart-blue`, plus a grid token.

- Values are tuned for marks on the `--surface` black, not copied from
  `CardWrapper`'s `tintPresets`: those are wash tints, and some fail the
  dataviz lightness band as marks (e.g. `violet` at 45% lightness). The hue
  stays recognizably the card's hue.
- `DEFAULT_ORDER` (sky first) is chosen so adjacent pairs pass the validator's
  CVD separation; the other names stay available by explicit `color`.
- All nine names run through the dataviz validator against `--surface`
  (`--mode dark`) before merge; a FAIL blocks. A name pair too close to use
  together is noted in `07-Style-Guide.md` rather than silently allowed.
- Style rules: semantic tokens only, no raw palette utilities
  (`07-Style-Guide.md`).
- `CardWrapper.astro` is not modified; it keeps its inline `tintPresets`. The
  name list exists in two places (presets, chart tokens); a unit test asserts
  the chart token names equal the `tintPresets` keys parsed from the
  component source, so they cannot drift.

## Component and Alpine wiring

`Chart.astro` props: `title`, `kind`, `specExpr`, `heightClass` (default
`h-48`), `class`. Markup:

1. `glass rounded-2xl p-4` wrapper, `h2` title (`text-sm text-foreground`).
2. Fixed-height canvas box with `role="img"` and `:aria-label`.
3. HTML legend, `x-show` only when `spec.series.length >= 2`: colored swatch +
   label in `text-muted-foreground`.
4. `<details>` table view: labels × series. Always rendered, so it is the
   fallback when Chart.js cannot load.

`specExpr` is an Alpine expression that yields a plain `ChartSpec` (same
pattern as `StatsHeatmap`'s `cellsExpr`). `chartData`:

- Holds the `ChartView` in a closure; Alpine deep-proxies `this.*` and would
  break Chart.js (`toggle.data.ts` precedent, `07-Style-Guide.md` reactive
  mirror rule).
- `init`: builds the theme, `mount(clone(spec))`; `$watch` on the spec
  expression calls `update(clone(spec))`. The clone strips Alpine proxies
  (`Alpine.raw` + structured copy) before Chart.js sees the data.
- `destroy`: `ChartView.destroy()`.
- Load or mount failure is swallowed: the canvas stays empty, the table view
  stays. No throw, no toast.
- `format` is not serializable across the clone; the factory takes a named
  formatter key (`"one-decimal"`, `"percent"`) resolved from a small map in
  `chart.data.ts`.

## First consumer

`game-stats.store.ts` `scoringTrendChart` getter:

- `labels`: month labels from `series.buckets[].start`, same
  `toLocaleDateString(undefined, { month: "short", year: "numeric" })` the
  card uses today.
- Series `three-dart-average` (`color: "sky"`) always; `first-nine-average`
  (`color` from the default order) only when at least one bucket has first-nine darts. Buckets below
  the existing sample rule stay `null` (gap), not zero.
- `ariaLabel`: "3-dart average per month".
- Returns a fresh plain object every read.

`GameSectionCards.astro`: inside the `scoring-trend` card, the
`x-for="row in gameView.scoringTrendRows"` block is replaced by the chart. The
two stat tiles and the 100+/140+/180 line stay. Card wrapper: the chart's own
glass container replaces the outer card only if that keeps one glass level
(no glass-in-glass); otherwise the chart renders with a `flat` prop that omits
its wrapper. Decided in the plan.

Also applies to the Routines tab's GAME steps: the shared component feeds it.

## Testing

Vitest runs in `node`, no DOM, so DOM edges are injected.

- `buildConfig`: line vs bar options, named/default color mapping, duplicate
  and exhausted color `RangeError`, gap handling, marker rule at 12 points,
  single-series area vs multi-series none, reduced-motion animation off.
- Token-name parity: `--chart-<name>` tokens in `global.css` equal
  `CardWrapper.astro`'s `tintPresets` keys.
- Theme color normalization: parser cases with an injected readback.
- `ChartView`: lifecycle with a fake Chart constructor (mount, update calls
  `update()`, destroy destroys, load failure resolves without throwing).
- `chartData`: closure-held instance, failure swallowed (fake view).
- Store getter: labels, series presence rule, nulls, plain-object identity.
- Style/gate scripts: `scripts/check-style-tokens.sh`, fallow gate, `astro
  check` per `run-all-gates`.

## Docs and decisions (same PR)

- `04-Modules-And-OOP.md`: chart contract under §Portable UI Kit (deps
  injection, dynamic import, no tokens in the module).
- `07-Style-Guide.md`: chart tokens, glass-container/plain-canvas rule.
- `08-Component-Inventory.md`: `Chart.astro`.
- `02-Folder-Structure.md`: only if a new folder appears (none planned).
- `decisions/frontend.md`: one new block (next free `D###`): chart module
  layout, line/bar V1 scope, injected theme, dataviz validator gate.
- `00-File-Inventory.md` rows, `00-Context-Map-History.md` entry, context-pack
  budget re-check (`scripts/check-context-budget.sh`).
- `10-Statistics/01-Section-Catalog.md`: no change (section set unchanged).
- Run `context-maintenance` and `run-all-gates` before done.

## Risks

- **Alpine proxy vs Chart.js:** mitigated by the closure + plain clone; a test
  covers that no proxy reaches the config.
- **Canvas color parsing:** `oklch()` in canvas gradients is not universal;
  the readback normalization is the fix and is unit-tested at the parser.
- **Bundle:** Chart.js is behind a dynamic import; only the statistics page
  pulls the chunk.
- **Glass-in-glass** on the scoring card: resolved in the plan (see First
  consumer).

## Open items for the plan (not blocking the design)

- Exact `--chart-<name>` oklch values and `DEFAULT_ORDER` (validator output
  decides).
- Scoring trend series colors: `three-dart-average` `sky`, `first-nine-average`
  the next validated name (default order).
- Where `ChartSpec`/`ChartTheme` live (`types.ts` vs `interfaces.ts`).
- `flat` prop vs replacing the outer card.

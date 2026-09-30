# Chart Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reusable Chart.js module (line + bar) with glass containers, proven by replacing the Scoring trend card's monthly text rows with a line chart.

**Architecture:** Portable-kit layout. A pure-TS `ChartView` + `buildConfig` in `modules/ui/chart.module.ts` takes an injected `ChartTheme` and loads Chart.js lazily. `lib/ui/chart-theme.ts` reads `--chart-<name>` tokens into that theme. `lib/ui/chart.data.ts` is the Alpine factory (instance held in a closure). `components/ui/Chart.astro` is the glass container with legend and table view. Chart color names are the `CardWrapper.astro` color names.

**Tech Stack:** Chart.js (new, only dependency), Astro, Alpine.js, Tailwind v4, Vitest (`node` env, no DOM — DOM edges are injected).

**Spec:** `docs/superpowers/specs/2026-09-29-chart-module-design.md`

## Global Constraints

- Only new dependency: `chart.js`. No `chartjs-plugin-datalabels`. No pie/donut.
- Chart kinds: `"line" | "bar"`. One y-axis only. No stacked charts.
- Color names are exactly `sky, violet, rose, teal, emerald, amber, orange, fuchsia, blue` (the `CardWrapper.astro` `tintPresets` keys). `CHART_ORDER` = `sky, orange, emerald, violet, rose, amber`. Colors are never cycled; a missing or repeated color is a `RangeError` in `buildConfig`.
- `modules/ui/*` imports no stores, no `@client/api`, no app tokens, no Alpine. The theme is injected.
- Exported types live in `app/src/modules/ui/types.ts` (type aliases), consumed via `@modules/types` (type-barrel gate). No `export type`/`export interface` in implementation files.
- No `//` or `/* */` comments inside function/method bodies; JSDoc above declarations only, no decision history (`app/CLAUDE.md` §Comments).
- Semantic tokens only in markup; no raw palette utilities, no `font-medium`, no `!` modifier, `cn()` not `class:list`, `{...props}` not `{...rest}`, every `x-show` has `x-cloak`, no HTML comments in template regions.
- Marks: line 2px, markers 8px only when ≤ 12 labels, bars 4px rounded data end with a 2px surface gap, recessive y-grid only, animation ≤ 300ms and off under `prefers-reduced-motion`, HTML glass tooltip via Chart.js `external`.
- Tests mirror `app/src/` under `app/tests/`; Astro markup is not unit-tested (D101). Red → green: write the test, see it fail for the right reason, then implement.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work stays on branch `feat/chart-module`.

## Review Focus

- All-null series (a bucket range with no darts): the line draws nothing and nothing throws — pinned in Task 2 (`buildConfig`) and Task 6 (store).
- A single bucket (one month of data): one visible point with a marker, not an invisible line — pinned in Task 2.
- A filter drops a sibling series: the surviving series keeps its named color — pinned in Task 2.
- Chart.js fails to load, or the canvas is missing: no throw, the table view remains — pinned in Tasks 3 and 5.
- An Alpine proxy reaches Chart.js and breaks it: the factory passes a JSON-plain copy — pinned in Task 5.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `app/src/modules/ui/types.ts` (modify) | `TintName`, `ChartKind`, `ChartSeries`, `ChartSpec`, `ChartFormatter`, `ChartTheme`, `ChartInstance`, `ChartCtor`, `ChartDeps`, `ChartTooltipModel`, `ChartTooltipHandler`, `ChartThemeEnv` |
| `app/src/modules/ui/chart.module.ts` (create) | `buildConfig` (pure), `createTooltip`, `ChartView` |
| `app/src/lib/ui/chart-theme.ts` (create) | `TINT_NAMES`, `CHART_ORDER`, `TOOLTIP_CLASS`, `buildChartTheme`, `readChartTheme` |
| `app/src/lib/ui/chart.data.ts` (create) | `chartData` Alpine factory, `CHART_FORMATTERS` |
| `app/src/lib/client/alpine/register-ui-data.ts` (modify) | register `chartData` |
| `app/src/components/ui/Chart.astro` (create) | glass container, canvas, legend, table view |
| `app/src/styles/global.css` (modify) | `--chart-<name>` ×9, `--chart-grid` |
| `app/src/stores/game-stats.store.ts` (modify) | `scoringTrendChart` getter; remove `scoringTrendRows` |
| `app/src/components/layout/statistics/GameSectionCards.astro` (modify) | Scoring trend card uses `<Chart flat>` |
| `app/tests/lib/ui/chart-tokens.test.ts` (create) | token-name parity with `CardWrapper.astro` |
| `app/tests/modules/ui/chart.module.test.ts` (create) | `buildConfig`, tooltip, `ChartView` |
| `app/tests/lib/ui/chart-theme.test.ts` (create) | theme building |
| `app/tests/lib/ui/chart.data.test.ts` (create) | factory |
| `app/tests/stores/game-stats.store.test.ts` (modify) | `scoringTrendChart` |

---

### Task 1: Dependency, types, color tokens

**Files:**
- Modify: `app/package.json`, `app/package-lock.json` (via npm)
- Modify: `app/src/modules/ui/types.ts`
- Modify: `app/src/styles/global.css` (`:root` block, after `--success-muted`)
- Test: `app/tests/lib/ui/chart-tokens.test.ts`

**Interfaces:**
- Produces: the `Chart*` / `TintName` types (signatures below) and the ten CSS tokens. Every later task imports the types from `@modules/types`.

- [ ] **Step 1: Install Chart.js**

Run: `cd app && npm install chart.js`
Expected: `chart.js` added to `dependencies` in `app/package.json`.

- [ ] **Step 2: Write the failing parity test**

Create `app/tests/lib/ui/chart-tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../../src/styles/global.css", import.meta.url),
  "utf8",
);
const card = readFileSync(
  new URL("../../../src/components/ui/CardWrapper.astro", import.meta.url),
  "utf8",
);

function cardTintNames(): string[] {
  const block = card.match(/const tintPresets[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error("tintPresets not found in CardWrapper.astro");
  return [...block[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
}

function chartTokenNames(): string[] {
  return [...css.matchAll(/^\s*--chart-(?!grid\b)(\w+):/gm)].map((m) => m[1]);
}

describe("chart color tokens", () => {
  it("has one --chart-<name> token per CardWrapper color name", () => {
    expect(chartTokenNames().sort()).toEqual(cardTintNames().sort());
  });

  it("has a grid token", () => {
    expect(css).toMatch(/^\s*--chart-grid:/m);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd app && npx vitest run tests/lib/ui/chart-tokens.test.ts`
Expected: FAIL — `chartTokenNames()` is `[]`, expected nine names.

- [ ] **Step 4: Add the tokens**

In `app/src/styles/global.css`, inside the first `:root { ... }` block, after the `--success-muted` line, add:

```css
  --chart-sky: oklch(66% 0.127 240.5);
  --chart-violet: oklch(67% 0.145 286.8);
  --chart-rose: oklch(63.8% 0.175 12.4);
  --chart-teal: oklch(64.7% 0.108 187.7);
  --chart-emerald: oklch(65.7% 0.139 157.5);
  --chart-amber: oklch(67% 0.143 73.2);
  --chart-orange: oklch(62.2% 0.173 40.1);
  --chart-fuchsia: oklch(64.9% 0.2 325.2);
  --chart-blue: oklch(57.5% 0.177 267.1);
  --chart-grid: oklch(100% 0 0 / 0.06);
```

- [ ] **Step 5: Run the parity test**

Run: `cd app && npx vitest run tests/lib/ui/chart-tokens.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Validate the palette with the dataviz validator**

`$DATAVIZ_DIR` is the `dataviz` skill's base directory (shown when the skill is invoked). The hexes are the sRGB values of the oklch tokens above.

```bash
node "$DATAVIZ_DIR/scripts/validate_palette.js" "#3a9bd8,#d95926,#2faa6f,#9085e9,#e0546e,#c98500" --mode dark --surface "#000000"
node "$DATAVIZ_DIR/scripts/validate_palette.js" "#3a9bd8,#d95926,#2faa6f,#9085e9,#e0546e,#c98500,#1aa39a,#c95ad0,#4a6fe0" --mode dark --surface "#000000"
```

Expected, first run (the default order): all five checks PASS (worst adjacent CVD ΔE 8.0). Second run (all nine names): lightness band, chroma floor, normal-vision floor and contrast PASS; the adjacent CVD check FAILs at `#4a6fe0↔#c95ad0` — expected, because `teal`/`fuchsia`/`blue` are near-twins of `emerald`/`rose`/`sky` and are explicit-only. If the first run FAILs, re-step the failing hex (keep the hue), update both the token and this step's hex, and re-run before continuing. Paste both outputs into the PR description.

- [ ] **Step 7: Add the chart types**

Append to `app/src/modules/ui/types.ts`, and add this import as the file's first line:

```ts
import type { ChartConfiguration } from "chart.js";
```

```ts
export type TintName =
  | "sky"
  | "violet"
  | "rose"
  | "teal"
  | "emerald"
  | "amber"
  | "orange"
  | "fuchsia"
  | "blue";

export type ChartKind = "line" | "bar";

export type ChartFormatter = (value: number) => string;

export type ChartSeries = {
  key: string;
  label: string;
  data: (number | null)[];
  color?: TintName;
};

export type ChartSpec = {
  kind: ChartKind;
  labels: string[];
  series: ChartSeries[];
  ariaLabel: string;
  format?: ChartFormatter;
};

export type ChartTheme = {
  palette: Record<TintName, string>;
  order: TintName[];
  surface: string;
  text: string;
  grid: string;
  font: string;
  tooltipClass: string;
  reducedMotion: boolean;
};

export type ChartInstance = {
  data: { labels?: unknown; datasets: unknown[] };
  options: unknown;
  update(): void;
  destroy(): void;
};

export type ChartCtor = new (
  canvas: HTMLCanvasElement,
  config: ChartConfiguration,
) => ChartInstance;

export type ChartDeps = { loadChartJs: () => Promise<ChartCtor> };

export type ChartTooltipModel = {
  opacity: number;
  caretX: number;
  caretY: number;
  title: string[];
  dataPoints: {
    dataset: {
      label?: string;
      backgroundColor?: unknown;
      borderColor?: unknown;
    };
    parsed: { y: number | null };
  }[];
};

export type ChartTooltipHandler = (context: {
  tooltip: ChartTooltipModel;
}) => void;

export type ChartThemeEnv = {
  readVar(name: string): string;
  readFont(): string;
  readPixel(css: string): readonly number[];
  prefersReducedMotion(): boolean;
};
```

- [ ] **Step 8: Check types and gates**

Run: `cd app && npx astro check 2>&1 | tail -5` and `cd .. && bash scripts/check-type-barrels.sh && bash scripts/check-style-tokens.sh`
Expected: 0 errors / 0 warnings / 0 hints; both scripts print `OK`.

- [ ] **Step 9: Commit**

```bash
git add app/package.json app/package-lock.json app/src/modules/ui/types.ts app/src/styles/global.css app/tests/lib/ui/chart-tokens.test.ts
git commit -m "feat(ui): chart types and color tokens

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `buildConfig` — the pure Chart.js config

**Files:**
- Create: `app/src/modules/ui/chart.module.ts`
- Test: `app/tests/modules/ui/chart.module.test.ts`

**Interfaces:**
- Consumes: `ChartSpec`, `ChartTheme`, `ChartSeries`, `ChartFormatter`, `ChartTooltipHandler`, `TintName` from `./types` (Task 1).
- Produces: `buildConfig(spec: ChartSpec, theme: ChartTheme, external?: ChartTooltipHandler): ChartConfiguration` from `@modules/ui/chart.module`. Throws `RangeError` when a series has no color left in `theme.order` or two series resolve to the same name.

- [ ] **Step 1: Write the failing tests**

Create `app/tests/modules/ui/chart.module.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { buildConfig } from "@modules/ui/chart.module";
import type { ChartSpec, ChartTheme } from "@modules/types";

const theme: ChartTheme = {
  palette: {
    sky: "rgb(58, 155, 216)",
    violet: "rgb(144, 133, 233)",
    rose: "rgb(224, 84, 110)",
    teal: "rgb(26, 163, 154)",
    emerald: "rgb(47, 170, 111)",
    amber: "rgb(201, 133, 0)",
    orange: "rgb(217, 89, 38)",
    fuchsia: "rgb(201, 90, 208)",
    blue: "rgb(74, 111, 224)",
  },
  order: ["sky", "orange", "emerald", "violet", "rose", "amber"],
  surface: "rgb(0, 0, 0)",
  text: "rgb(179, 179, 179)",
  grid: "rgba(255, 255, 255, 0.06)",
  font: "Montserrat",
  tooltipClass: "glass-strong",
  reducedMotion: false,
};

function spec(over: Partial<ChartSpec> = {}): ChartSpec {
  return {
    kind: "line",
    labels: ["Jan", "Feb"],
    series: [{ key: "a", label: "A", data: [1, 2] }],
    ariaLabel: "chart",
    ...over,
  };
}

type Dataset = Record<string, unknown>;
type Options = {
  animation: unknown;
  plugins: {
    legend: { display: boolean };
    title: { display: boolean };
    tooltip: { enabled: boolean; external: unknown };
  };
  scales: {
    x: { grid: { display: boolean } };
    y: {
      beginAtZero: boolean;
      grid: { color: string };
      ticks: { callback: (value: number) => string };
    };
  };
};

function dataset(config: ReturnType<typeof buildConfig>, i: number): Dataset {
  return config.data.datasets[i] as unknown as Dataset;
}

function options(config: ReturnType<typeof buildConfig>): Options {
  return config.options as unknown as Options;
}

function seriesOf(count: number): ChartSpec["series"] {
  return Array.from({ length: count }, (_, i) => ({
    key: `s${i}`,
    label: `S${i}`,
    data: [1, 2],
  }));
}

describe("buildConfig colors", () => {
  it("assigns the default order by position", () => {
    const config = buildConfig(spec({ series: seriesOf(2) }), theme);
    expect(dataset(config, 0).borderColor).toBe(theme.palette.sky);
    expect(dataset(config, 1).borderColor).toBe(theme.palette.orange);
  });

  it("keeps a named color regardless of position", () => {
    const config = buildConfig(
      spec({
        series: [{ key: "b", label: "B", data: [1, 2], color: "rose" }],
      }),
      theme,
    );
    expect(dataset(config, 0).borderColor).toBe(theme.palette.rose);
  });

  it("rejects two series resolving to one color", () => {
    const series = [
      { key: "a", label: "A", data: [1], color: "teal" as const },
      { key: "b", label: "B", data: [1], color: "teal" as const },
    ];
    expect(() => buildConfig(spec({ series }), theme)).toThrow(RangeError);
  });

  it("rejects more uncolored series than the default order holds", () => {
    expect(() => buildConfig(spec({ series: seriesOf(7) }), theme)).toThrow(
      RangeError,
    );
  });
});

describe("buildConfig line", () => {
  it("draws a 2px line that leaves gaps for null", () => {
    const config = buildConfig(
      spec({ series: [{ key: "a", label: "A", data: [1, null, 3] }] }),
      theme,
    );
    const line = dataset(config, 0);
    expect(config.type).toBe("line");
    expect(line.borderWidth).toBe(2);
    expect(line.spanGaps).toBe(false);
    expect(line.data).toEqual([1, null, 3]);
  });

  it("fills an area under a single series only", () => {
    const one = buildConfig(spec(), theme);
    const two = buildConfig(spec({ series: seriesOf(2) }), theme);
    expect(dataset(one, 0).fill).toBe(true);
    expect(typeof dataset(one, 0).backgroundColor).toBe("function");
    expect(dataset(two, 0).fill).toBe(false);
    expect(dataset(two, 0).backgroundColor).toBe(theme.palette.sky);
  });

  it("paints the area as a fading gradient, or a flat wash before layout", () => {
    const fill = dataset(buildConfig(spec(), theme), 0).backgroundColor as (
      context: unknown,
    ) => unknown;
    const stops: [number, string][] = [];
    const gradient = { addColorStop: (at: number, c: string) => stops.push([at, c]) };
    const ctx = { createLinearGradient: vi.fn(() => gradient) };

    expect(fill({ chart: { ctx, chartArea: { top: 0, bottom: 100 } } })).toBe(
      gradient,
    );
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 100);
    expect(stops).toEqual([
      [0, "rgba(58, 155, 216, 0.28)"],
      [1, "rgba(58, 155, 216, 0)"],
    ]);
    expect(fill({ chart: { ctx } })).toBe("rgba(58, 155, 216, 0.14)");
  });

  it("shows 8px markers up to 12 labels and hides them beyond", () => {
    const labels = (n: number) => Array.from({ length: n }, (_, i) => `${i}`);
    const data = (n: number) => Array.from({ length: n }, (_, i) => i);
    const at12 = buildConfig(
      spec({
        labels: labels(12),
        series: [{ key: "a", label: "A", data: data(12) }],
      }),
      theme,
    );
    const at13 = buildConfig(
      spec({
        labels: labels(13),
        series: [{ key: "a", label: "A", data: data(13) }],
      }),
      theme,
    );
    expect(dataset(at12, 0).pointRadius).toBe(4);
    expect(dataset(at13, 0).pointRadius).toBe(0);
  });

  it("keeps a visible marker for a single bucket", () => {
    const config = buildConfig(
      spec({
        labels: ["Jan"],
        series: [{ key: "a", label: "A", data: [30] }],
      }),
      theme,
    );
    expect(dataset(config, 0).pointRadius).toBe(4);
  });

  it("builds an empty chart from an all-null series and from no series", () => {
    const allNull = buildConfig(
      spec({ series: [{ key: "a", label: "A", data: [null, null] }] }),
      theme,
    );
    expect(dataset(allNull, 0).data).toEqual([null, null]);

    const empty = buildConfig(spec({ labels: [], series: [] }), theme);
    expect(empty.data.datasets).toEqual([]);
  });
});

describe("buildConfig bar", () => {
  it("rounds the data end, gaps bars with the surface and starts at zero", () => {
    const config = buildConfig(spec({ kind: "bar" }), theme);
    const bar = dataset(config, 0);
    expect(config.type).toBe("bar");
    expect(bar.borderRadius).toEqual({ topLeft: 4, topRight: 4 });
    expect(bar.borderWidth).toBe(2);
    expect(bar.borderColor).toBe(theme.surface);
    expect(bar.backgroundColor).toBe(theme.palette.sky);
    expect(options(config).scales.y.beginAtZero).toBe(true);
    expect(options(buildConfig(spec(), theme)).scales.y.beginAtZero).toBe(
      false,
    );
  });
});

describe("buildConfig options", () => {
  it("turns off Chart.js legend, title and canvas tooltip, and passes the external handler", () => {
    const external = vi.fn();
    const opts = options(buildConfig(spec(), theme, external));
    expect(opts.plugins.legend.display).toBe(false);
    expect(opts.plugins.title.display).toBe(false);
    expect(opts.plugins.tooltip.enabled).toBe(false);
    expect(opts.plugins.tooltip.external).toBe(external);
  });

  it("draws only the y grid, in the theme grid color", () => {
    const opts = options(buildConfig(spec(), theme));
    expect(opts.scales.x.grid.display).toBe(false);
    expect(opts.scales.y.grid.color).toBe(theme.grid);
  });

  it("animates within 300ms, and not at all under reduced motion", () => {
    const moving = options(buildConfig(spec(), theme)).animation as {
      duration: number;
    };
    expect(moving.duration).toBeLessThanOrEqual(300);
    expect(
      options(buildConfig(spec(), { ...theme, reducedMotion: true })).animation,
    ).toBe(false);
  });

  it("formats y ticks with the spec formatter, defaulting to String", () => {
    const plain = options(buildConfig(spec(), theme));
    const custom = options(
      buildConfig(spec({ format: (n) => n.toFixed(1) }), theme),
    );
    expect(plain.scales.y.ticks.callback(3)).toBe("3");
    expect(custom.scales.y.ticks.callback(3)).toBe("3.0");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npx vitest run tests/modules/ui/chart.module.test.ts`
Expected: FAIL — cannot resolve `@modules/ui/chart.module`.

- [ ] **Step 3: Implement `buildConfig`**

Create `app/src/modules/ui/chart.module.ts`:

```ts
import type { ChartConfiguration } from "chart.js";
import type {
  ChartFormatter,
  ChartSeries,
  ChartSpec,
  ChartTheme,
  ChartTooltipHandler,
  TintName,
} from "./types";

const SPARSE_POINT_LIMIT = 12;
const ANIMATION_MS = 240;
const AREA_TOP_ALPHA = 0.28;
const FONT_SIZE = 11;

const defaultFormat: ChartFormatter = (value) => String(value);

type AreaContext = {
  chart: {
    ctx: CanvasRenderingContext2D;
    chartArea?: { top: number; bottom: number };
  };
};

/**
 * `rgb(r, g, b)` or `rgba(r, g, b, a)` at the given alpha; any other color
 * string is returned unchanged.
 */
function withAlpha(color: string, alpha: number): string {
  const match = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return match
    ? `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`
    : color;
}

/**
 * The palette name of each series: its own `color`, else the default order
 * by position. Throws `RangeError` when none is left or a name repeats.
 */
function seriesColorNames(
  spec: ChartSpec,
  order: readonly TintName[],
): TintName[] {
  const seen = new Set<TintName>();
  return spec.series.map((series, index) => {
    const name = series.color ?? order[index];
    if (!name) {
      throw new RangeError(
        `chart series "${series.key}" has no color: default order exhausted`,
      );
    }
    if (seen.has(name)) {
      throw new RangeError(
        `chart series "${series.key}" repeats color "${name}"`,
      );
    }
    seen.add(name);
    return name;
  });
}

function areaFill(color: string) {
  return (context: AreaContext) => {
    const area = context.chart.chartArea;
    if (!area) return withAlpha(color, AREA_TOP_ALPHA / 2);
    const gradient = context.chart.ctx.createLinearGradient(
      0,
      area.top,
      0,
      area.bottom,
    );
    gradient.addColorStop(0, withAlpha(color, AREA_TOP_ALPHA));
    gradient.addColorStop(1, withAlpha(color, 0));
    return gradient;
  };
}

function lineDataset(
  series: ChartSeries,
  color: string,
  sparse: boolean,
  area: boolean,
  theme: ChartTheme,
) {
  return {
    label: series.label,
    data: series.data,
    borderColor: color,
    backgroundColor: area ? areaFill(color) : color,
    fill: area,
    borderWidth: 2,
    tension: 0.3,
    spanGaps: false,
    pointRadius: sparse ? 4 : 0,
    pointHoverRadius: 5,
    pointBackgroundColor: color,
    pointBorderColor: theme.surface,
    pointBorderWidth: 2,
  };
}

function barDataset(series: ChartSeries, color: string, theme: ChartTheme) {
  return {
    label: series.label,
    data: series.data,
    backgroundColor: color,
    borderColor: theme.surface,
    borderWidth: 2,
    borderRadius: { topLeft: 4, topRight: 4 },
    borderSkipped: "bottom" as const,
  };
}

/**
 * The Chart.js configuration for a spec under a theme. Pure: no DOM, no
 * Chart.js import. `external` draws the tooltip; the canvas one stays off.
 */
export function buildConfig(
  spec: ChartSpec,
  theme: ChartTheme,
  external?: ChartTooltipHandler,
): ChartConfiguration {
  const names = seriesColorNames(spec, theme.order);
  const format = spec.format ?? defaultFormat;
  const sparse = spec.labels.length <= SPARSE_POINT_LIMIT;
  const area = spec.kind === "line" && spec.series.length === 1;
  const datasets = spec.series.map((series, index) => {
    const color = theme.palette[names[index]];
    return spec.kind === "line"
      ? lineDataset(series, color, sparse, area, theme)
      : barDataset(series, color, theme);
  });
  const tick = {
    color: theme.text,
    font: { family: theme.font, size: FONT_SIZE },
  };

  return {
    type: spec.kind,
    data: { labels: spec.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: theme.reducedMotion
        ? false
        : { duration: ANIMATION_MS, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: { enabled: false, external },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { ...tick, maxRotation: 0, autoSkip: true },
        },
        y: {
          beginAtZero: spec.kind === "bar",
          grid: { color: theme.grid },
          border: { display: false },
          ticks: { ...tick, callback: (value: number) => format(value) },
        },
      },
    },
  } as unknown as ChartConfiguration;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npx vitest run tests/modules/ui/chart.module.test.ts`
Expected: PASS (all `buildConfig` tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/ui/chart.module.ts app/tests/modules/ui/chart.module.test.ts
git commit -m "feat(ui): pure Chart.js config builder for line and bar charts

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tooltip and `ChartView`

**Files:**
- Modify: `app/src/modules/ui/chart.module.ts`
- Modify: `app/tests/modules/ui/chart.module.test.ts`

**Interfaces:**
- Consumes: `buildConfig` (Task 2); `ChartDeps`, `ChartCtor`, `ChartInstance`, `ChartTooltipHandler` (Task 1).
- Produces:
  - `createTooltip(host: HTMLElement, theme: ChartTheme, getFormat: () => ChartFormatter): { external: ChartTooltipHandler; dispose(): void }`
  - `class ChartView { constructor(canvas: HTMLCanvasElement, theme: ChartTheme, deps?: ChartDeps); mount(spec: ChartSpec): Promise<void>; update(spec: ChartSpec): void; destroy(): void }` — `mount` never rejects; `update`/`destroy` never throw.

- [ ] **Step 1: Write the failing tests**

In `app/tests/modules/ui/chart.module.test.ts`, change the import line to:

```ts
import { ChartView, buildConfig, createTooltip } from "@modules/ui/chart.module";
import type { ChartCtor, ChartSpec, ChartTheme } from "@modules/types";
```

(replacing the existing `buildConfig`-only import and the existing `import type { ChartSpec, ChartTheme }` line), then append:

```ts
type FakeEl = {
  className: string;
  textContent: string;
  style: Record<string, string>;
  children: FakeEl[];
  appendChild(child: FakeEl): FakeEl;
  replaceChildren(...children: FakeEl[]): void;
  setAttribute: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

function fakeEl(): FakeEl {
  const el: FakeEl = {
    className: "",
    textContent: "",
    style: {},
    children: [],
    appendChild(child) {
      el.children.push(child);
      return child;
    },
    replaceChildren(...children) {
      el.children = children;
    },
    setAttribute: vi.fn(),
    remove: vi.fn(),
  };
  return el;
}

function fakeHost() {
  const host = fakeEl() as FakeEl & {
    ownerDocument: { createElement: () => FakeEl };
  };
  host.ownerDocument = { createElement: () => fakeEl() };
  return host;
}

const point = (label: string, color: unknown, y: number | null) => ({
  dataset: { label, backgroundColor: color, borderColor: "rgb(9, 9, 9)" },
  parsed: { y },
});

describe("createTooltip", () => {
  it("renders a glass tooltip with a title and one row per non-null point", () => {
    const host = fakeHost();
    const { external } = createTooltip(
      host as unknown as HTMLElement,
      theme,
      () => (n) => n.toFixed(1),
    );

    external({
      tooltip: {
        opacity: 1,
        caretX: 10,
        caretY: 20,
        title: ["Jan"],
        dataPoints: [
          point("A", "rgb(1, 2, 3)", 1.234),
          point("B", "rgb(4, 5, 6)", null),
        ],
      },
    });

    const el = host.children[0];
    expect(el.className).toContain("glass-strong");
    expect(el.className).toContain("pointer-events-none");
    expect(el.setAttribute).toHaveBeenCalledWith("aria-hidden", "true");
    expect(el.style.left).toBe("10px");
    expect(el.style.top).toBe("20px");
    expect(el.style.opacity).toBe("1");
    expect(el.children).toHaveLength(2);
    expect(el.children[0].children[0].textContent).toBe("Jan");
    const row = el.children[1];
    expect(row.children[0].style.backgroundColor).toBe("rgb(1, 2, 3)");
    expect(row.children[1].textContent).toBe("A: 1.2");
  });

  it("falls back to the border color when the fill is not a string", () => {
    const host = fakeHost();
    const { external } = createTooltip(
      host as unknown as HTMLElement,
      theme,
      () => String,
    );
    external({
      tooltip: {
        opacity: 1,
        caretX: 0,
        caretY: 0,
        title: [""],
        dataPoints: [point("A", () => "gradient", 1)],
      },
    });
    expect(host.children[0].children[1].children[0].style.backgroundColor).toBe(
      "rgb(9, 9, 9)",
    );
  });

  it("hides at zero opacity and removes itself on dispose", () => {
    const host = fakeHost();
    const { external, dispose } = createTooltip(
      host as unknown as HTMLElement,
      theme,
      () => String,
    );
    external({
      tooltip: {
        opacity: 0,
        caretX: 0,
        caretY: 0,
        title: [],
        dataPoints: [],
      },
    });
    const el = host.children[0];
    expect(el.style.opacity).toBe("0");
    dispose();
    expect(el.remove).toHaveBeenCalled();
  });
});

class FakeChart {
  static instances: FakeChart[] = [];
  data: { labels?: unknown; datasets: unknown[] };
  options: unknown;
  update = vi.fn();
  destroy = vi.fn();
  constructor(
    public canvas: unknown,
    public config: { type: string; data: FakeChart["data"]; options: unknown },
  ) {
    this.data = config.data;
    this.options = config.options;
    FakeChart.instances.push(this);
  }
}

function fakeCanvas() {
  return { parentElement: fakeHost() } as unknown as HTMLCanvasElement;
}

function loaded(): () => Promise<ChartCtor> {
  return () => Promise.resolve(FakeChart as unknown as ChartCtor);
}

describe("ChartView", () => {
  it("mounts a chart built from the spec", async () => {
    FakeChart.instances = [];
    const canvas = fakeCanvas();
    const view = new ChartView(canvas, theme, { loadChartJs: loaded() });

    await view.mount(spec({ labels: ["Jan", "Feb"] }));

    expect(FakeChart.instances).toHaveLength(1);
    expect(FakeChart.instances[0].canvas).toBe(canvas);
    expect(FakeChart.instances[0].config.type).toBe("line");
    expect(FakeChart.instances[0].data.labels).toEqual(["Jan", "Feb"]);
  });

  it("update replaces data and options in place, then redraws", async () => {
    FakeChart.instances = [];
    const view = new ChartView(fakeCanvas(), theme, { loadChartJs: loaded() });
    await view.mount(spec());
    const chart = FakeChart.instances[0];

    view.update(spec({ labels: ["Mar"], series: seriesOf(1) }));

    expect(FakeChart.instances).toHaveLength(1);
    expect(chart.data.labels).toEqual(["Mar"]);
    expect(chart.update).toHaveBeenCalledTimes(1);
  });

  it("an update that lands before Chart.js has loaded is what gets drawn", async () => {
    FakeChart.instances = [];
    let release: (ctor: ChartCtor) => void = () => {};
    const view = new ChartView(fakeCanvas(), theme, {
      loadChartJs: () => new Promise<ChartCtor>((resolve) => (release = resolve)),
    });
    const mounting = view.mount(spec({ labels: ["old"] }));

    view.update(spec({ labels: ["new"] }));
    release(FakeChart as unknown as ChartCtor);
    await mounting;

    expect(FakeChart.instances[0].data.labels).toEqual(["new"]);
  });

  it("destroy tears down the chart and its tooltip", async () => {
    FakeChart.instances = [];
    const view = new ChartView(fakeCanvas(), theme, { loadChartJs: loaded() });
    await view.mount(spec());

    view.destroy();

    expect(FakeChart.instances[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("creates nothing when destroyed before Chart.js loaded", async () => {
    FakeChart.instances = [];
    let release: (ctor: ChartCtor) => void = () => {};
    const view = new ChartView(fakeCanvas(), theme, {
      loadChartJs: () => new Promise<ChartCtor>((resolve) => (release = resolve)),
    });
    const mounting = view.mount(spec());

    view.destroy();
    release(FakeChart as unknown as ChartCtor);
    await mounting;

    expect(FakeChart.instances).toHaveLength(0);
  });

  it("swallows a load failure; update and destroy stay no-ops", async () => {
    const view = new ChartView(fakeCanvas(), theme, {
      loadChartJs: () => Promise.reject(new Error("offline")),
    });

    await expect(view.mount(spec())).resolves.toBeUndefined();
    expect(() => view.update(spec())).not.toThrow();
    expect(() => view.destroy()).not.toThrow();
  });

  it("swallows a mount whose spec cannot be colored", async () => {
    FakeChart.instances = [];
    const view = new ChartView(fakeCanvas(), theme, { loadChartJs: loaded() });

    await expect(view.mount(spec({ series: seriesOf(7) }))).resolves.toBeUndefined();
    expect(FakeChart.instances).toHaveLength(0);
  });

  it("swallows an update whose spec cannot be colored", async () => {
    FakeChart.instances = [];
    const view = new ChartView(fakeCanvas(), theme, { loadChartJs: loaded() });
    await view.mount(spec());

    expect(() => view.update(spec({ series: seriesOf(7) }))).not.toThrow();
    expect(FakeChart.instances[0].update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npx vitest run tests/modules/ui/chart.module.test.ts`
Expected: FAIL — `ChartView` / `createTooltip` are not exported.

- [ ] **Step 3: Implement the tooltip and `ChartView`**

In `app/src/modules/ui/chart.module.ts`, replace the `./types` import block with:

```ts
import type {
  ChartCtor,
  ChartDeps,
  ChartFormatter,
  ChartInstance,
  ChartSeries,
  ChartSpec,
  ChartTheme,
  ChartTooltipHandler,
  TintName,
} from "./types";
```

and append to the end of the file:

```ts
/**
 * Loads Chart.js and registers only the pieces a line or bar chart uses, so
 * the statistics chunk carries nothing else.
 */
async function loadDefaultChartJs(): Promise<ChartCtor> {
  const lib = await import("chart.js");
  lib.Chart.register(
    lib.LineController,
    lib.BarController,
    lib.LineElement,
    lib.PointElement,
    lib.BarElement,
    lib.CategoryScale,
    lib.LinearScale,
    lib.Tooltip,
    lib.Filler,
  );
  return lib.Chart as unknown as ChartCtor;
}

function swatchColor(dataset: {
  backgroundColor?: unknown;
  borderColor?: unknown;
}): string | undefined {
  if (typeof dataset.backgroundColor === "string") {
    return dataset.backgroundColor;
  }
  return typeof dataset.borderColor === "string"
    ? dataset.borderColor
    : undefined;
}

/**
 * An HTML tooltip for Chart.js's `external` hook: one absolutely positioned
 * element inside `host`, carrying the theme's tooltip class. Text only, set
 * through `textContent`. `host` must be a positioned element.
 */
export function createTooltip(
  host: HTMLElement,
  theme: ChartTheme,
  getFormat: () => ChartFormatter,
): { external: ChartTooltipHandler; dispose(): void } {
  let el: HTMLElement | null = null;

  const element = (): HTMLElement => {
    if (el) return el;
    const created = host.ownerDocument.createElement("div");
    created.className = `${theme.tooltipClass} pointer-events-none absolute z-10`;
    created.setAttribute("aria-hidden", "true");
    host.appendChild(created);
    el = created;
    return created;
  };

  const row = (text: string, color?: string): HTMLElement => {
    const doc = host.ownerDocument;
    const line = doc.createElement("div");
    line.className = "flex items-center gap-1.5";
    if (color) {
      const dot = doc.createElement("span");
      dot.className = "size-2 rounded-full";
      dot.style.backgroundColor = color;
      line.appendChild(dot);
    }
    const label = doc.createElement("span");
    label.textContent = text;
    line.appendChild(label);
    return line;
  };

  const external: ChartTooltipHandler = ({ tooltip }) => {
    const node = element();
    if (tooltip.opacity === 0) {
      node.style.opacity = "0";
      return;
    }
    const format = getFormat();
    const rows = tooltip.dataPoints
      .filter((point) => point.parsed.y !== null)
      .map((point) =>
        row(
          `${point.dataset.label ?? ""}: ${format(point.parsed.y as number)}`,
          swatchColor(point.dataset),
        ),
      );
    node.replaceChildren(row(tooltip.title.join(" ")), ...rows);
    node.style.left = `${tooltip.caretX}px`;
    node.style.top = `${tooltip.caretY}px`;
    node.style.transform = "translate(-50%, calc(-100% - 8px))";
    node.style.opacity = "1";
  };

  const dispose = (): void => {
    el?.remove();
    el = null;
  };

  return { external, dispose };
}

/**
 * One chart on one canvas. Chart.js loads on `mount`; a failed load leaves
 * the canvas empty and every method a no-op. Hold it outside Alpine's
 * reactive proxy.
 */
export class ChartView {
  private chart: ChartInstance | null = null;
  private spec: ChartSpec | null = null;
  private destroyed = false;
  private tooltip: ReturnType<typeof createTooltip> | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly theme: ChartTheme,
    private readonly deps: ChartDeps = { loadChartJs: loadDefaultChartJs },
  ) {}

  async mount(spec: ChartSpec): Promise<void> {
    this.spec = spec;
    try {
      const Chart = await this.deps.loadChartJs();
      if (this.destroyed || !this.spec) return;
      this.tooltip = createTooltip(
        this.canvas.parentElement ?? this.canvas,
        this.theme,
        () => this.spec?.format ?? String,
      );
      this.chart = new Chart(
        this.canvas,
        buildConfig(this.spec, this.theme, this.tooltip.external),
      );
    } catch {
      this.chart = null;
    }
  }

  update(spec: ChartSpec): void {
    this.spec = spec;
    if (!this.chart) return;
    try {
      const config = buildConfig(spec, this.theme, this.tooltip?.external);
      this.chart.data.labels = config.data.labels;
      this.chart.data.datasets = config.data.datasets;
      this.chart.options = config.options;
      this.chart.update();
    } catch {
      return;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.chart?.destroy();
    this.chart = null;
    this.tooltip?.dispose();
    this.tooltip = null;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npx vitest run tests/modules/ui/chart.module.test.ts`
Expected: PASS (Task 2 and Task 3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/ui/chart.module.ts app/tests/modules/ui/chart.module.test.ts
git commit -m "feat(ui): ChartView lifecycle and HTML glass tooltip

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Theme adapter

**Files:**
- Create: `app/src/lib/ui/chart-theme.ts`
- Test: `app/tests/lib/ui/chart-theme.test.ts`
- Modify: `app/tests/lib/ui/chart-tokens.test.ts`

**Interfaces:**
- Consumes: `ChartTheme`, `ChartThemeEnv`, `TintName` (Task 1).
- Produces, from `@lib/ui/chart-theme`:
  - `TINT_NAMES: readonly TintName[]`, `CHART_ORDER: readonly TintName[]`, `TOOLTIP_CLASS: string`
  - `buildChartTheme(env: ChartThemeEnv): ChartTheme`
  - `readChartTheme(): ChartTheme` (browser only)

- [ ] **Step 1: Write the failing tests**

Create `app/tests/lib/ui/chart-theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CHART_ORDER,
  TINT_NAMES,
  TOOLTIP_CLASS,
  buildChartTheme,
} from "@lib/ui/chart-theme";
import type { ChartThemeEnv } from "@modules/types";

function env(over: Partial<ChartThemeEnv> = {}): ChartThemeEnv {
  return {
    readVar: (name) => `css(${name})`,
    readFont: () => "Montserrat, sans-serif",
    readPixel: (css) => (css === "css(--chart-grid)" ? [255, 255, 255, 15] : [1, 2, 3, 255]),
    prefersReducedMotion: () => false,
    ...over,
  };
}

describe("buildChartTheme", () => {
  it("resolves every tint token to an rgb color", () => {
    const theme = buildChartTheme(env());
    for (const name of TINT_NAMES) {
      expect(theme.palette[name]).toBe("rgb(1, 2, 3)");
    }
  });

  it("reads each tint from its own --chart-<name> token", () => {
    const seen: string[] = [];
    buildChartTheme(
      env({
        readVar: (name) => {
          seen.push(name);
          return `css(${name})`;
        },
      }),
    );
    for (const name of TINT_NAMES) {
      expect(seen).toContain(`--chart-${name}`);
    }
  });

  it("turns a translucent grid token into rgba", () => {
    expect(buildChartTheme(env()).grid).toBe("rgba(255, 255, 255, 0.059)");
  });

  it("takes text, surface, font, order, tooltip class and motion preference", () => {
    const theme = buildChartTheme(env({ prefersReducedMotion: () => true }));
    expect(theme.text).toBe("rgb(1, 2, 3)");
    expect(theme.surface).toBe("rgb(1, 2, 3)");
    expect(theme.font).toBe("Montserrat, sans-serif");
    expect(theme.order).toEqual([...CHART_ORDER]);
    expect(theme.tooltipClass).toBe(TOOLTIP_CLASS);
    expect(theme.reducedMotion).toBe(true);
  });

  it("reads text from --muted-foreground and surface from --surface", () => {
    const seen: string[] = [];
    buildChartTheme(
      env({
        readVar: (name) => {
          seen.push(name);
          return "x";
        },
      }),
    );
    expect(seen).toContain("--muted-foreground");
    expect(seen).toContain("--surface");
    expect(seen).toContain("--chart-grid");
  });
});

describe("palette constants", () => {
  it("default order is unique and drawn from the tint names", () => {
    expect(new Set(CHART_ORDER).size).toBe(CHART_ORDER.length);
    for (const name of CHART_ORDER) expect(TINT_NAMES).toContain(name);
  });
});
```

Append to `app/tests/lib/ui/chart-tokens.test.ts` (add `import { TINT_NAMES } from "@lib/ui/chart-theme";` with the other imports):

```ts
describe("TINT_NAMES", () => {
  it("equals the chart token names", () => {
    expect([...TINT_NAMES].sort()).toEqual(chartTokenNames().sort());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npx vitest run tests/lib/ui/chart-theme.test.ts tests/lib/ui/chart-tokens.test.ts`
Expected: FAIL — cannot resolve `@lib/ui/chart-theme`.

- [ ] **Step 3: Implement the adapter**

Create `app/src/lib/ui/chart-theme.ts`:

```ts
import type { ChartTheme, ChartThemeEnv, TintName } from "@modules/types";

export const TINT_NAMES: readonly TintName[] = [
  "sky",
  "violet",
  "rose",
  "teal",
  "emerald",
  "amber",
  "orange",
  "fuchsia",
  "blue",
];

export const CHART_ORDER: readonly TintName[] = [
  "sky",
  "orange",
  "emerald",
  "violet",
  "rose",
  "amber",
];

export const TOOLTIP_CLASS =
  "glass-strong rounded-lg px-3 py-2 text-xs text-foreground";

const OPAQUE = 255;

function formatRgba([r, g, b, a]: readonly number[]): string {
  return a >= OPAQUE
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${+(a / OPAQUE).toFixed(3)})`;
}

/**
 * A `ChartTheme` from the `global.css` tokens, each CSS color normalised to
 * `rgb()`/`rgba()` through the environment's pixel readback so canvas
 * gradients never depend on `oklch()` parsing.
 */
export function buildChartTheme(env: ChartThemeEnv): ChartTheme {
  const color = (token: string) => formatRgba(env.readPixel(env.readVar(token)));
  const palette = Object.fromEntries(
    TINT_NAMES.map((name) => [name, color(`--chart-${name}`)]),
  ) as Record<TintName, string>;

  return {
    palette,
    order: [...CHART_ORDER],
    surface: color("--surface"),
    text: color("--muted-foreground"),
    grid: color("--chart-grid"),
    font: env.readFont(),
    tooltipClass: TOOLTIP_CLASS,
    reducedMotion: env.prefersReducedMotion(),
  };
}

function browserEnv(): ChartThemeEnv {
  const root = document.documentElement;
  const scratch = document.createElement("canvas");
  scratch.width = 1;
  scratch.height = 1;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });

  return {
    readVar: (name) => getComputedStyle(root).getPropertyValue(name).trim(),
    readFont: () => getComputedStyle(document.body).fontFamily,
    readPixel: (css) => {
      if (!ctx) return [0, 0, 0, OPAQUE];
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    },
    prefersReducedMotion: () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/** The theme for the current document. Browser only. */
export function readChartTheme(): ChartTheme {
  return buildChartTheme(browserEnv());
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npx vitest run tests/lib/ui/chart-theme.test.ts tests/lib/ui/chart-tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/ui/chart-theme.ts app/tests/lib/ui/chart-theme.test.ts app/tests/lib/ui/chart-tokens.test.ts
git commit -m "feat(ui): chart theme adapter reading the color tokens

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Alpine factory and `Chart.astro`

**Files:**
- Create: `app/src/lib/ui/chart.data.ts`
- Create: `app/src/components/ui/Chart.astro`
- Modify: `app/src/lib/client/alpine/register-ui-data.ts`
- Test: `app/tests/lib/ui/chart.data.test.ts`

**Interfaces:**
- Consumes: `ChartView` (Task 3), `readChartTheme`, `CHART_ORDER` (Task 4), `ChartSpec`, `ChartSeries`, `ChartFormatter` (Task 1).
- Produces:
  - `chartData(config?: { formatter?: string })` — Alpine data with `spec: ChartSpec | null`, `setSpec(next?: ChartSpec | null): void`, `swatch(series: ChartSeries, index: number): string`, `cell(series: ChartSeries, row: number): string`, `destroy(): void`
  - `CHART_FORMATTERS: Record<string, ChartFormatter>` with keys `plain`, `integer`, `one-decimal`, `percent`
  - `Chart.astro` props `{ specExpr, title?, formatter?, heightClass?, flat?, class? }`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/lib/ui/chart.data.test.ts`:

```ts
import { types } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartSpec } from "@modules/types";

const { MockChartView, views } = vi.hoisted(() => {
  type Spec = { format?: (n: number) => string };
  const views: MockChartView[] = [];

  class MockChartView {
    canvas: unknown;
    mount = vi.fn((_spec: Spec) => Promise.resolve());
    update = vi.fn((_spec: Spec) => {});
    destroy = vi.fn();
    constructor(canvas: unknown) {
      this.canvas = canvas;
      views.push(this);
    }
  }

  return { MockChartView, views };
});

vi.mock("@modules/ui/chart.module", () => ({ ChartView: MockChartView }));
vi.mock("@lib/ui/chart-theme", () => ({
  CHART_ORDER: ["sky", "orange", "emerald"],
  readChartTheme: () => ({ stub: true }),
}));

const { chartData } = await import("@lib/ui/chart.data");

const canvas = { tag: "canvas" };

function context(config?: { formatter?: string }) {
  const data = chartData(config);
  return Object.assign(data, { $refs: { canvas } });
}

function spec(over: Partial<ChartSpec> = {}): ChartSpec {
  return {
    kind: "line",
    labels: ["Jan", "Feb"],
    series: [{ key: "a", label: "A", data: [1.234, null] }],
    ariaLabel: "chart",
    ...over,
  };
}

beforeEach(() => {
  views.length = 0;
});

describe("chartData.setSpec", () => {
  it("creates one view on the canvas and mounts the spec with the formatter", () => {
    const ctx = context({ formatter: "one-decimal" });

    ctx.setSpec(spec());

    expect(views).toHaveLength(1);
    expect(views[0].canvas).toBe(canvas);
    const mounted = views[0].mount.mock.calls[0][0];
    expect(mounted.format?.(1.234)).toBe("1.2");
  });

  it("updates the same view on later specs", () => {
    const ctx = context();
    ctx.setSpec(spec());
    ctx.setSpec(spec({ labels: ["Mar"] }));

    expect(views).toHaveLength(1);
    expect(views[0].update).toHaveBeenCalledTimes(1);
  });

  it("keeps a plain mirror for the legend and table, apart from what Chart.js gets", () => {
    const ctx = context();
    const input = spec();
    ctx.setSpec(input);

    expect(ctx.spec).toEqual({ ...input, format: undefined });
    expect(ctx.spec).not.toBe(input);
    expect(ctx.spec && "format" in ctx.spec).toBe(false);
    input.labels.push("later");
    expect(ctx.spec?.labels).toEqual(["Jan", "Feb"]);
  });

  it("never hands Chart.js a proxy", () => {
    const ctx = context();
    const proxied = new Proxy(spec(), {});

    ctx.setSpec(proxied);

    const mounted = views[0].mount.mock.calls[0][0];
    expect(types.isProxy(mounted)).toBe(false);
    expect(types.isProxy(mounted.format)).toBe(false);
    expect(types.isProxy((mounted as unknown as ChartSpec).series)).toBe(false);
  });

  it("ignores a missing spec", () => {
    const ctx = context();
    ctx.setSpec(null);
    ctx.setSpec(undefined);
    expect(views).toHaveLength(0);
    expect(ctx.spec).toBeNull();
  });

  it("does nothing, without throwing, when the canvas is missing", () => {
    const ctx = Object.assign(chartData(), { $refs: {} });
    expect(() => ctx.setSpec(spec())).not.toThrow();
    expect(views).toHaveLength(0);
  });
});

describe("chartData helpers", () => {
  it("destroy tears the view down", () => {
    const ctx = context();
    ctx.setSpec(spec());
    ctx.destroy();
    expect(views[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("swatch uses the named color, else the default order, else sky", () => {
    const ctx = context();
    const plain = { key: "a", label: "A", data: [] };
    expect(ctx.swatch({ ...plain, color: "rose" }, 0)).toBe("var(--chart-rose)");
    expect(ctx.swatch(plain, 1)).toBe("var(--chart-orange)");
    expect(ctx.swatch(plain, 9)).toBe("var(--chart-sky)");
  });

  it("cell formats a value and dashes a gap", () => {
    const ctx = context({ formatter: "one-decimal" });
    const series = { key: "a", label: "A", data: [1.234, null] };
    expect(ctx.cell(series, 0)).toBe("1.2");
    expect(ctx.cell(series, 1)).toBe("—");
    expect(ctx.cell(series, 5)).toBe("—");
  });

  it("falls back to the plain formatter for an unknown key", () => {
    const ctx = context({ formatter: "nope" });
    expect(ctx.cell({ key: "a", label: "A", data: [3] }, 0)).toBe("3");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npx vitest run tests/lib/ui/chart.data.test.ts`
Expected: FAIL — cannot resolve `@lib/ui/chart.data`.

- [ ] **Step 3: Implement the factory**

Create `app/src/lib/ui/chart.data.ts`:

```ts
import { ChartView } from "@modules/ui/chart.module";
import { CHART_ORDER, readChartTheme } from "@lib/ui/chart-theme";
import type { ChartFormatter, ChartSeries, ChartSpec } from "@modules/types";

type ChartDataConfig = { formatter?: string };

type ChartDataContext = {
  spec: ChartSpec | null;
  $refs: { canvas?: HTMLCanvasElement };
};

export const CHART_FORMATTERS: Record<string, ChartFormatter> = {
  plain: (value) => String(value),
  integer: (value) => String(Math.round(value)),
  "one-decimal": (value) => value.toFixed(1),
  percent: (value) => `${Math.round(value * 100)}%`,
};

function toPlainSpec(spec: ChartSpec): ChartSpec {
  return JSON.parse(JSON.stringify(spec)) as ChartSpec;
}

/**
 * Alpine factory for `Chart.astro`. The `ChartView` stays in this closure:
 * Alpine deep-proxies `this.*`, and a proxy reaching Chart.js breaks it.
 * `spec` is the plain mirror the legend and table read; Chart.js is fed a
 * separate JSON-plain copy with the formatter re-attached.
 */
export function chartData(config: ChartDataConfig = {}) {
  let view: ChartView | null = null;
  const format =
    CHART_FORMATTERS[config.formatter ?? "plain"] ?? CHART_FORMATTERS.plain;

  return {
    spec: null as ChartSpec | null,

    setSpec(this: ChartDataContext, next?: ChartSpec | null) {
      if (!next) return;
      this.spec = toPlainSpec(next);
      const forChart: ChartSpec = { ...toPlainSpec(next), format };
      if (view) {
        view.update(forChart);
        return;
      }
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      view = new ChartView(canvas, readChartTheme());
      void view.mount(forChart);
    },

    swatch(series: ChartSeries, index: number): string {
      return `var(--chart-${series.color ?? CHART_ORDER[index] ?? "sky"})`;
    },

    cell(series: ChartSeries, row: number): string {
      const value = series.data[row];
      return value === null || value === undefined ? "—" : format(value);
    },

    destroy() {
      view?.destroy();
      view = null;
    },
  };
}
```

- [ ] **Step 4: Register it**

Replace `app/src/lib/client/alpine/register-ui-data.ts` with:

```ts
import type { Alpine } from "alpinejs";
import { logoutButton } from "@auth/logout.data";
import { toggleData } from "@lib/ui/toggle.data";
import { gameLayoutData } from "@lib/ui/game-layout.data";
import { chartData } from "@lib/ui/chart.data";

export function registerUiData(Alpine: Alpine) {
  Alpine.data("logoutButton", logoutButton);
  Alpine.data("toggle", toggleData);
  Alpine.data("gameLayout", gameLayoutData);
  Alpine.data("chartData", chartData);
}
```

- [ ] **Step 5: Run the factory tests**

Run: `cd app && npx vitest run tests/lib/ui/chart.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Create `Chart.astro`**

Create `app/src/components/ui/Chart.astro`:

```astro
---
/**
 * A Chart.js chart drawn from a plain `ChartSpec`: canvas, a legend for two
 * or more series, and a table view that also stands in when Chart.js cannot
 * load. `x-effect` sits on the canvas so its `x-ref` exists before the first
 * run. Paired with `modules/ui/chart.module.ts`.
 * @param {string} specExpr Alpine expression yielding the `ChartSpec`; re-read whenever its dependencies change
 * @param {string} [title] Heading above the chart
 * @param {string} [formatter] `CHART_FORMATTERS` key for axis, tooltip and table values
 * @param {string} [heightClass] Height of the canvas box
 * @param {boolean} [flat] Drop the glass wrapper, for a chart already inside a glass card
 * @param {string} [class] Extra wrapper classes
 */
interface Props {
  specExpr: string;
  title?: string;
  formatter?: "plain" | "integer" | "one-decimal" | "percent";
  heightClass?: string;
  flat?: boolean;
  class?: string;
  [key: string]: unknown;
}

// Props
const {
  specExpr,
  title,
  formatter = "plain",
  heightClass = "h-48",
  flat = false,
  class: classNameProp,
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Data
const scope = `chartData({ formatter: "${formatter}" })`;
const effect = `setSpec(${specExpr})`;

// Styles
const wrapperClass = cn(
  "space-y-2",
  !flat && "glass rounded-2xl p-4",
  classNameProp,
);
const boxClass = cn("relative", heightClass);
---

<div
  class={wrapperClass}
  x-data={scope}
  {...props}
>
  {title && <h2 class="text-sm text-foreground">{title}</h2>}
  <div class={boxClass}>
    <canvas
      x-ref="canvas"
      x-effect={effect}
      role="img"
      :aria-label="spec ? spec.ariaLabel : ''"
    >
    </canvas>
  </div>
  <ul
    class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
    x-show="spec && spec.series.length >= 2"
    x-cloak
  >
    <template
      x-for="(entry, index) in (spec ? spec.series : [])"
      :key="entry.key"
    >
      <li class="flex items-center gap-1.5">
        <span
          class="size-2 rounded-full"
          :style="{ backgroundColor: swatch(entry, index) }"
        >
        </span>
        <span x-text="entry.label"></span>
      </li>
    </template>
  </ul>
  <details class="text-xs text-muted-foreground">
    <summary class="cursor-pointer">Table view</summary>
    <table class="mt-2 w-full text-left">
      <thead>
        <tr>
          <th class="font-semibold"><span class="sr-only">Period</span></th>
          <template
            x-for="entry in (spec ? spec.series : [])"
            :key="entry.key"
          >
            <th
              class="font-semibold"
              x-text="entry.label"
            >
            </th>
          </template>
        </tr>
      </thead>
      <tbody>
        <template
          x-for="(label, row) in (spec ? spec.labels : [])"
          :key="row"
        >
          <tr>
            <th
              class="font-normal"
              scope="row"
              x-text="label"
            >
            </th>
            <template
              x-for="entry in spec.series"
              :key="entry.key"
            >
              <td x-text="cell(entry, row)"></td>
            </template>
          </tr>
        </template>
      </tbody>
    </table>
  </details>
</div>
```

- [ ] **Step 7: Format and run the structural gates**

Run: `cd app && npx prettier --write src/components/ui/Chart.astro src/lib/ui/chart.data.ts src/lib/ui/chart-theme.ts src/modules/ui/chart.module.ts tests/lib/ui tests/modules/ui/chart.module.test.ts && cd .. && bash scripts/check-astro-conventions.sh && bash scripts/check-style-tokens.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-astro-class-composition.sh`
Expected: each script prints `OK`. (If a script name differs, list `scripts/check-*.sh` and run the matching one.) Re-run `cd app && npx vitest run tests/lib/ui tests/modules/ui` — PASS.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/ui/chart.data.ts app/src/lib/client/alpine/register-ui-data.ts app/src/components/ui/Chart.astro app/tests/lib/ui/chart.data.test.ts
git commit -m "feat(ui): chartData Alpine factory and Chart.astro

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Scoring trend consumer

**Files:**
- Modify: `app/src/stores/game-stats.store.ts` (import block; `scoringTrendRows` getter at ~line 1007)
- Modify: `app/src/components/layout/statistics/GameSectionCards.astro` (Scoring trend card, ~lines 447-495)
- Modify: `app/tests/stores/game-stats.store.test.ts`

**Interfaces:**
- Consumes: `ChartSeries`, `ChartSpec` (Task 1); `Chart.astro` (Task 5).
- Produces: store getter `scoringTrendChart: ChartSpec` (`kind: "line"`, series `three-dart-average` color `sky`, optional `first-nine-average` color `orange`).

- [ ] **Step 1: Write the failing tests**

Append inside the `describe("gameStatsStore", ...)` block of `app/tests/stores/game-stats.store.test.ts` (before its closing `});`), plus the two helpers just above the `describe`:

```ts
function trendMetrics(
  points: number,
  darts: number,
  firstNinePoints = 0,
  firstNineDarts = 0,
) {
  return {
    points,
    darts,
    firstNinePoints,
    firstNineDarts,
    bands: { ton: 0, tonForty: 0, oneEighty: 0 },
  };
}

function trendSeries(buckets: { start: string; metrics: unknown }[]) {
  return {
    ...series({}, 1),
    buckets: buckets.map((b) => ({
      start: b.start,
      end: b.start,
      closed: true,
      sampleSize: 1,
      metrics: b.metrics,
    })),
  };
}

function loadTrend(buckets: { start: string; metrics: unknown }[]) {
  readSection.mockImplementation((_player, _game, meta) =>
    Promise.resolve(
      meta.id === "scoring-trend" ? trendSeries(buckets) : series({}, 0),
    ),
  );
  const store = gameStatsStore();
  store.gameTypeKey = "501";
  return store.load().then(() => store);
}
```

```ts
  describe("scoringTrendChart", () => {
    const jan = "2026-01-15T12:00:00.000Z";
    const feb = "2026-02-15T12:00:00.000Z";
    const monthLabel = (start: string) =>
      new Date(start).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });

    it("charts the 3-dart and first-nine averages per month", async () => {
      const store = await loadTrend([
        { start: jan, metrics: trendMetrics(300, 30, 180, 18) },
        { start: feb, metrics: trendMetrics(360, 30, 0, 0) },
      ]);

      expect(store.scoringTrendChart).toEqual({
        kind: "line",
        labels: [monthLabel(jan), monthLabel(feb)],
        series: [
          {
            key: "three-dart-average",
            label: "3-dart average",
            data: [30, 36],
            color: "sky",
          },
          {
            key: "first-nine-average",
            label: "First nine",
            data: [30, null],
            color: "orange",
          },
        ],
        ariaLabel: "3-dart average per month",
      });
    });

    it("omits first nine when no bucket has first-nine darts", async () => {
      const store = await loadTrend([
        { start: jan, metrics: trendMetrics(300, 30) },
      ]);

      expect(
        store.scoringTrendChart.series.map((s: { key: string }) => s.key),
      ).toEqual(["three-dart-average"]);
    });

    it("leaves a gap, not zero, for a bucket with no darts", async () => {
      const store = await loadTrend([
        { start: jan, metrics: trendMetrics(0, 0) },
      ]);

      expect(store.scoringTrendChart.series[0].data).toEqual([null]);
    });

    it("is an empty line chart before the section has loaded", () => {
      const store = gameStatsStore();

      expect(store.scoringTrendChart).toEqual({
        kind: "line",
        labels: [],
        series: [
          {
            key: "three-dart-average",
            label: "3-dart average",
            data: [],
            color: "sky",
          },
        ],
        ariaLabel: "3-dart average per month",
      });
    });

    it("returns a fresh plain object on every read", async () => {
      const store = await loadTrend([
        { start: jan, metrics: trendMetrics(300, 30) },
      ]);

      const first = store.scoringTrendChart;
      expect(store.scoringTrendChart).not.toBe(first);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npx vitest run tests/stores/game-stats.store.test.ts -t scoringTrendChart`
Expected: FAIL — `store.scoringTrendChart` is `undefined`.

- [ ] **Step 3: Replace the getter**

In `app/src/stores/game-stats.store.ts`, add `ChartSeries` and `ChartSpec` to the existing `import type { ... } from "@modules/types";` list (alphabetical: before `CheckoutPathMetrics`... keep the list's order — `ChartSeries, ChartSpec,` go right after `BustRateMetrics,`).

Replace the `scoringTrendRows` getter (the JSDoc starting `/** \`scoring-trend\`'s per-bucket averages, for the trend line. */` and the whole `get scoringTrendRows()` body) with:

```ts
    /** `scoring-trend`'s monthly 3-dart and first-nine averages as a line chart; an empty-darts bucket is a gap. */
    get scoringTrendChart(): ChartSpec {
      const series = this.sections["scoring-trend"] as
        CachedSeries<ScoringTrendMetrics> | undefined;
      const buckets = series?.buckets ?? [];
      const average = (points: number, darts: number) =>
        darts === 0 ? null : (points / darts) * 3;
      const firstNine = buckets.map((b) =>
        average(b.metrics.firstNinePoints, b.metrics.firstNineDarts),
      );
      const chartSeries: ChartSeries[] = [
        {
          key: "three-dart-average",
          label: "3-dart average",
          data: buckets.map((b) => average(b.metrics.points, b.metrics.darts)),
          color: "sky",
        },
      ];
      if (firstNine.some((value) => value !== null)) {
        chartSeries.push({
          key: "first-nine-average",
          label: "First nine",
          data: firstNine,
          color: "orange",
        });
      }
      return {
        kind: "line",
        labels: buckets.map((b) =>
          new Date(b.start).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          }),
        ),
        series: chartSeries,
        ariaLabel: "3-dart average per month",
      };
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npx vitest run tests/stores/game-stats.store.test.ts`
Expected: PASS — the new tests and every existing one (`scoringTrendRows` had no test).

- [ ] **Step 5: Swap the card markup**

In `app/src/components/layout/statistics/GameSectionCards.astro`, add to the frontmatter component imports (after the `StatsHeatmap` import):

```astro
import Chart from "@components/ui/Chart.astro";
```

and replace this block inside the Scoring trend card:

```astro
    <template
      x-for="row in gameView.scoringTrendRows"
      :key="row.start"
    >
      <div class="flex items-center justify-between text-sm">
        <span
          class="text-muted-foreground"
          x-text="new Date(row.start).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })"
        ></span>
        <span
          class="text-foreground"
          x-text="row.threeDartAverage !== null ? row.threeDartAverage.toFixed(1) + ' avg' : 'not enough data yet'"
        ></span>
      </div>
    </template>
```

with:

```astro
    <Chart
      flat
      specExpr="gameView.scoringTrendChart"
      formatter="one-decimal"
    />
```

- [ ] **Step 6: Format, type-check, full unit suite**

Run: `cd app && npx prettier --write src/stores/game-stats.store.ts src/components/layout/statistics/GameSectionCards.astro tests/stores/game-stats.store.test.ts && npx astro check 2>&1 | tail -5 && npm test 2>&1 | tail -8`
Expected: `astro check` 0 errors / 0 warnings / 0 hints; `npm test` all files pass, 0 failed.

- [ ] **Step 7: Look at it in the browser**

Run the `run` skill (`astro dev --background`). Open `/statistics`, pick **Score Training** (and **501**), and confirm: the line draws under the two stat tiles; hovering shows the glass tooltip with the date and values; with both series a legend shows sky and orange swatches; the **Table view** disclosure lists months × series; no console errors; the network panel shows the Chart.js chunk loads only on this page. Also check the Routines tab → a GAME step renders the same chart. If there is no data for the chosen game, say so in the report rather than claiming it was checked.

- [ ] **Step 8: Commit**

```bash
git add app/src/stores/game-stats.store.ts app/src/components/layout/statistics/GameSectionCards.astro app/tests/stores/game-stats.store.test.ts
git commit -m "feat(stats): scoring trend card charts the monthly averages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs, decision, context maintenance, PR

**Files:**
- Modify: `docs/architecture/07-Frontend/04-Modules-And-OOP.md` (§Portable UI Kit → §Chart peer dependency)
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (Tokens table; new "Charts" section)
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (`components/ui/` table)
- Modify: `docs/architecture/00-File-Inventory.md` (rows for the new files)
- Modify: `docs/architecture/00-Context-Map-History.md` (version entry)
- Modify: `decisions/frontend/style.md` (new decision block)

**Interfaces:**
- Consumes: everything above (documents it). No code.

- [ ] **Step 1: Derive the decision id**

Run: `bash scripts/next-decision-id.sh`
Expected: prints the next free id (`D373` at the time of writing). Use the printed id below as `D###`.

- [ ] **Step 2: Append the decision**

Append to `decisions/frontend/style.md` (match the neighbouring block format; use the printed id and today's ISO date):

```markdown

### D### — Charts: one portable Chart.js module, glass containers with plain canvases, colors named after CardWrapper's
Status: Accepted · Date: 2026-09-30
Decision: the statistics charts share one module. `modules/ui/chart.module.ts` (`buildConfig`, `ChartView`, HTML tooltip) takes an injected `ChartTheme` and imports no store, token or Alpine; `lib/ui/chart-theme.ts` reads `--chart-<name>` tokens; `lib/ui/chart.data.ts` holds the instance in a closure; `components/ui/Chart.astro` is the glass container with a legend and a table view. V1 is line and bar. A series' color is one of `CardWrapper.astro`'s color names (`sky, violet, rose, teal, emerald, amber, orange, fuchsia, blue`); the default assignment order is `sky, orange, emerald, violet, rose, amber` and is never cycled; a repeated or missing color is a `RangeError`. The canvas is plain; the containers are glass.
Reason: the portable-kit contract (`04-Modules-And-OOP.md`) forbids tokens in `modules/ui`, so the theme is injected. The dataviz validator fails all nine names together on adjacent-pair CVD (`teal`/`emerald`, `blue`/`sky`, `fuchsia`/`rose` are near-twins), so only six are default and the rest are explicit. `CardWrapper`'s free-color escape hatch cannot be validated and is not part of the chart contract. Chart.js breaks behind Alpine's proxy, so the factory passes a JSON-plain copy.
Consequences: `chart.js` is a new dependency, loaded by dynamic import on the statistics page only. Pie/donut and datalabels are deferred until a section needs them. The `--chart-<name>` values are tuned for marks on the black surface and differ from `CardWrapper`'s wash tints; a test keeps the name lists equal. `scoring-trend` is the first consumer; other sections and the heatmap are later cycles.
```

- [ ] **Step 3: Update the handbook docs**

- `04-Modules-And-OOP.md` §Chart peer dependency: add one paragraph — "`chart.module.ts` exports `buildConfig`, `createTooltip` and `ChartView`. It takes a `ChartTheme` from its caller, loads Chart.js with a dynamic `import()` through an injectable `loadChartJs`, and never throws from `mount`/`update`/`destroy`. The app adapter `lib/ui/chart-theme.ts` supplies the theme (D###)." Add the ISO date `(2026-09-30)`.
- `07-Style-Guide.md`: add `--chart-<name>` (nine names) and `--chart-grid` to the Tokens table under a new row "Chart marks", and a short "# Charts" section stating: containers are `glass`/`Chart.astro`, the canvas is plain; colors are `CardWrapper` names; default order; explicit-only `teal`/`fuchsia`/`blue`; one glass level (`flat` inside a glass card); tokens validated with the dataviz validator on `--surface`. Bump the doc's version line and `updated:` front matter to 2026-09-30.
- `08-Component-Inventory.md`: add a row under the `components/ui/` table: `| \`Chart.astro\` | Line/bar chart from a plain \`ChartSpec\`: glass container, canvas, legend for ≥ 2 series, table view fallback; \`flat\` inside an existing glass card (2026-09-30, D###) | \`specExpr\`, \`title\`, \`formatter\`, \`heightClass\`, \`flat\`, \`class\` |`.

- [ ] **Step 4: Register in the File Inventory and History**

- `00-File-Inventory.md`: add a canonical row per new source file, each dated 2026-09-30 — `app/src/modules/ui/chart.module.ts`, `app/src/lib/ui/chart-theme.ts`, `app/src/lib/ui/chart.data.ts`, `app/src/components/ui/Chart.astro` — one sentence each (what it answers), in the same section as their sibling rows (see the `StatsHeatmap.astro` row for the shape). Bump the `updated:` front-matter date.
- `00-Context-Map-History.md`: append a `Version:` entry at the top of the list (next minor after `1.139.0`): "1.140.0 (2026-09-30 — chart-module: Chart.js line/bar module with glass containers, `--chart-<name>` tokens named after `CardWrapper` colors, `scoring-trend` as first consumer; new **D###** (`decisions/frontend/style.md`); spec `docs/superpowers/specs/2026-09-29-chart-module-design.md`, plan `docs/superpowers/plans/2026-09-30-chart-module.md`)". Add the spec and plan rows to the point-in-time records table, status `historical`, in the shape of the existing rows there.

- [ ] **Step 5: Run the context gates**

Run:

```bash
bash scripts/check-decision-ids.sh
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

Expected: each passes. If `check-context-budget.sh` reports `~tokens` drift for an edited doc (`04-Modules-And-OOP`, `07-Style-Guide`, `08-Component-Inventory`, the inventory itself), update that file's `~tokens` cell in `00-File-Inventory.md` and the affected pack budget in `00-Context-Map.md` to the script's figure, then re-run until it passes.

- [ ] **Step 6: Re-check the decision id, then the full gates**

Run `bash scripts/next-decision-id.sh` again. If it moved past the id used, run `bash scripts/renumber-decision.sh <old> <new>`.

Then invoke the `run-all-gates` and `validate-app` skills. `db:status`/`db:migrate`/`db:drift`/`db:introspect` need `DATABASE_URL`; this plan adds no migration — if the variable is absent, run the rest of the chain (`npm test`, `npx astro check`, `bash scripts/fallow-gate.sh`) and state in the report that the db steps did not run and why.

- [ ] **Step 7: Format, commit, open the PR**

```bash
cd app && npm run format && npm run format:check
cd .. && git add -A docs decisions app && git commit -m "docs(ui): chart module handbook, inventory and decision

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Then invoke `superpowers:finishing-a-development-branch` together with the `finishing-a-dart-branch` skill (Option 2: push and open the PR). In the PR body: the validator output from Task 1 Step 6, the browser check from Task 6 Step 7, and any discovered-work issues filed via `capturing-discovered-work`. Run `context-maintenance` before the completion report. Known follow-up to file as discovered work, not fix here: `CardWrapper.astro` keeps an inline `tintPresets` copy of the color names (kept equal by `chart-tokens.test.ts`).

---

## Self-Review

**Spec coverage:** line/bar only (Task 2); module contract and colors by `CardWrapper` name (Tasks 1-2); marks — 2px line, sparse markers, bar radius/gap, recessive grid, animation, external HTML tooltip (Tasks 2-3); theme adapter with pixel readback and token list (Tasks 1, 4); palette validation (Task 1 Step 6); `Chart.astro` with legend ≥ 2 series, table view, `flat`, `specExpr` (Task 5); factory with closure, JSON-plain clone, formatter key, swallow failures, register (Task 5); `scoringTrendChart` and card swap, Routines tab covered by the shared component (Task 6); tests for every unit the spec lists (Tasks 1-6); docs, decision, inventory, history, budget, gates, PR (Task 7). Spec deviations, already written back into the spec: `kind` travels in the spec (not a prop), `ChartTheme.surface` added, first-nine color named `orange`.

**Placeholders:** `D###` in Task 7 is filled from `next-decision-id.sh` at execution, by design; `$DATAVIZ_DIR` is the dataviz skill's base directory.

**Type consistency:** `ChartSpec`/`ChartSeries`/`ChartTheme`/`ChartDeps`/`ChartTooltipHandler`/`ChartThemeEnv` names and fields match across Tasks 1-6; `buildConfig(spec, theme, external?)`, `createTooltip(host, theme, getFormat)`, `ChartView(canvas, theme, deps?)`, `chartData({ formatter })` with `setSpec`/`swatch`/`cell`/`destroy` are used as defined; `CHART_ORDER`, `TINT_NAMES`, `TOOLTIP_CLASS` are defined in Task 4 and consumed in Task 5's mocks and Task 4's tests.

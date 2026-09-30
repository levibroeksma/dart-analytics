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

/**
 * Area fill function that creates a linear gradient when chart area is known,
 * or a flat color before layout.
 */
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

/**
 * Line chart dataset configuration.
 */
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

/**
 * Bar chart dataset configuration.
 */
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

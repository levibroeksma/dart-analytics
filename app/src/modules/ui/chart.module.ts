import type { ChartConfiguration } from "chart.js";
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

const ANIMATION_MS = 240;
const AREA_ALPHA = 0.18;
const FONT_SIZE = 11;

const defaultFormat: ChartFormatter = (value) => String(value);

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
 * Line chart dataset configuration: straight segments, no point markers
 * except for a lone point, which would otherwise draw nothing.
 */
function lineDataset(
  series: ChartSeries,
  color: string,
  lone: boolean,
  area: boolean,
  theme: ChartTheme,
) {
  return {
    label: series.label,
    data: series.data,
    borderColor: color,
    backgroundColor: area ? withAlpha(color, AREA_ALPHA) : color,
    fill: area,
    borderWidth: 2,
    tension: 0,
    spanGaps: false,
    pointRadius: lone ? 4 : 0,
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
  const lone = spec.labels.length === 1;
  const area = spec.kind === "line";
  const datasets = spec.series.map((series, index) => {
    const color = theme.palette[names[index]];
    return spec.kind === "line"
      ? lineDataset(series, color, lone, area, theme)
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
 * The tooltip's `left` so a node of `width` centered on it stays inside a
 * host of `hostWidth`. A missing or zero width leaves `caretX` as is.
 */
function clampLeft(caretX: number, width?: number, hostWidth?: number): number {
  if (!width || !hostWidth) return caretX;
  const half = width / 2;
  return Math.max(half, Math.min(caretX, hostWidth - half));
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
    created.className = `${theme.tooltipClass} pointer-events-none absolute z-10 w-max`;
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
    node.style.left = `${clampLeft(tooltip.caretX, node.offsetWidth, host.clientWidth)}px`;
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
    try {
      this.chart?.destroy();
    } catch {
      return;
    } finally {
      this.chart = null;
      this.tooltip?.dispose();
      this.tooltip = null;
    }
  }
}

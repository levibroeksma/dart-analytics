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

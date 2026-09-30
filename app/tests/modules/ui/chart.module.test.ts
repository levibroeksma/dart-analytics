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
    const gradient = {
      addColorStop: (at: number, c: string) => stops.push([at, c]),
    };
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

import { describe, expect, it, vi } from "vitest";
import {
  ChartView,
  buildConfig,
  createTooltip,
} from "@modules/ui/chart.module";
import type { ChartCtor, ChartSpec, ChartTheme } from "@modules/types";

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

  it("fills under every line series with its own line color at a fixed opacity", () => {
    const two = buildConfig(spec({ series: seriesOf(2) }), theme);
    expect(dataset(two, 0).fill).toBe(true);
    expect(dataset(two, 0).backgroundColor).toBe("rgba(58, 155, 216, 0.18)");
    expect(dataset(two, 1).fill).toBe(true);
    expect(dataset(two, 1).backgroundColor).toBe("rgba(217, 89, 38, 0.18)");
  });

  it("never fills bars with an area", () => {
    const bars = buildConfig(spec({ kind: "bar" }), theme);
    expect(dataset(bars, 0).fill).toBeUndefined();
  });

  it("draws straight lines with no point markers at any length", () => {
    const labels = (n: number) => Array.from({ length: n }, (_, i) => `${i}`);
    const data = (n: number) => Array.from({ length: n }, (_, i) => i);
    for (const n of [2, 12, 13]) {
      const config = buildConfig(
        spec({
          labels: labels(n),
          series: [{ key: "a", label: "A", data: data(n) }],
        }),
        theme,
      );
      expect(dataset(config, 0).pointRadius).toBe(0);
      expect(dataset(config, 0).tension).toBe(0);
    }
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

describe("buildConfig doughnut", () => {
  const doughnut = (over: Partial<ChartSpec["series"][number]> = {}) =>
    spec({
      kind: "doughnut",
      labels: ["Completed", "Abandoned"],
      series: [
        {
          key: "games",
          label: "Games",
          data: [3, 1],
          sliceColors: ["emerald", "rose"],
          ...over,
        },
      ],
    });

  it("draws one dataset with a color per slice, a cutout and no axes", () => {
    const config = buildConfig(doughnut(), theme);
    expect(config.type).toBe("doughnut");
    expect(config.data.labels).toEqual(["Completed", "Abandoned"]);
    expect(dataset(config, 0).data).toEqual([3, 1]);
    expect(dataset(config, 0).backgroundColor).toEqual([
      theme.palette.emerald,
      theme.palette.rose,
    ]);
    expect(dataset(config, 0).borderColor).toBe(theme.surface);
    const opts = config.options as unknown as Record<string, unknown>;
    expect(opts.cutout).toBe("34%");
    expect(opts.scales).toBeUndefined();
  });

  it("falls back to the default order for slices without a color", () => {
    const config = buildConfig(doughnut({ sliceColors: undefined }), theme);
    expect(dataset(config, 0).backgroundColor).toEqual([
      theme.palette.sky,
      theme.palette.orange,
    ]);
  });

  it("rejects two slices resolving to one color", () => {
    expect(() =>
      buildConfig(doughnut({ sliceColors: ["rose", "rose"] }), theme),
    ).toThrow(RangeError);
  });

  it("rejects more slices than the default order holds", () => {
    expect(() =>
      buildConfig(
        doughnut({ data: [1, 1, 1, 1, 1, 1, 1], sliceColors: undefined }),
        theme,
      ),
    ).toThrow(RangeError);
  });

  it("builds an empty doughnut with no series", () => {
    const config = buildConfig(doughnut(), theme);
    expect(
      buildConfig(spec({ kind: "doughnut", series: [] }), theme).data.datasets,
    ).toEqual([]);
    expect(config.data.datasets).toHaveLength(1);
  });

  it("turns off the Chart.js legend and canvas tooltip", () => {
    const external = vi.fn();
    const config = buildConfig(doughnut(), theme, external);
    const plugins = (config.options as unknown as Options).plugins;
    expect(plugins.legend.display).toBe(false);
    expect(plugins.tooltip).toEqual({ enabled: false, external });
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

type FakeEl = {
  className: string;
  textContent: string;
  style: Record<string, string>;
  children: FakeEl[];
  offsetWidth?: number;
  clientWidth?: number;
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
    expect(el.className).toContain("w-max");
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

  it("labels a doughnut slice by its own label and color, with no title row", () => {
    const host = fakeHost();
    const { external } = createTooltip(
      host as unknown as HTMLElement,
      theme,
      () => (n) => String(n),
    );

    external({
      tooltip: {
        opacity: 1,
        caretX: 10,
        caretY: 20,
        title: [],
        dataPoints: [
          {
            label: "Abandoned",
            dataIndex: 1,
            dataset: {
              label: "Games",
              backgroundColor: ["rgb(1, 1, 1)", "rgb(2, 2, 2)"],
            },
            parsed: 4,
          },
        ],
      },
    });

    const el = host.children[0];
    expect(el.children).toHaveLength(1);
    const row = el.children[0];
    expect(row.children[0].style.backgroundColor).toBe("rgb(2, 2, 2)");
    expect(row.children[1].textContent).toBe("Abandoned: 4");
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

  describe("horizontal clamp", () => {
    const show = (caretX: number, hostWidth?: number, nodeWidth?: number) => {
      const host = fakeHost();
      host.clientWidth = hostWidth;
      host.ownerDocument.createElement = () => {
        const node = fakeEl();
        node.offsetWidth = nodeWidth;
        return node;
      };
      const { external } = createTooltip(
        host as unknown as HTMLElement,
        theme,
        () => String,
      );
      external({
        tooltip: {
          opacity: 1,
          caretX,
          caretY: 0,
          title: ["Jan"],
          dataPoints: [],
        },
      });
      return host.children[0].style.left;
    };

    it("keeps the tooltip inside the right edge", () => {
      expect(show(290, 300, 100)).toBe("250px");
    });

    it("keeps the tooltip inside the left edge", () => {
      expect(show(10, 300, 100)).toBe("50px");
    });

    it("leaves a caret that already fits alone", () => {
      expect(show(150, 300, 100)).toBe("150px");
    });

    it("does not clamp when a width is missing or zero", () => {
      expect(show(290, undefined, 100)).toBe("290px");
      expect(show(290, 300, undefined)).toBe("290px");
      expect(show(290, 0, 100)).toBe("290px");
      expect(show(290, 300, 0)).toBe("290px");
    });
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

  it("update rebuilds the chart when the kind changes", async () => {
    FakeChart.instances = [];
    const view = new ChartView(fakeCanvas(), theme, { loadChartJs: loaded() });
    await view.mount(spec({ kind: "line" }));
    const first = FakeChart.instances[0];

    view.update(spec({ kind: "bar" }));

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(FakeChart.instances).toHaveLength(2);
    expect(FakeChart.instances[1].config.type).toBe("bar");
  });

  it("an update that lands before Chart.js has loaded is what gets drawn", async () => {
    FakeChart.instances = [];
    let release: (ctor: ChartCtor) => void = () => {};
    const view = new ChartView(fakeCanvas(), theme, {
      loadChartJs: () =>
        new Promise<ChartCtor>((resolve) => (release = resolve)),
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

  it("destroy never throws and still disposes the tooltip when the chart throws", async () => {
    FakeChart.instances = [];
    const canvas = fakeCanvas();
    const view = new ChartView(canvas, theme, { loadChartJs: loaded() });
    await view.mount(spec());
    const { external } = (
      FakeChart.instances[0].options as {
        plugins: { tooltip: { external: (context: unknown) => void } };
      }
    ).plugins.tooltip;
    external({
      tooltip: {
        opacity: 1,
        caretX: 0,
        caretY: 0,
        title: [],
        dataPoints: [],
      },
    });
    const tooltipEl = (canvas.parentElement as unknown as FakeEl).children[0];
    FakeChart.instances[0].destroy.mockImplementation(() => {
      throw new Error("boom");
    });

    expect(() => view.destroy()).not.toThrow();
    expect(tooltipEl.remove).toHaveBeenCalled();
    expect(() => view.update(spec())).not.toThrow();
    expect(FakeChart.instances[0].update).not.toHaveBeenCalled();
  });

  it("creates nothing when destroyed before Chart.js loaded", async () => {
    FakeChart.instances = [];
    let release: (ctor: ChartCtor) => void = () => {};
    const view = new ChartView(fakeCanvas(), theme, {
      loadChartJs: () =>
        new Promise<ChartCtor>((resolve) => (release = resolve)),
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

    await expect(
      view.mount(spec({ series: seriesOf(7) })),
    ).resolves.toBeUndefined();
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

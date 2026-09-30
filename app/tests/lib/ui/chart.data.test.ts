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

const canvas = { tag: "canvas" } as unknown as HTMLCanvasElement;

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

  it("skips the view update when the spec is unchanged", () => {
    const ctx = context();
    ctx.setSpec(spec());
    ctx.setSpec(spec());
    expect(views[0].update).not.toHaveBeenCalled();

    ctx.setSpec(spec({ labels: ["Mar"] }));
    expect(views[0].update).toHaveBeenCalledTimes(1);

    ctx.setSpec(spec({ labels: ["Mar"] }));
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
    const wrap = <T extends object>(target: T): T =>
      new Proxy(target, {
        get(obj, key, receiver) {
          const value = Reflect.get(obj, key, receiver);
          const nested = typeof value === "object" && value !== null;
          return nested || typeof value === "function" ? wrap(value) : value;
        },
      });
    const proxied = wrap(spec());

    ctx.setSpec(proxied);

    const mounted = views[0].mount.mock.calls[0][0] as unknown as ChartSpec;
    expect(types.isProxy(mounted)).toBe(false);
    expect(types.isProxy(mounted.labels)).toBe(false);
    expect(types.isProxy(mounted.series)).toBe(false);
    expect(types.isProxy(mounted.series[0])).toBe(false);
    expect(types.isProxy(mounted.series[0].data)).toBe(false);
    expect(types.isProxy(mounted.format)).toBe(false);
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
    expect(ctx.swatch({ ...plain, color: "rose" }, 0)).toBe(
      "var(--chart-rose)",
    );
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

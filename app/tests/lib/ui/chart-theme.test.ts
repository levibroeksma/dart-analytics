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
    readPixel: (css) =>
      css === "css(--chart-grid)" ? [255, 255, 255, 15] : [1, 2, 3, 255],
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

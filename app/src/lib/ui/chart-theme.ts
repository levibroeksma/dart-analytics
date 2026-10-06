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
  "glass-tinted rounded-lg px-3 py-2 text-xs text-foreground";

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
  const color = (token: string) =>
    formatRgba(env.readPixel(env.readVar(token)));
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

import type { ChartConfiguration } from "chart.js";
export type ToggleOption = { value: string; label: string };
export type Orientation = "horizontal" | "vertical";
export type Pill = { w: number; h: number; x: number; y: number };

export type ToggleOpts = {
  options: ToggleOption[];
  orientation: Orientation;
  initial?: string;
  onPillChange?: (pill: Pill) => void;
};

export type WakeLockStatus =
  "idle" | "unsupported" | "requesting" | "held" | "released" | "blocked";

export type WakeLockEvent = {
  status: WakeLockStatus;
  detail?: string;
  at: number;
};

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

/** The slice of `CanvasRenderingContext2D` the heatmap drawer touches; a test fakes exactly this. */
export type HeatCanvasContext = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "clearRect"
  | "createRadialGradient"
  | "beginPath"
  | "arc"
  | "fill"
  | "getImageData"
  | "putImageData"
>;

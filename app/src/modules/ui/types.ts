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

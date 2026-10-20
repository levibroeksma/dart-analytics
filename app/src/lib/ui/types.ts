/** One tick under a `RangeSlider`, as a 0–1 track position. */
export type SliderTick = { fraction: number; major: boolean };

/** One `LegBars` pill: a leg already won, or one still to win. */
export type LegBarState = "won" | "open";

/** A dart slot's outcome in the visit strip; `value` is a filled dart carrying a label. */
export type PreviewStatus = "hit" | "miss" | "value" | "empty";

/** One visit-strip column; `next` marks the dart about to be thrown. */
export type PreviewColumn = {
  status: PreviewStatus;
  next: boolean;
  label?: string;
};

/** The ring armed on the Cricket / Tactics tap input. */
export type TapRing = "SINGLE" | "DOUBLE" | "TREBLE";

/** A ring key's label on that input. */
export type RingKey = "S" | "D" | "T";

/** Where a game card's dart is in its hover and throw sequence. */
export type CardThrowPhase = "rest" | "hover" | "wind" | "throw" | "reset";

/** Seams `cardThrow()` takes so navigation, motion preference and timers can be faked. */
export type CardThrowDeps = {
  navigate?: (href: string) => void;
  reducedMotion?: () => boolean;
  schedule?: (fn: () => void, ms: number) => void;
};

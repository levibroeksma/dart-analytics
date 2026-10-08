/** One tick under a `RangeSlider`, as a 0–1 track position. */
export type SliderTick = { fraction: number; major: boolean };

/** One `LegBars` pill: a leg already won, or one still to win. */
export type LegBarState = "won" | "open";

/** A dart slot's outcome in the visit strip. */
export type PreviewStatus = "hit" | "miss" | "empty";

/** One visit-strip column; `next` marks the dart about to be thrown. */
export type PreviewColumn = { status: PreviewStatus; next: boolean };

/** The ring armed on the Cricket / Tactics tap input. */
export type TapRing = "SINGLE" | "DOUBLE" | "TREBLE";

/** A ring key's label on that input. */
export type RingKey = "S" | "D" | "T";

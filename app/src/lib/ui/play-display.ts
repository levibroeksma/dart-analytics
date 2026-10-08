import type {
  LegBarState,
  PreviewColumn,
  PreviewStatus,
  RingKey,
  TapRing,
} from "./types";

/** Above this many legs to win, `LegBars` shows a `won/target` counter. */
const MAX_LEG_BARS = 5;

const RING_KEY: Readonly<Record<TapRing, RingKey>> = {
  SINGLE: "S",
  DOUBLE: "D",
  TREBLE: "T",
};

function charCount(value: unknown): number {
  return String(value ?? "").length;
}

/**
 * Font-size class for the solo scoreboard's big value, stepped by length so
 * it fits the card's left column: up to 2 characters 84px, 3 → 64px,
 * 4 or more → 46px.
 */
export function bigValueSize(value: unknown): string {
  const length = charCount(value);
  if (length <= 2) return "text-[84px]";
  if (length === 3) return "text-[64px]";
  return "text-[46px]";
}

/** Font-size class for the active seat card's score: 64px up to 3 characters, 46px from 4. */
export function seatValueSize(value: unknown): string {
  return charCount(value) <= 3 ? "text-[64px]" : "text-[46px]";
}

/**
 * One bar per leg to win, the first `won` of them filled. `null` above
 * `MAX_LEG_BARS` legs, where `LegBars` shows a `won/target` counter instead.
 */
export function legBarStates(won: number, toWin: number): LegBarState[] | null {
  if (toWin > MAX_LEG_BARS) return null;
  return Array.from({ length: Math.max(toWin, 0) }, (_, index) =>
    index < won ? "won" : "open",
  );
}

/** The visit strip's columns; only the first empty dart is `next`. */
export function previewColumnState(
  segments: readonly { status: PreviewStatus }[],
): PreviewColumn[] {
  const nextIndex = segments.findIndex((segment) => segment.status === "empty");
  return segments.map((segment, index) => ({
    status: segment.status,
    next: index === nextIndex,
  }));
}

/** Whether a ring key lights for the armed ring: S for SINGLE, D for DOUBLE, T for TREBLE. */
export function ringKeyActive(ring: TapRing, key: RingKey): boolean {
  return RING_KEY[ring] === key;
}

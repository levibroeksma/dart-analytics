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
 * Container-query size for a value of 6 or more characters (a 10,000+ total,
 * a Quick Subtract equation): it scales with the `@container` column's width
 * instead of a fixed step, capped at 46px. `null` below 6 characters.
 */
function longValueSize(length: number): string | null {
  if (length < 6) return null;
  if (length === 6) return "text-[clamp(1.25rem,17cqw,2.875rem)]";
  if (length <= 8) return "text-[clamp(1.125rem,13cqw,2.875rem)]";
  return "text-[clamp(1rem,11cqw,2.875rem)]";
}

/**
 * Font-size class for the solo scoreboard's big value, stepped by length so
 * it fits the card's left column: up to 2 characters 84px, 3 → 64px,
 * 4–5 → 46px, 6 or more → a container-query size (`longValueSize`).
 */
export function bigValueSize(value: unknown): string {
  const length = charCount(value);
  if (length <= 2) return "text-[84px]";
  if (length === 3) return "text-[64px]";
  return longValueSize(length) ?? "text-[46px]";
}

/**
 * Font-size class for the active seat card's score: 64px up to 3 characters,
 * 46px for 4–5, a container-query size from 6 (`longValueSize`).
 */
export function seatValueSize(value: unknown): string {
  const length = charCount(value);
  if (length <= 3) return "text-[64px]";
  return longValueSize(length) ?? "text-[46px]";
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

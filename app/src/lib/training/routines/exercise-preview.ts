import { dartLabel } from "@modules/stats/sections/checkout-path.module";
import type { DartFact, TurnFact } from "@modules/types";
import type { PreviewSegment } from "@lib/types";
import type { DartJudgement } from "./types";

/** `length` items of `items` from `start`, wrapping both ways. */
export function cycleFrom<T>(
  items: readonly T[],
  start: number,
  length: number,
): T[] {
  const size = items.length;
  return Array.from(
    { length },
    (_, i) => items[(((start + i) % size) + size) % size],
  );
}

/**
 * The exercise visit preview: the latest visit's darts, one slot per dart
 * that visit throws. A landed dart is captioned with its zone (`T20`, `25`)
 * unless it missed; an empty slot with the target it will be thrown at. A
 * finished visit stays on screen until the next dart opens a new one.
 */
export function visitPreview(input: {
  turns: readonly TurnFact[];
  visitLabels: (visitIndex: number) => readonly (string | undefined)[];
  judge: (dart: DartFact, index: number) => DartJudgement;
}): PreviewSegment[] {
  const visitIndex = Math.max(input.turns.length - 1, 0);
  const darts = input.turns.at(-1)?.darts ?? [];
  return input.visitLabels(visitIndex).map((label, index): PreviewSegment => {
    const dart = darts[index];
    if (!dart) return { status: "empty", label };
    const status = input.judge(dart, index);
    return status === "miss" ? { status } : { status, label: dartLabel(dart) };
  });
}

/** Bull Up's one-slot preview: the throw about to be made. */
export function bullUpPreview(throws: number): PreviewSegment[] {
  return [{ status: "empty", label: `THROW ${throws + 1}` }];
}

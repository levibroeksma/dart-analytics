import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import type { TargetOrderMode } from "./types";

/**
 * The default V1 order: 1..20, then BULL. Also the shape `target_order`
 * takes in every seeded preset.
 */
export function ascendingTargetOrder(): number[] {
  return [...Array.from({ length: 20 }, (_, i) => i + 1), BULL_TARGET_NUMBER];
}

/**
 * BULL leads, then 20 down to 1 — the reverse of `ascendingTargetOrder`
 * with BULL moved to the front rather than staying last.
 */
export function descendingTargetOrder(): number[] {
  return [BULL_TARGET_NUMBER, ...Array.from({ length: 20 }, (_, i) => 20 - i)];
}

/**
 * Fisher–Yates shuffle of all 21 targets (1..20 + BULL) — BULL can land
 * anywhere in the result, including mid-session. `Math.random()` is
 * sufficient: this orders dart-practice targets, not a security-sensitive
 * value.
 */
export function randomTargetOrder(): number[] {
  const order = ascendingTargetOrder();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order;
}

export function targetOrderFor(mode: TargetOrderMode): number[] {
  if (mode === "HIGH_TO_LOW") return descendingTargetOrder();
  if (mode === "RANDOM") return randomTargetOrder();
  return ascendingTargetOrder();
}

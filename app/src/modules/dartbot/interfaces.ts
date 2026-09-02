import type { BoardTarget } from "@modules/types";

export interface DartRng {
  uniform(): number;
  gaussianPair(): [number, number];
}

/**
 * Read-only view a dictated-target ruleset hands the strategy: the one
 * `BoardTarget` its own progression currently points at. The app's adapter
 * resolves this from engine state (`targetAt(path, seat.targetIndex)`); the
 * strategy never reads seat state or engine state itself.
 */
export interface DictatedView {
  target: BoardTarget;
}

/**
 * Read-only view a checkout-routing ruleset hands the strategy: the seat's
 * own remaining score, and the checkout route for it — `checkoutPathFor()`,
 * computed by the page adapter every time this is built, since
 * `modules/dartbot/*` may not import ruleset math (`08-DartBot.md` §Import
 * direction). `null` when no route exists (a bogey number, or above 170).
 */
export interface X01View {
  remaining: number;
  checkoutPath: readonly string[] | null;
}

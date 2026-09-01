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

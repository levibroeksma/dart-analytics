import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";
import { LegacyDoublesTrainingEngine } from "./legacy/doubles-training.legacy";
import { runOracle } from "./support/engine-oracle";
import type { DoublesTrainingSnapshot, Seated } from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const LOW = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const config = (
  seats: number,
  targetOrder: number[] = LOW,
): Seated<DoublesTrainingSnapshot> => ({
  mode: "EASY",
  orderMode: "LOW_TO_HIGH",
  targetOrder,
  seats: Array.from({ length: seats }, (_, i) => seat(i + 1, "ABC"[i]!)),
});
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Doubles Training — kernel vs legacy oracle", () => {
  for (const [name, cfg] of [
    ["solo", config(1)],
    ["duo", config(2)],
    ["trio", config(3)],
    ["solo high-to-low", config(1, [...LOW].reverse())],
  ] as const) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new DoublesTrainingEngine(cfg, prior),
        legacy: (prior) => new LegacyDoublesTrainingEngine(cfg, prior),
        seeds: SEEDS,
        steps: 260,
        undoRate: 0.12,
        rehydrateEvery: 19,
      });
    }, 60_000);
  }
});

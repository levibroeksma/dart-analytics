import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";
import { normalise, randomObservation } from "./support/engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { DoublesTrainingSnapshot, Seated } from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const ORDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const CONFIGS: Record<string, Seated<DoublesTrainingSnapshot>> = {
  solo: {
    mode: "EASY",
    orderMode: "LOW_TO_HIGH",
    targetOrder: ORDER,
    seats: [seat(1, "A")],
  },
  duo: {
    mode: "EASY",
    orderMode: "LOW_TO_HIGH",
    targetOrder: ORDER,
    seats: [seat(1, "A"), seat(2, "B")],
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Doubles Training — golden", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new DoublesTrainingEngine(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 160 && !engine.isComplete(); i += 1) {
        if (rand() < 0.1) engine.undo();
        else engine.record(randomObservation(rand));
      }
      expect(
        normalise({ facts: engine.facts(), state: engine.state() }),
      ).toMatchSnapshot();
    });
  }
});

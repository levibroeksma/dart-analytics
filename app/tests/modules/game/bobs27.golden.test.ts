import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";
import { normalise, randomObservation } from "./support/engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { Bobs27Snapshot, Seated } from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const CONFIGS: Record<string, Seated<Bobs27Snapshot>> = {
  solo: {
    startScore: 27,
    bullHitValue: 50,
    missPenaltyMultiplier: 1,
    seats: [seat(1, "A")],
  },
  duo: {
    startScore: 27,
    bullHitValue: 50,
    missPenaltyMultiplier: 1,
    seats: [seat(1, "A"), seat(2, "B")],
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Bob's 27 — golden", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new Bobs27Engine(config);
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

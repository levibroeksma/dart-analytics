import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Bobs27Engine,
  bobs27V2EngineFactory,
} from "@modules/game/bobs27.engine.module";
import {
  goldenTrace,
  normalise,
  randomObservation,
} from "./support/engine-oracle";
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
  trio: {
    startScore: 27,
    bullHitValue: 50,
    missPenaltyMultiplier: 1,
    seats: [seat(1, "A"), seat(2, "B"), seat(3, "C")],
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

describe("Bob's 27 — golden trace", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new Bobs27Engine(config, prior),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
        }),
      ).toMatchSnapshot();
    });
  }
});

describe("Bob's 27 — refusal order", () => {
  it("refuses an ended seat with the game-ended message while the match runs on", () => {
    const messages = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const engine = new Bobs27Engine(CONFIGS.trio);
      const rand = seededUniform(seed, 0);
      for (let i = 0; i < 400; i += 1) {
        try {
          engine.record(randomObservation(rand));
        } catch (error) {
          if (engine.state().status === "IN_PROGRESS")
            messages.add((error as Error).message);
        }
      }
    }
    expect([...messages]).toEqual([
      "Cannot record a dart once the game has ended; undo first to correct it.",
    ]);
  }, 30_000);

  it("refuses an ended match with the match-ended message", () => {
    const engine = new Bobs27Engine(CONFIGS.solo);
    const rand = seededUniform(42, 0);
    let message = "";
    for (let i = 0; i < 400 && message === ""; i += 1) {
      try {
        engine.record(randomObservation(rand));
      } catch (error) {
        message = (error as Error).message;
      }
    }
    expect(engine.state().status).not.toBe("IN_PROGRESS");
    expect(message).toBe(
      "Cannot record a dart once the match has ended; undo first to correct it.",
    );
  });
});

const EASY_CONFIGS: Record<string, Seated<Bobs27Snapshot>> = {
  easySolo: { ...CONFIGS.solo, mode: "EASY" },
  easyDuo: { ...CONFIGS.duo, mode: "EASY" },
};

describe("Bob's 27 Easy — golden", () => {
  for (const [name, config] of Object.entries(EASY_CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = bobs27V2EngineFactory.create(config);
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

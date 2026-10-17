import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShanghaiEngine } from "@modules/game/shanghai.engine.module";
import { numbersPath } from "@modules/game/board-progression.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { aimedOnPath } from "./support/aimed-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type {
  RulesetVersionKey,
  Seated,
  ShanghaiSnapshot,
  ShanghaiV2Snapshot,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const observe = aimedOnPath(numbersPath(), 0.55);

const CONFIGS: Record<
  string,
  {
    key: RulesetVersionKey;
    config: Seated<ShanghaiSnapshot> | Seated<ShanghaiV2Snapshot>;
  }
> = {
  "v1 solo": { key: "SHANGHAI_V1", config: { seats: seats(1) } },
  "v1 duo": { key: "SHANGHAI_V1", config: { seats: seats(2) } },
  "v2 hard solo": {
    key: "SHANGHAI_V2",
    config: { difficulty: "HARD", seats: seats(1) },
  },
  "v2 hard trio": {
    key: "SHANGHAI_V2",
    config: { difficulty: "HARD", seats: seats(3) },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Shanghai — golden", () => {
  for (const [name, { key, config }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new ShanghaiEngine(config, undefined, key);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 260 && !engine.isComplete(); i += 1) {
        if (rand() < 0.1) engine.undo();
        else engine.record(observe(rand, engine));
      }
      expect(
        normalise({
          key: engine.rulesetVersionKey,
          facts: engine.facts(),
          state: engine.state(),
        }),
      ).toMatchSnapshot();
    });
  }
});

describe("Shanghai — golden trace", () => {
  for (const [name, { key, config }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new ShanghaiEngine(config, prior, key),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          observe,
        }),
      ).toMatchSnapshot();
    });
  }
});

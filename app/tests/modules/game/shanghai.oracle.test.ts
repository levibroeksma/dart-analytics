import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { ShanghaiEngine } from "@modules/game/shanghai.engine.module";
import { numbersPath } from "@modules/game/board-progression.module";
import { LegacyShanghaiEngine } from "./legacy/shanghai.legacy";
import { runOracle } from "./support/engine-oracle";
import { aimedOnPath } from "./support/aimed-observations";
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
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);
const V1 = "SHANGHAI_V1";
const V2 = "SHANGHAI_V2";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [
  string,
  RulesetVersionKey,
  Seated<ShanghaiSnapshot> | Seated<ShanghaiV2Snapshot>,
][] = [
  ["v1 solo", V1, { seats: seats(1) }],
  ["v1 duo", V1, { seats: seats(2) }],
  ["v1 trio", V1, { seats: seats(3) }],
  ["v2 normal duo", V2, { difficulty: "NORMAL", seats: seats(2) }],
  ["v2 hard solo", V2, { difficulty: "HARD", seats: seats(1) }],
  ["v2 hard duo", V2, { difficulty: "HARD", seats: seats(2) }],
  ["v2 hard trio", V2, { difficulty: "HARD", seats: seats(3) }],
];

describe("Shanghai — kernel vs legacy oracle", () => {
  for (const [name, key, cfg] of CASES) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new ShanghaiEngine(cfg, prior, key),
        legacy: (prior) => new LegacyShanghaiEngine(cfg, prior, key),
        seeds: SEEDS,
        steps: 260,
        undoRate: 0.12,
        rehydrateEvery: 19,
        observe: aimedOnPath(numbersPath(), 0.55),
      });
    }, 60_000);
  }
});

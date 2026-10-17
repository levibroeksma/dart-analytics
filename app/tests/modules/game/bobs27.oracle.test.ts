import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";
import { LegacyBobs27Engine } from "./legacy/bobs27.legacy";
import { runOracle } from "./support/engine-oracle";
import type { Bobs27Snapshot, Seated } from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const config = (
  seats: number,
  rules: Bobs27Snapshot = {
    startScore: 27,
    bullHitValue: 50,
    missPenaltyMultiplier: 1,
  },
): Seated<Bobs27Snapshot> => ({
  ...rules,
  seats: Array.from({ length: seats }, (_, i) => seat(i + 1, "ABC"[i]!)),
});
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Bob's 27 — kernel vs legacy oracle", () => {
  for (const [name, cfg] of [
    ["solo", config(1)],
    ["duo", config(2)],
    ["trio", config(3)],
    [
      "solo harsh",
      config(1, { startScore: 10, bullHitValue: 25, missPenaltyMultiplier: 2 }),
    ],
    [
      "duo generous",
      config(2, { startScore: 60, bullHitValue: 50, missPenaltyMultiplier: 1 }),
    ],
  ] as const) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new Bobs27Engine(cfg, prior),
        legacy: (prior) => new LegacyBobs27Engine(cfg, prior),
        seeds: SEEDS,
        steps: 260,
        undoRate: 0.12,
        rehydrateEvery: 19,
      });
    }, 60_000);
  }
});

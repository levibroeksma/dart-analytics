import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { CricketEngine } from "@modules/game/cricket.engine.module";
import { LegacyCricketEngine } from "./legacy/marks.legacy";
import { runOracle } from "./support/engine-oracle";
import { marksObservation } from "./support/marks-observations";
import type { CricketSnapshot, RulesetVersionKey, Seated } from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});

const config = (n: number): Seated<CricketSnapshot> => ({
  seats: Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!)),
});

const CASES: [string, Seated<CricketSnapshot>, RulesetVersionKey][] = [
  ["solo V1", config(1), "CRICKET_V1"],
  ["solo V2", config(1), "CRICKET_V2"],
  ["duel V2", config(2), "CRICKET_V2"],
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Cricket — kernel vs legacy oracle", () => {
  for (const [name, cfg, key] of CASES) {
    it(`${name}: indistinguishable from the MarksEngine copy`, () => {
      runOracle({
        build: (prior) => new CricketEngine(cfg, prior, key as never),
        legacy: (prior) => new LegacyCricketEngine(cfg, prior, key),
        seeds: [1, 2, 3, 4, 5],
        steps: 400,
        undoRate: 0.1,
        rehydrateEvery: 25,
        observe: marksObservation,
      });
    });
  }
});

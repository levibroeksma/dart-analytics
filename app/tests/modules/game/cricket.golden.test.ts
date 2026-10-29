import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CricketEngine } from "@modules/game/cricket.engine.module";
import { goldenTrace } from "./support/engine-oracle";
import { marksObservation } from "./support/marks-observations";
import type { CricketSnapshot, RulesetVersionKey, Seated } from "@lib/types";

/*
 * Recorded on the MarksEngine-based engine before its rebind onto the marks
 * kernel and the game shell.
 */

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

describe("Cricket — golden trace", () => {
  for (const [name, cfg, key] of CASES) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new CricketEngine(cfg, prior, key),
          seed: 7,
          steps: 300,
          undoRate: 0.1,
          rehydrateEvery: 7,
          observe: marksObservation,
        }),
      ).toMatchSnapshot();
    });
  }
});

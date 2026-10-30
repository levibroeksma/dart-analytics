import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TacticsEngine } from "@modules/game/tactics.engine.module";
import { goldenTrace } from "./support/engine-oracle";
import { marksObservation } from "./support/marks-observations";
import type { TacticsSnapshot, RulesetVersionKey, Seated } from "@lib/types";

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

const config = (n: number): Seated<TacticsSnapshot> => ({
  seats: Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!)),
});

const CASES: [string, Seated<TacticsSnapshot>, RulesetVersionKey][] = [
  ["solo V1", config(1), "TACTICS_V1"],
  ["solo V2", config(1), "TACTICS_V2"],
  ["duel V2", config(2), "TACTICS_V2"],
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Tactics — golden trace", () => {
  for (const [name, cfg, key] of CASES) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new TacticsEngine(cfg, prior, key),
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

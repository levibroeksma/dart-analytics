import { describe, expect, it } from "vitest";
import {
  averageDartsPerLeg,
  bestLegDarts,
} from "@modules/stats/leg-stats.module";
import type { PlayerLegFactRow } from "@modules/types";

function leg(overrides: Partial<PlayerLegFactRow> = {}): PlayerLegFactRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    stageId: "stage-1",
    totalDartsInLeg: 15,
    ...overrides,
  };
}

describe("bestLegDarts", () => {
  it("returns null for no legs", () => {
    expect(bestLegDarts([])).toBeNull();
  });

  it("returns the fewest darts across legs", () => {
    const rows = [
      leg({ totalDartsInLeg: 15 }),
      leg({ totalDartsInLeg: 9 }),
      leg({ totalDartsInLeg: 12 }),
    ];
    expect(bestLegDarts(rows)).toBe(9);
  });
});

describe("averageDartsPerLeg", () => {
  it("returns null for no legs", () => {
    expect(averageDartsPerLeg([])).toBeNull();
  });

  it("averages darts across legs", () => {
    const rows = [leg({ totalDartsInLeg: 12 }), leg({ totalDartsInLeg: 18 })];
    expect(averageDartsPerLeg(rows)).toBe(15);
  });
});

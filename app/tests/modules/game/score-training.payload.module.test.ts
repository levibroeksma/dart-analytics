import { describe, it, expect } from "vitest";
import { buildEventsBatch } from "@modules/game/score-training.payload.module";

describe("buildEventsBatch", () => {
  it("wraps all turns into a single flat EXERCISE_BLOCK stage with no darts", () => {
    const batch = buildEventsBatch("participant-1", [
      {
        clientKey: "t1",
        sequence: 1,
        totalScore: 45,
        completedAt: "2026-07-16T00:00:00.000Z",
      },
      {
        clientKey: "t2",
        sequence: 2,
        totalScore: 60,
        completedAt: "2026-07-16T00:01:00.000Z",
      },
    ]);
    expect(batch.stages).toHaveLength(1);
    expect(batch.stages[0].stageTypeKey).toBe("EXERCISE_BLOCK");
    expect(batch.stages[0].parentClientKey).toBeNull();
    expect(batch.stages[0].turns).toHaveLength(2);
    expect(batch.stages[0].turns[0]).toMatchObject({
      clientKey: "t1",
      participantRef: "participant-1",
      sequence: 1,
      totalScore: 45,
      darts: [],
    });
  });
});

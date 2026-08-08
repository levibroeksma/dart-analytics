import { describe, expect, it } from "vitest";
import { buildEventsBatch } from "@modules/game/events.payload.module";

describe("buildEventsBatch", () => {
  it("nests turns under the stage that owns them", () => {
    const batch = buildEventsBatch("participant-1", {
      stages: [
        {
          clientKey: "leg-1",
          stageTypeKey: "LEG",
          parentClientKey: null,
          sequence: 1,
        },
        {
          clientKey: "leg-2",
          stageTypeKey: "LEG",
          parentClientKey: null,
          sequence: 2,
        },
      ],
      turns: [
        {
          clientKey: "t1",
          stageClientKey: "leg-1",
          sequence: 1,
          completedAt: "2026-07-25T10:00:00.000Z",
          totalScore: 60,
          darts: [],
        },
        {
          clientKey: "t2",
          stageClientKey: "leg-2",
          sequence: 1,
          completedAt: "2026-07-25T10:01:00.000Z",
          totalScore: 45,
          darts: [],
        },
      ],
    });

    expect(batch.stages).toHaveLength(2);
    expect(batch.stages[0].turns.map((t) => t.clientKey)).toEqual(["t1"]);
    expect(batch.stages[1].turns.map((t) => t.clientKey)).toEqual(["t2"]);
    expect(batch.stages[0].turns[0].participantRef).toBe("participant-1");
  });

  it("emits an empty darts array under quick-score capture", () => {
    const batch = buildEventsBatch("participant-1", {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [
        {
          clientKey: "t1",
          stageClientKey: "block-1",
          sequence: 1,
          completedAt: "2026-07-25T10:00:00.000Z",
          totalScore: 100,
          darts: [],
        },
      ],
    });
    expect(batch.stages[0].turns[0].darts).toEqual([]);
  });

  it("carries dart facts through unchanged when present", () => {
    const dart = {
      sequence: 1,
      intendedTargetNumber: 1,
      intendedZoneKey: "DOUBLE" as const,
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE" as const,
      score: 2,
      locationX: null,
      locationY: null,
    };
    const batch = buildEventsBatch("participant-1", {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [
        {
          clientKey: "t1",
          stageClientKey: "block-1",
          sequence: 1,
          completedAt: "2026-07-25T10:00:00.000Z",
          totalScore: 2,
          darts: [dart],
        },
      ],
    });
    expect(batch.stages[0].turns[0].darts).toEqual([dart]);
  });

  it("throws when a turn's stageClientKey matches no stage", () => {
    expect(() =>
      buildEventsBatch("participant-1", {
        stages: [
          {
            clientKey: "leg-1",
            stageTypeKey: "LEG",
            parentClientKey: null,
            sequence: 1,
          },
        ],
        turns: [
          {
            clientKey: "t1",
            stageClientKey: "leg-orphan",
            sequence: 1,
            completedAt: "2026-07-25T10:00:00.000Z",
            totalScore: 60,
            darts: [],
          },
        ],
      }),
    ).toThrow("No stage matching stageClientKey leg-orphan for turn t1");
  });

  it("emits a stage with no turns rather than dropping it", () => {
    const batch = buildEventsBatch("participant-1", {
      stages: [
        {
          clientKey: "leg-1",
          stageTypeKey: "LEG",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [],
    });
    expect(batch.stages[0].turns).toEqual([]);
  });
});

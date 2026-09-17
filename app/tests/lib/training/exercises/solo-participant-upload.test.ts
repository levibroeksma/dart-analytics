import { describe, it, expect } from "vitest";
import { resolveSoloParticipantRef } from "@lib/training/exercises/solo-participant-upload";

describe("resolveSoloParticipantRef", () => {
  it("replaces every turn's solo participantRef with the real one", () => {
    const facts = {
      stages: [
        {
          clientKey: "st1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [
        {
          clientKey: "t1",
          participantRef: "solo",
          sequence: 1,
          totalScore: 0,
          completedAt: null,
          darts: [],
        },
      ],
    };
    const result = resolveSoloParticipantRef(facts as never, "pt-real-1");
    expect(result.turns[0].participantRef).toBe("pt-real-1");
  });

  it("leaves stages untouched", () => {
    const facts = {
      stages: [
        {
          clientKey: "st1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [],
    };
    const result = resolveSoloParticipantRef(facts as never, "pt-real-1");
    expect(result.stages).toEqual(facts.stages);
  });

  it("leaves an already-real participantRef unchanged", () => {
    const facts = {
      stages: [],
      turns: [
        {
          clientKey: "t1",
          participantRef: "pt-other",
          sequence: 1,
          totalScore: 0,
          completedAt: null,
          darts: [],
        },
      ],
    };
    const result = resolveSoloParticipantRef(facts as never, "pt-real-1");
    expect(result.turns[0].participantRef).toBe("pt-other");
  });
});

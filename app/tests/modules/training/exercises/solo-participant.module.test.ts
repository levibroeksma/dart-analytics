import { describe, expect, it } from "vitest";
import { SOLO_PARTICIPANT_REF } from "@modules/training/exercises/solo-participant.module";

describe("SOLO_PARTICIPANT_REF", () => {
  it("is the fixed participant ref every solo exercise session logs under", () => {
    expect(SOLO_PARTICIPANT_REF).toBe("solo");
  });
});

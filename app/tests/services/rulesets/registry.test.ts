import { describe, it, expect } from "vitest";
import { getRulesetValidator } from "@services/rulesets/registry";

describe("getRulesetValidator", () => {
  it("returns the Score Training validator for SCORE_TRAINING_V1", () => {
    expect(getRulesetValidator("SCORE_TRAINING_V1")).toBeDefined();
  });

  it("returns the Bob's 27 validator for BOBS27_V1", () => {
    expect(getRulesetValidator("BOBS27_V1")).toBeDefined();
  });

  it("returns the Singles Training validator for SINGLES_V1", () => {
    expect(getRulesetValidator("SINGLES_V1")).toBeDefined();
  });

  it("returns the Doubles Training validator for DOUBLES_TRAINING_V1", () => {
    expect(getRulesetValidator("DOUBLES_TRAINING_V1")).toBeDefined();
  });

  it("returns the 501 validator for 501_V1", () => {
    expect(getRulesetValidator("501_V1")).toBeDefined();
  });

  it("returns the TUOD validator for TUOD_V1", () => {
    expect(getRulesetValidator("TUOD_V1")).toBeDefined();
  });

  it("returns undefined for an unknown ruleset key", () => {
    expect(getRulesetValidator("NOT_A_RULESET")).toBeUndefined();
  });
});

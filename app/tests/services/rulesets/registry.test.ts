import { describe, it, expect } from "vitest";
import { getRulesetValidator } from "@services/rulesets/registry";
import { bobs27V2Validator } from "@services/rulesets/bobs27/bobs27.validator";
import {
  aroundTheClockV2Validator,
  aroundTheClockV3Validator,
} from "@services/rulesets/around-the-clock/around-the-clock.validator";

describe("getRulesetValidator", () => {
  it("returns the Score Training validator for SCORE_TRAINING_V1", () => {
    expect(getRulesetValidator("SCORE_TRAINING_V1")).toBeDefined();
  });

  it("returns the Bob's 27 validator for BOBS27_V1", () => {
    expect(getRulesetValidator("BOBS27_V1")).toBeDefined();
  });

  it("returns the Cricket validator for CRICKET_V2", () => {
    expect(getRulesetValidator("CRICKET_V2")).toBe(
      getRulesetValidator("CRICKET_V1"),
    );
  });

  it("returns the Tactics validator for TACTICS_V2", () => {
    expect(getRulesetValidator("TACTICS_V2")).toBe(
      getRulesetValidator("TACTICS_V1"),
    );
  });

  it("returns the Bob's 27 V2 validator for BOBS27_V2", () => {
    expect(getRulesetValidator("BOBS27_V2")).toBe(bobs27V2Validator);
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

  it("returns the 121 V2 validator for 121_V2", () => {
    expect(getRulesetValidator("121_V2")).toBeDefined();
  });

  it("returns the Shanghai V2 validator for SHANGHAI_V2", () => {
    expect(getRulesetValidator("SHANGHAI_V2")).toBeDefined();
  });

  it("returns the Shanghai V3 validator for SHANGHAI_V3", () => {
    expect(getRulesetValidator("SHANGHAI_V3")).toBeDefined();
  });

  it("returns the Singles Training V2 validator for SINGLES_V2", () => {
    expect(getRulesetValidator("SINGLES_V2")).toBeDefined();
  });

  it("returns the Around the Clock V2 validator for AROUND_THE_CLOCK_V2", () => {
    expect(getRulesetValidator("AROUND_THE_CLOCK_V2")).toBe(
      aroundTheClockV2Validator,
    );
  });

  it("returns the Around the Clock V3 validator for AROUND_THE_CLOCK_V3", () => {
    expect(getRulesetValidator("AROUND_THE_CLOCK_V3")).toBe(
      aroundTheClockV3Validator,
    );
  });

  it("returns undefined for an unknown ruleset key", () => {
    expect(getRulesetValidator("NOT_A_RULESET")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";

describe("resolveSessionModePair", () => {
  it("passes through the player's chosen pair when the ruleset supports it", () => {
    expect(
      resolveSessionModePair("501_V1", {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      }),
    ).toEqual({ captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" });
  });

  it("passes through quick score unchanged", () => {
    expect(
      resolveSessionModePair("SCORE_TRAINING_V1", {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }),
    ).toEqual({ captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" });
  });

  it("falls back to quick score when the chosen pair is not declared for the ruleset", () => {
    expect(
      resolveSessionModePair("501_V1", {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      }),
    ).toEqual({ captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" });
  });

  it("falls back to quick score when settings is undefined", () => {
    expect(resolveSessionModePair("501_V1", undefined)).toEqual({
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
  });

  it("falls back to quick score when settings is null", () => {
    expect(resolveSessionModePair("SCORE_TRAINING_V1", null)).toEqual({
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
  });

  it("falls back to quick score when settings is missing a field", () => {
    expect(
      resolveSessionModePair("501_V1", { captureModeKey: "ANALYTICS" }),
    ).toEqual({ captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" });
  });

  it("falls back to the ruleset's own first declared pair for a ruleset without QUICK_SCORE", () => {
    expect(resolveSessionModePair("BOBS27_V1", undefined)).toEqual({
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
  });

  it("falls back to the ruleset's own first declared pair when the chosen pair is undeclared", () => {
    expect(
      resolveSessionModePair("BOBS27_V1", {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }),
    ).toEqual({
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
  });

  it("passes through Bob's 27's visual-board pair when chosen", () => {
    expect(
      resolveSessionModePair("BOBS27_V1", {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      }),
    ).toEqual({ captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" });
  });
});

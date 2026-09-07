import { describe, it, expect } from "vitest";
import {
  isScoreInputActivationAccepted,
  SCORE_INPUT_GHOST_MS,
} from "@modules/game/score-input-activation.module";

describe("isScoreInputActivationAccepted", () => {
  it("accepts a first activation with no prior press (infinite elapsed)", () => {
    expect(isScoreInputActivationAccepted(undefined, Infinity)).toBe(true);
  });

  it("rejects an activation inside the ghost window", () => {
    expect(
      isScoreInputActivationAccepted(undefined, SCORE_INPUT_GHOST_MS - 1),
    ).toBe(false);
  });

  it("accepts an activation exactly at the ghost window boundary", () => {
    expect(
      isScoreInputActivationAccepted(undefined, SCORE_INPUT_GHOST_MS),
    ).toBe(true);
  });

  it("rejects event.detail > 2 even outside the ghost window", () => {
    expect(isScoreInputActivationAccepted({ detail: 3 }, Infinity)).toBe(false);
  });

  it("accepts event.detail of 1 or 2 outside the ghost window", () => {
    expect(isScoreInputActivationAccepted({ detail: 1 }, Infinity)).toBe(true);
    expect(isScoreInputActivationAccepted({ detail: 2 }, Infinity)).toBe(true);
  });
});

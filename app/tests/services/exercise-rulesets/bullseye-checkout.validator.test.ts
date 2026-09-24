import { describe, expect, it } from "vitest";
import { bullseyeCheckoutValidator } from "@services/exercise-rulesets/bullseye-checkout/bullseye-checkout.validator";

const VALID = { startScore: 81 };

describe("bullseyeCheckoutValidator.validateConfig", () => {
  it("accepts the 81 start score", () => {
    const result = bullseyeCheckoutValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects another start score, naming startScore", () => {
    const result = bullseyeCheckoutValidator.validateConfig({
      config: { startScore: 61 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("startScore");
  });

  it("rejects a missing start score", () => {
    expect(bullseyeCheckoutValidator.validateConfig({ config: {} }).ok).toBe(
      false,
    );
  });
});

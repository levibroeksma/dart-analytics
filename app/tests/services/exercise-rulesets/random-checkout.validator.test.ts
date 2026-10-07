import { describe, expect, it } from "vitest";
import { randomCheckoutValidator } from "@services/exercise-rulesets/random-checkout/random-checkout.validator";

const CONFIG = { minStart: 40, maxStart: 170, drawSeed: 1234 };

describe("randomCheckoutValidator.validateConfig", () => {
  it("accepts a seeded configuration", () => {
    expect(randomCheckoutValidator.validateConfig({ config: CONFIG })).toEqual({
      ok: true,
      config: CONFIG,
    });
  });

  it("rejects a configuration with no seed", () => {
    const result = randomCheckoutValidator.validateConfig({
      config: { minStart: 40, maxStart: 170 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("rejects another range", () => {
    const result = randomCheckoutValidator.validateConfig({
      config: { ...CONFIG, maxStart: 100 },
    });

    expect(result.ok).toBe(false);
  });
});

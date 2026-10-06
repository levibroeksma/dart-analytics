import { describe, expect, it } from "vitest";
import { checkoutSequenceValidator } from "@services/exercise-rulesets/checkout-sequence/checkout-sequence.validator";

const CATCH_40 = { firstOutshot: 61, lastOutshot: 100, dartLimit: 6 };

describe("checkoutSequenceValidator.validateConfig", () => {
  it("accepts the Catch 40 configuration", () => {
    expect(
      checkoutSequenceValidator.validateConfig({ config: CATCH_40 }),
    ).toEqual({ ok: true, config: CATCH_40 });
  });

  it("rejects another outshot range", () => {
    const result = checkoutSequenceValidator.validateConfig({
      config: { ...CATCH_40, lastOutshot: 130 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

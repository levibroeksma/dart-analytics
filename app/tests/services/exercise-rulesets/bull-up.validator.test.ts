import { describe, expect, it } from "vitest";
import { bullUpValidator } from "@services/exercise-rulesets/bull-up/bull-up.validator";

describe("bullUpValidator.validateConfig", () => {
  it("accepts the empty configuration", () => {
    expect(bullUpValidator.validateConfig({ config: {} })).toEqual({
      ok: true,
      config: {},
    });
  });

  it("rejects any key", () => {
    const result = bullUpValidator.validateConfig({ config: { target: 25 } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

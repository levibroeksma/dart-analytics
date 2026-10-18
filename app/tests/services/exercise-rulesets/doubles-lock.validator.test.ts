import { describe, expect, it } from "vitest";
import { doublesLockValidator } from "@services/exercise-rulesets/doubles-lock/doubles-lock.validator";

describe("doublesLockValidator", () => {
  it("accepts the empty config", () => {
    expect(doublesLockValidator.validateConfig({ config: {} })).toEqual({
      ok: true,
      config: {},
    });
  });

  it("refuses any key", () => {
    const result = doublesLockValidator.validateConfig({
      config: { lockHits: 3 },
    });
    expect(result.ok).toBe(false);
  });
});

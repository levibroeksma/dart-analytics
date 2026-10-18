import { describe, expect, it } from "vitest";
import { switchbladeValidator } from "@services/exercise-rulesets/switchblade/switchblade.validator";

describe("switchbladeValidator", () => {
  it("accepts the empty config", () => {
    expect(switchbladeValidator.validateConfig({ config: {} })).toEqual({
      ok: true,
      config: {},
    });
  });

  it("refuses a custom path", () => {
    const result = switchbladeValidator.validateConfig({
      config: { path: [] },
    });
    expect(result.ok).toBe(false);
  });
});

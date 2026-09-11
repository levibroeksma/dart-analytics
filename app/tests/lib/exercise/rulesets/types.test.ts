import { describe, expect, it } from "vitest";
import { SwitchingV1Config } from "@lib/exercise/rulesets/types";

describe("SwitchingV1Config", () => {
  const VALID = {
    targets: [20, 19, 18],
    scoring: { single: 1, double: 2, treble: 3 },
  };

  it("accepts a well-formed configuration", () => {
    expect(SwitchingV1Config.safeParse(VALID).success).toBe(true);
  });

  it("rejects an empty target list", () => {
    const result = SwitchingV1Config.safeParse({ ...VALID, targets: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a target outside the board", () => {
    const result = SwitchingV1Config.safeParse({ ...VALID, targets: [26] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = SwitchingV1Config.safeParse({
      ...VALID,
      captureModeKey: "ANALYTICS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative scoring values", () => {
    const result = SwitchingV1Config.safeParse({
      ...VALID,
      scoring: { single: -1, double: 2, treble: 3 },
    });
    expect(result.success).toBe(false);
  });
});

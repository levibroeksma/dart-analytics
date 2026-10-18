import { describe, expect, it } from "vitest";
import { hitCountValidator } from "@services/exercise-rulesets/hit-count/hit-count.validator";

const BIG_TREBLES = {
  targets: [20, 19, 18, 17].map((number) => ({ kind: "TREBLE", number })),
  dartsPerTarget: 9,
};

describe("hitCountValidator", () => {
  it("accepts the Big Trebles template", () => {
    expect(hitCountValidator.validateConfig({ config: BIG_TREBLES })).toEqual({
      ok: true,
      config: BIG_TREBLES,
    });
  });

  it("names the path of a bad darts-per-target", () => {
    const result = hitCountValidator.validateConfig({
      config: { ...BIG_TREBLES, dartsPerTarget: 10 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^dartsPerTarget: /);
  });
});

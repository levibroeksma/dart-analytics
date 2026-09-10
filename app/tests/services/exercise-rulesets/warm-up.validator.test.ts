import { describe, expect, it } from "vitest";
import { warmUpValidator } from "@services/exercise-rulesets/warm-up/warm-up.validator";

const VALID = {
  phases: [{ name: "Upper", targets: [5, 20, 1], durationSeconds: 60 }],
};

describe("warmUpValidator.validateConfig", () => {
  it("accepts a well-formed configuration", () => {
    const result = warmUpValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects an empty phase list", () => {
    const result = warmUpValidator.validateConfig({ config: { phases: [] } });

    expect(result.ok).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = warmUpValidator.validateConfig({
      config: { ...VALID, captureModeKey: "ANALYTICS" },
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a target outside the board", () => {
    const result = warmUpValidator.validateConfig({
      config: { phases: [{ name: "Bad", targets: [26], durationSeconds: 60 }] },
    });

    expect(result.ok).toBe(false);
  });

  it("names the offending path in its issues", () => {
    const result = warmUpValidator.validateConfig({
      config: { phases: [{ name: "", targets: [5], durationSeconds: 60 }] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("phases");
  });
});

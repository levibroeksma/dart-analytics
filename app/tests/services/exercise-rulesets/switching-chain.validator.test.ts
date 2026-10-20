import { describe, expect, it } from "vitest";
import { switchingChainValidator } from "@services/exercise-rulesets/switching-chain/switching-chain.validator";

const VALID = { targets: [20, 19, 18] };

describe("switchingChainValidator.validateConfig", () => {
  it("accepts the default sequence", () => {
    const result = switchingChainValidator.validateConfig({
      config: VALID,
    });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("accepts a sequence holding the bull", () => {
    expect(
      switchingChainValidator.validateConfig({
        config: { targets: [25, 1, 7] },
      }).ok,
    ).toBe(true);
  });

  it("rejects a repeated target, naming targets", () => {
    const result = switchingChainValidator.validateConfig({
      config: { targets: [20, 20, 19] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("targets");
  });

  it("rejects a sequence that is not three targets", () => {
    const result = switchingChainValidator.validateConfig({
      config: { targets: [20, 19] },
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a scoring key — the mode carries no scoring of its own", () => {
    const result = switchingChainValidator.validateConfig({
      config: { ...VALID, scoring: { single: 1, double: 2, treble: 3 } },
    });

    expect(result.ok).toBe(false);
  });
});

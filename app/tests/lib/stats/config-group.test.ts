import { describe, it, expect } from "vitest";
import { configGroupKey } from "@lib/stats/config-group";

describe("configGroupKey", () => {
  it("builds a key from the ruleset version and named configuration fields", () => {
    const key = configGroupKey(["ruleset_version_key", "difficulty"], {
      rulesetVersionKey: "AROUND_THE_CLOCK_V2",
      configuration: { difficulty: "HARD" },
    });
    expect(key).toBe("AROUND_THE_CLOCK_V2|difficulty=HARD");
  });

  it("renders a missing configuration field as empty", () => {
    const key = configGroupKey(["ruleset_version_key", "difficulty"], {
      rulesetVersionKey: "AROUND_THE_CLOCK_V1",
      configuration: {},
    });
    expect(key).toBe("AROUND_THE_CLOCK_V1|difficulty=");
  });

  it("renders every field when configuration is null", () => {
    const key = configGroupKey(["ruleset_version_key", "difficulty"], {
      rulesetVersionKey: "AROUND_THE_CLOCK_V1",
      configuration: null,
    });
    expect(key).toBe("AROUND_THE_CLOCK_V1|difficulty=");
  });

  it("joins several configuration fields in declared order", () => {
    const key = configGroupKey(
      ["ruleset_version_key", "difficulty", "segment_rule"],
      {
        rulesetVersionKey: "AROUND_THE_CLOCK_V2",
        configuration: { segment_rule: "OUTER_SINGLE", difficulty: "HARD" },
      },
    );
    expect(key).toBe(
      "AROUND_THE_CLOCK_V2|difficulty=HARD|segment_rule=OUTER_SINGLE",
    );
  });

  it("never throws for a field not among the declared list", () => {
    const key = configGroupKey(["ruleset_version_key"], {
      rulesetVersionKey: "BOBS27_V1",
      configuration: { start_score: 27 },
    });
    expect(key).toBe("BOBS27_V1");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  getEngineFactory,
  registeredRulesetsFor,
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import type { GameEngineFactory } from "@modules/interfaces";

const fixture = {
  rulesetVersionKey: "SCORE_TRAINING_V1",
  create: () => {
    throw new Error("fixture");
  },
} as unknown as GameEngineFactory<never, never, never>;

describe("engine registry", () => {
  beforeEach(() => resetEngineRegistry());

  it("returns a registered factory by ruleset version key", () => {
    registerEngineFactory(fixture);
    expect(getEngineFactory("SCORE_TRAINING_V1")).toBe(fixture);
  });

  it("returns undefined for an unregistered ruleset version", () => {
    expect(getEngineFactory("501_V1")).toBeUndefined();
  });

  it("rejects a duplicate registration for the same ruleset version", () => {
    registerEngineFactory(fixture);
    expect(() => registerEngineFactory(fixture)).toThrow(/already registered/);
  });
});

describe("registeredRulesetsFor", () => {
  it("lists only registered rulesets that declare the pair", () => {
    resetEngineRegistry();
    registerEngineFactory({
      rulesetVersionKey: "501_V1",
      stageOwnership: "PER_SEAT",
      create: () => ({}) as never,
    });

    expect(registeredRulesetsFor("ANALYTICS", "VISUAL_BOARD")).toEqual([
      "501_V1",
    ]);
  });

  it("excludes a registered ruleset that does not declare the pair", () => {
    resetEngineRegistry();
    registerEngineFactory({
      rulesetVersionKey: "TUOD_V1",
      stageOwnership: "PER_SEAT",
      create: () => ({}) as never,
    });

    // TUOD_V1 declares RECREATIONAL + QUICK_SCORE and ANALYTICS +
    // VISUAL_BOARD only — never DETAILED_DARTS.
    expect(registeredRulesetsFor("RECREATIONAL", "DETAILED_DARTS")).toEqual([]);
  });

  it("excludes a capable ruleset whose engine is not registered", () => {
    resetEngineRegistry();

    expect(registeredRulesetsFor("ANALYTICS", "VISUAL_BOARD")).toEqual([]);
  });
});

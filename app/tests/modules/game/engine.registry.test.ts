import { beforeEach, describe, expect, it } from "vitest";
import {
  getEngineFactory,
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

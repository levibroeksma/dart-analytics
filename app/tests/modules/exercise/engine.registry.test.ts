import { beforeEach, describe, expect, it } from "vitest";
import {
  getExerciseEngineFactory,
  registerExerciseEngineFactory,
  resetExerciseEngineRegistry,
} from "@modules/exercise/engine.registry";

const stubFactory = {
  exerciseRulesetVersionKey: "WARM_UP_V1" as const,
  create: () => {
    throw new Error("not used");
  },
};

describe("exercise engine registry", () => {
  beforeEach(() => {
    resetExerciseEngineRegistry();
  });

  it("returns a registered factory by key", () => {
    registerExerciseEngineFactory(stubFactory);

    expect(getExerciseEngineFactory("WARM_UP_V1")).toBe(stubFactory);
  });

  it("returns undefined for an unregistered key", () => {
    expect(getExerciseEngineFactory("WARM_UP_V1")).toBeUndefined();
  });

  it("refuses a duplicate registration", () => {
    registerExerciseEngineFactory(stubFactory);

    expect(() => registerExerciseEngineFactory(stubFactory)).toThrow(
      /already registered/,
    );
  });
});

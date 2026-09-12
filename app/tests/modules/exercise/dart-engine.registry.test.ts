import { beforeEach, describe, expect, it } from "vitest";
import {
  getDartExerciseEngineFactory,
  registerDartExerciseEngineFactory,
  resetDartExerciseEngineRegistry,
} from "@modules/exercise/dart-engine.registry";

const stubFactory = {
  exerciseRulesetVersionKey: "SWITCHING_V1" as const,
  create: () => {
    throw new Error("not used");
  },
};

describe("dart exercise engine registry", () => {
  beforeEach(() => {
    resetDartExerciseEngineRegistry();
  });

  it("returns a registered factory by key", () => {
    registerDartExerciseEngineFactory(stubFactory);

    expect(getDartExerciseEngineFactory("SWITCHING_V1")).toBe(stubFactory);
  });

  it("returns undefined for an unregistered key", () => {
    expect(getDartExerciseEngineFactory("SWITCHING_V1")).toBeUndefined();
  });

  it("refuses a duplicate registration", () => {
    registerDartExerciseEngineFactory(stubFactory);

    expect(() => registerDartExerciseEngineFactory(stubFactory)).toThrow(
      /already registered/,
    );
  });
});

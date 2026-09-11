import { describe, expect, it } from "vitest";
import { warmUpEngineFactory } from "@modules/exercise/warm-up.engine.module";
import type { WarmUpConfigData } from "@lib/types";

const CONFIG: WarmUpConfigData = {
  phases: [
    { name: "Upper", targets: [5, 20, 1], durationSeconds: 60 },
    { name: "Lower", targets: [19, 3, 17], durationSeconds: 60 },
    { name: "Bull", targets: [25], durationSeconds: 60 },
  ],
};

describe("warmUpEngineFactory", () => {
  it("starts on the first phase with one stage fact", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      phaseIndex: 0,
      phaseName: "Upper",
      targets: [5, 20, 1],
      phaseDurationSeconds: 60,
      phaseCount: 3,
      status: "IN_PROGRESS",
    });
    expect(engine.facts().stages).toHaveLength(1);
    expect(engine.facts().stages[0]).toMatchObject({
      stageTypeKey: "EXERCISE_SECTION",
      parentClientKey: null,
      sequence: 1,
    });
    expect(engine.facts().turns).toEqual([]);
  });

  it("appends one stage per phase entered", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    expect(engine.advance().phaseName).toBe("Lower");
    expect(engine.facts().stages.map((s) => s.sequence)).toEqual([1, 2]);
  });

  it("completes on advancing past the final phase without adding a stage", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    engine.advance();

    expect(engine.isComplete()).toBe(false);
    expect(engine.advance().status).toBe("COMPLETE");
    expect(engine.isComplete()).toBe(true);
    expect(engine.facts().stages).toHaveLength(3);
  });

  it("undoes completion, then phases, then refuses", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    engine.advance();
    engine.advance();

    expect(engine.undo()).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().phaseIndex).toBe(2);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().phaseIndex).toBe(0);
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates in progress from prior facts", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    const prior = engine.facts();

    const resumed = warmUpEngineFactory.create(CONFIG, prior);

    expect(resumed.state().phaseIndex).toBe(1);
    expect(resumed.state().status).toBe("IN_PROGRESS");
    expect(resumed.facts().stages.map((s) => s.clientKey)).toEqual(
      prior.stages.map((s) => s.clientKey),
    );
  });

  it("returns copies, never live internals", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    engine.facts().stages.push({
      clientKey: "x",
      stageTypeKey: "EXERCISE_SECTION",
      parentClientKey: null,
      sequence: 99,
    });

    expect(engine.facts().stages).toHaveLength(1);
  });

  it("rejects an empty phase list", () => {
    expect(() => warmUpEngineFactory.create({ phases: [] })).toThrow();
  });
});

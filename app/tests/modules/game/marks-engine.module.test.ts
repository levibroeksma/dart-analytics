import { describe, expect, it, vi } from "vitest";
import {
  MarksEngine,
  marksEngineFactory,
} from "@modules/game/marks-engine.module";
import type { DartObservation, EngineFacts } from "@modules/types";

type FakeState = {
  activeParticipantRef: string;
  status: "IN_PROGRESS" | "COMPLETE";
  seats: never[];
  darts: number;
};

const LIMIT = 4;
const OBSERVATION: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "SINGLE",
  locationX: null,
  locationY: null,
};

class FakeEngine extends MarksEngine<{ seat: string }, FakeState> {
  constructor(config: { seat: string }, prior?: EngineFacts) {
    super(config, prior, "CRICKET_V1");
  }

  protected fold(facts: EngineFacts): FakeState {
    const darts = facts.turns.reduce((sum, turn) => sum + turn.darts.length, 0);
    return {
      activeParticipantRef: this.config.seat,
      status: darts >= LIMIT ? "COMPLETE" : "IN_PROGRESS",
      seats: [],
      darts,
    };
  }

  protected fork() {
    return new FakeEngine(this.config, this.facts());
  }
}

function engineAt(darts: number) {
  const engine = new FakeEngine({ seat: "p1" });
  for (let i = 0; i < darts; i += 1) engine.record(OBSERVATION);
  return engine;
}

describe("MarksEngine", () => {
  it("records into the open visit and hands over after three darts", () => {
    const engine = engineAt(3);
    expect(engine.facts().turns).toHaveLength(1);
    engine.record(OBSERVATION);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.state().darts).toBe(4);
  });

  it("refuses a dart once the fold reports COMPLETE", () => {
    const engine = engineAt(LIMIT);
    expect(() => engine.record(OBSERVATION)).toThrow("game has ended");
  });

  it("stamps the visit that ends the game", () => {
    expect(engineAt(LIMIT).facts().turns.at(-1)?.completedAt).not.toBeNull();
  });

  it("undoes the last dart and reopens the game", () => {
    const engine = engineAt(LIMIT);
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().darts).toBe(LIMIT - 1);
  });

  it("returns copies from facts and state", () => {
    const engine = engineAt(2);
    const facts = engine.facts();
    facts.turns[0].darts.pop();
    expect(engine.state().darts).toBe(2);
    expect(engine.state()).not.toBe(engine.state());
  });

  it("reports wouldComplete from a fork, leaving the log untouched", () => {
    const engine = engineAt(LIMIT - 1);
    expect(engine.wouldComplete(OBSERVATION)).toBe(true);
    expect(engine.facts().turns[0].darts).toHaveLength(LIMIT - 1);
    expect(engineAt(1).wouldComplete(OBSERVATION)).toBe(false);
  });

  it("reports wouldComplete false when the fork refuses the dart", () => {
    expect(engineAt(LIMIT).wouldComplete(OBSERVATION)).toBe(false);
  });

  it("follows the fold for isComplete", () => {
    expect(engineAt(LIMIT - 1).isComplete()).toBe(false);
    expect(engineAt(LIMIT).isComplete()).toBe(true);
  });

  it("exposes the PER_SEAT ownership and its key", () => {
    const engine = engineAt(0);
    expect(engine.stageOwnership).toBe("PER_SEAT");
    expect(engine.rulesetVersionKey).toBe("CRICKET_V1");
  });
});

describe("marksEngineFactory", () => {
  it("carries the key and forwards create to build", () => {
    const built = engineAt(0);
    const build = vi.fn(() => built);
    const factory = marksEngineFactory({
      rulesetVersionKey: "CRICKET_V2",
      build,
    });
    const prior: EngineFacts = { stages: [], turns: [] };
    expect(factory.rulesetVersionKey).toBe("CRICKET_V2");
    expect(factory.stageOwnership).toBe("PER_SEAT");
    expect(factory.create({ seat: "p1" }, prior)).toBe(built);
    expect(build).toHaveBeenCalledWith({ seat: "p1" }, prior);
  });
});

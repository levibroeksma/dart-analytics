import { describe, expect, it } from "vitest";
import {
  foldTargetScoringState,
  targetScoringPoints,
  targetScoringTargetLabel,
  TargetScoringEngine,
  targetScoringEngineFactory,
} from "@modules/training/exercises/target-scoring.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { TargetScoringConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";

const CONFIG: TargetScoringConfigData = { targets: [20, 19, 18, 25] };

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");

function play(
  engine: TargetScoringEngine,
  darts: DartObservation[],
): ReturnType<TargetScoringEngine["state"]> {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("targetScoringPoints", () => {
  it("scores single rings 1 and the treble 3 on a number target", () => {
    expect(targetScoringPoints(20, dart(20, "SINGLE"))).toBe(1);
    expect(targetScoringPoints(20, dart(20, "INNER_SINGLE"))).toBe(1);
    expect(targetScoringPoints(20, dart(20, "OUTER_SINGLE"))).toBe(1);
    expect(targetScoringPoints(20, dart(20, "TREBLE"))).toBe(3);
  });

  it("treats the double of the target as a miss", () => {
    expect(targetScoringPoints(20, dart(20, "DOUBLE"))).toBeNull();
  });

  it("treats another number, the bull or the surround as a miss", () => {
    expect(targetScoringPoints(20, dart(1, "TREBLE"))).toBeNull();
    expect(targetScoringPoints(20, dart(25, "INNER_BULL"))).toBeNull();
    expect(targetScoringPoints(20, MISS)).toBeNull();
  });

  it("scores the outer bull 1 and the bullseye 3 on the bull target", () => {
    expect(targetScoringPoints(25, dart(25, "OUTER_BULL"))).toBe(1);
    expect(targetScoringPoints(25, dart(25, "INNER_BULL"))).toBe(3);
    expect(targetScoringPoints(25, dart(20, "TREBLE"))).toBeNull();
  });
});

describe("targetScoringTargetLabel", () => {
  it("reads a number as itself and 25 as Bull", () => {
    expect(targetScoringTargetLabel(20)).toBe("20");
    expect(targetScoringTargetLabel(25)).toBe("Bull");
  });
});

describe("TargetScoringEngine", () => {
  it("starts on the first target with an empty chain and no mark", () => {
    const engine = targetScoringEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      currentTargetNumber: 20,
      targetIndex: 0,
      currentChain: 0,
      bestChain: 0,
      markToBeat: null,
      bestChainByTarget: [
        { targetNumber: 20, bestChain: 0 },
        { targetNumber: 19, bestChain: 0 },
        { targetNumber: 18, bestChain: 0 },
        { targetNumber: 25, bestChain: 0 },
      ],
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("builds a chain from consecutive hits", () => {
    const state = play(new TargetScoringEngine(CONFIG), [
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(20, "TREBLE"),
    ]);

    expect(state.currentChain).toBe(7);
    expect(state.bestChain).toBe(7);
    expect(state.currentTargetNumber).toBe(20);
    expect(state.hits).toBe(3);
  });

  it("keeps the target on a miss with an empty chain", () => {
    const state = play(new TargetScoringEngine(CONFIG), [MISS, MISS]);

    expect(state.currentTargetNumber).toBe(20);
    expect(state.currentChain).toBe(0);
    expect(state.dartsThrown).toBe(2);
  });

  it("resets the chain and advances on a miss that breaks a live chain", () => {
    const state = play(new TargetScoringEngine(CONFIG), [
      dart(20, "TREBLE"),
      dart(20, "DOUBLE"),
    ]);

    expect(state.currentChain).toBe(0);
    expect(state.bestChain).toBe(3);
    expect(state.currentTargetNumber).toBe(19);
    expect(state.targetIndex).toBe(1);
  });

  it("scores the next darts against the new target after an advance", () => {
    const state = play(new TargetScoringEngine(CONFIG), [
      dart(20, "SINGLE"),
      MISS,
      dart(20, "TREBLE"),
    ]);

    expect(state.currentTargetNumber).toBe(19);
    expect(state.currentChain).toBe(0);
  });

  it("cycles from the bull back to the first target", () => {
    const state = play(new TargetScoringEngine(CONFIG), [
      dart(20, "SINGLE"),
      MISS,
      dart(19, "SINGLE"),
      MISS,
      dart(18, "SINGLE"),
      MISS,
      dart(25, "INNER_BULL"),
      MISS,
    ]);

    expect(state.currentTargetNumber).toBe(20);
    expect(state.targetIndex).toBe(0);
    expect(state.bestChainByTarget).toEqual([
      { targetNumber: 20, bestChain: 1 },
      { targetNumber: 19, bestChain: 1 },
      { targetNumber: 18, bestChain: 1 },
      { targetNumber: 25, bestChain: 3 },
    ]);
  });

  it("shows a mark to beat only once the target has a finished chain", () => {
    const engine = new TargetScoringEngine({ targets: [20, 19] });

    expect(play(engine, [dart(20, "TREBLE")]).markToBeat).toBeNull();
    expect(play(engine, [MISS]).markToBeat).toBeNull(); // on 19, no history
    expect(play(engine, [dart(19, "SINGLE"), MISS]).markToBeat).toBe(3);
    expect(
      play(engine, [dart(20, "TREBLE"), dart(20, "TREBLE")]).markToBeat,
    ).toBe(3);
  });

  it("counts a chain still live at timer expiry toward the best chains", () => {
    const engine = new TargetScoringEngine(CONFIG);
    play(engine, [dart(20, "SINGLE"), MISS]);
    play(engine, [dart(19, "TREBLE"), dart(19, "TREBLE")]);
    engine.expireTimer();

    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.bestChain).toBe(6);
    expect(state.bestChainByTarget[1]).toEqual({
      targetNumber: 19,
      bestChain: 6,
    });
  });

  it("stamps each dart with its own target and aimed ring", () => {
    const engine = new TargetScoringEngine({ targets: [20, 25] });
    play(engine, [dart(20, "SINGLE"), MISS, dart(25, "OUTER_BULL")]);

    const darts = engine.facts().turns.flatMap((turn) => turn.darts);
    expect(
      darts.map((d) => [d.intendedTargetNumber, d.intendedZoneKey]),
    ).toEqual([
      [20, "TREBLE"],
      [20, "TREBLE"],
      [25, "INNER_BULL"],
    ]);
  });

  it("groups darts into three-dart visits across target changes", () => {
    const engine = new TargetScoringEngine(CONFIG);
    play(engine, [dart(20, "SINGLE"), MISS, MISS, MISS]);

    const turns = engine.facts().turns;
    expect(turns.map((turn) => turn.darts.length)).toEqual([3, 1]);
    expect(turns[0].completedAt).not.toBeNull();
    expect(turns[1].completedAt).toBeNull();
  });

  it("undoes the last dart, restoring the chain and target", () => {
    const engine = new TargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE"), MISS]);

    expect(engine.undo()).toBe(true);
    expect(engine.state().currentTargetNumber).toBe(20);
    expect(engine.state().currentChain).toBe(3);
  });

  it("un-completes before undoing a dart", () => {
    const engine = new TargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE")]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().dartsThrown).toBe(1);
  });

  it("refuses to record once complete", () => {
    const engine = new TargetScoringEngine(CONFIG);
    engine.expireTimer();

    expect(() => engine.record(MISS)).toThrow();
  });

  it("rehydrates in-progress state from prior facts", () => {
    const engine = new TargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE"), MISS, dart(19, "SINGLE")]);

    const resumed = targetScoringEngineFactory.create(CONFIG, engine.facts());

    expect(resumed.state()).toEqual(engine.state());
  });

  it("rejects an invalid configuration", () => {
    expect(() => new TargetScoringEngine({ targets: [20, 20] })).toThrow();
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("TARGET_SCORING_V1")).toBe(
      targetScoringEngineFactory,
    );
  });

  it("produces facts the events-batch API accepts", () => {
    const engine = new TargetScoringEngine(CONFIG);
    play(engine, [
      dart(20, "TREBLE"),
      dart(5, "SINGLE"),
      dart(25, "INNER_BULL"),
    ]);

    const parsed = EventsBatchRequest.safeParse(
      buildEventsBatch(engine.facts()),
    );

    expect(parsed.success).toBe(true);
  });
});

describe("foldTargetScoringState", () => {
  it("derives state from a fact log without an engine instance", () => {
    const engine = new TargetScoringEngine(CONFIG);
    play(engine, [dart(20, "SINGLE"), dart(20, "SINGLE")]);

    expect(foldTargetScoringState(engine.facts(), CONFIG, false)).toEqual(
      engine.state(),
    );
  });
});

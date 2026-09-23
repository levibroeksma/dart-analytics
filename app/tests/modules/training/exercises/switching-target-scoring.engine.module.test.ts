import { describe, expect, it } from "vitest";
import {
  foldSwitchingTargetScoringState,
  SwitchingTargetScoringEngine,
  switchingTargetScoringEngineFactory,
} from "@modules/training/exercises/switching-target-scoring.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { SwitchingTargetScoringConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";

const CONFIG: SwitchingTargetScoringConfigData = { targets: [20, 19, 18] };

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");

function play(
  engine: SwitchingTargetScoringEngine,
  darts: DartObservation[],
): ReturnType<SwitchingTargetScoringEngine["state"]> {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("SwitchingTargetScoringEngine", () => {
  it("starts on the first target with an empty chain and no mark", () => {
    const engine = switchingTargetScoringEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      currentTargetNumber: 20,
      targetIndex: 0,
      currentChain: 0,
      bestChain: 0,
      markToBeat: null,
      completedSequences: 0,
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("advances to the next target on every hit", () => {
    const state = play(new SwitchingTargetScoringEngine(CONFIG), [
      dart(20, "TREBLE"),
      dart(19, "SINGLE"),
    ]);

    expect(state.currentTargetNumber).toBe(18);
    expect(state.currentChain).toBe(4);
    expect(state.hits).toBe(2);
  });

  it("restarts at the first target and keeps the chain after a full sequence", () => {
    const state = play(new SwitchingTargetScoringEngine(CONFIG), [
      dart(20, "TREBLE"),
      dart(19, "TREBLE"),
      dart(18, "SINGLE"),
      dart(20, "SINGLE"),
    ]);

    expect(state.currentTargetNumber).toBe(19);
    expect(state.currentChain).toBe(8);
    expect(state.completedSequences).toBe(1);
  });

  it("treats a double as a miss", () => {
    const state = play(new SwitchingTargetScoringEngine(CONFIG), [
      dart(20, "TREBLE"),
      dart(19, "DOUBLE"),
    ]);

    expect(state.currentChain).toBe(0);
    expect(state.currentTargetNumber).toBe(20);
  });

  it("resets the chain and restarts the sequence on a miss mid-visit", () => {
    const state = play(new SwitchingTargetScoringEngine(CONFIG), [
      dart(20, "SINGLE"),
      dart(19, "SINGLE"),
      MISS,
    ]);

    expect(state.currentChain).toBe(0);
    expect(state.currentTargetNumber).toBe(20);
    expect(state.targetIndex).toBe(0);
    expect(state.bestChain).toBe(2);
    expect(state.markToBeat).toBe(2);
  });

  it("scores a hit on a target other than the current one as a miss", () => {
    const state = play(new SwitchingTargetScoringEngine(CONFIG), [
      dart(20, "SINGLE"),
      dart(20, "SINGLE"),
    ]);

    expect(state.currentChain).toBe(0);
    expect(state.currentTargetNumber).toBe(20);
  });

  it("carries the sequence and chain across visits", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    const state = play(engine, [MISS, dart(20, "SINGLE"), dart(19, "SINGLE")]);

    expect(state.currentTargetNumber).toBe(18);
    expect(state.currentChain).toBe(2);
    expect(state.markToBeat).toBeNull();

    const next = play(engine, [dart(18, "TREBLE")]);
    expect(next.currentChain).toBe(5);
    expect(next.currentTargetNumber).toBe(20);
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([
      3, 1,
    ]);
  });

  it("keeps the best finished chain as the mark to beat", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE"), dart(19, "TREBLE"), MISS]);
    const state = play(engine, [dart(20, "SINGLE"), MISS]);

    expect(state.markToBeat).toBe(6);
    expect(state.bestChain).toBe(6);
  });

  it("scores the bull rings when the bull is in the sequence", () => {
    const state = play(
      new SwitchingTargetScoringEngine({ targets: [25, 20, 19] }),
      [dart(25, "INNER_BULL"), dart(20, "SINGLE"), dart(19, "SINGLE")],
    );

    expect(state.currentChain).toBe(5);
    expect(state.currentTargetNumber).toBe(25);
  });

  it("counts a chain still live at timer expiry toward the best chain", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "SINGLE"), MISS, dart(20, "TREBLE")]);
    engine.expireTimer();

    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.bestChain).toBe(3);
    expect(state.markToBeat).toBe(1);
  });

  it("stamps each dart with its own target and aimed ring", () => {
    const engine = new SwitchingTargetScoringEngine({ targets: [20, 25, 19] });
    play(engine, [dart(20, "SINGLE"), dart(25, "OUTER_BULL"), MISS, MISS]);

    const darts = engine.facts().turns.flatMap((turn) => turn.darts);
    expect(
      darts.map((d) => [d.intendedTargetNumber, d.intendedZoneKey]),
    ).toEqual([
      [20, "TREBLE"],
      [25, "INNER_BULL"],
      [19, "TREBLE"],
      [20, "TREBLE"],
    ]);
  });

  it("undoes the last dart, restoring the chain and target", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE"), MISS]);

    expect(engine.undo()).toBe(true);
    expect(engine.state().currentTargetNumber).toBe(19);
    expect(engine.state().currentChain).toBe(3);
  });

  it("un-completes before undoing a dart", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE")]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().dartsThrown).toBe(1);
  });

  it("refuses to record once complete", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    engine.expireTimer();

    expect(() => engine.record(MISS)).toThrow();
  });

  it("rehydrates in-progress state from prior facts", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE"), MISS, dart(20, "SINGLE")]);

    const resumed = switchingTargetScoringEngineFactory.create(
      CONFIG,
      engine.facts(),
    );

    expect(resumed.state()).toEqual(engine.state());
  });

  it("rejects an invalid configuration", () => {
    expect(
      () => new SwitchingTargetScoringEngine({ targets: [20, 20, 19] }),
    ).toThrow();
    expect(
      () => new SwitchingTargetScoringEngine({ targets: [20, 19] }),
    ).toThrow();
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("SWITCHING_TARGET_SCORING_V1")).toBe(
      switchingTargetScoringEngineFactory,
    );
  });

  it("produces facts the events-batch API accepts", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE"), dart(5, "SINGLE"), dart(20, "SINGLE")]);

    const parsed = EventsBatchRequest.safeParse(
      buildEventsBatch(engine.facts()),
    );

    expect(parsed.success).toBe(true);
  });
});

describe("foldSwitchingTargetScoringState", () => {
  it("derives state from a fact log without an engine instance", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "SINGLE"), dart(19, "SINGLE")]);

    expect(
      foldSwitchingTargetScoringState(engine.facts(), CONFIG, false),
    ).toEqual(engine.state());
  });
});

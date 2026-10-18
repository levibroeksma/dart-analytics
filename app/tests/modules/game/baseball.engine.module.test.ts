import { describe, it, expect } from "vitest";
import {
  applyBaseballDart,
  BASEBALL_INNINGS,
  BaseballEngine,
  baseballEngineFactory,
  foldBaseballState,
  initialBaseballState,
} from "@modules/game/baseball.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type { DartObservation, DartZoneKey } from "@modules/types";
import type { BaseballSnapshot, Seated } from "@lib/types";

const config: Seated<BaseballSnapshot> = {
  seats: [
    {
      participantRef: "participant-1",
      displayName: "Levi",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
  ],
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const S = (n: number) => dart(n, "SINGLE");
const D = (n: number) => dart(n, "DOUBLE");
const T = (n: number) => dart(n, "TREBLE");
const MISS = dart(null, "MISS");

function engineAfter(observations: DartObservation[]) {
  const engine = new BaseballEngine(config);
  for (const observation of observations) engine.record(observation);
  return engine;
}

function seat(engine: BaseballEngine) {
  return engine.state().seats[0];
}

function perfectGame(): DartObservation[] {
  return Array.from({ length: BASEBALL_INNINGS }, (_, i) => [
    T(i + 1),
    T(i + 1),
    T(i + 1),
  ]).flat();
}

describe("baseball engine", () => {
  it("registers BASEBALL_V1 on a per-seat stage", () => {
    expect(getEngineFactory("BASEBALL_V1")).toBe(baseballEngineFactory);
    expect(baseballEngineFactory.stageOwnership).toBe("PER_SEAT");
  });

  it("starts at inning 1 with no runs and nine empty innings", () => {
    expect(initialBaseballState(config)).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          targetIndex: 0,
          runs: 0,
          runsPerInning: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          dartsThisVisit: 0,
          hitsThisVisit: 0,
          status: "IN_PROGRESS",
        },
      ],
    });
  });

  it("scores single 1, double 2, treble 3 on the inning's number", () => {
    const after = seat(engineAfter([S(1), D(1), T(1)]));
    expect(after.runs).toBe(6);
    expect(after.runsPerInning[0]).toBe(6);
    expect(after.targetIndex).toBe(1);
  });

  it("scores an inner and an outer single 1 run each", () => {
    const after = seat(
      engineAfter([dart(1, "INNER_SINGLE"), dart(1, "OUTER_SINGLE"), MISS]),
    );
    expect(after.runs).toBe(2);
  });

  it("scores nothing on another number or the bull", () => {
    const after = seat(
      engineAfter([T(20), dart(25, "INNER_BULL"), dart(25, "OUTER_BULL")]),
    );
    expect(after.runs).toBe(0);
    expect(after.runsPerInning).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(after.targetIndex).toBe(1);
  });

  it("counts inning 2's runs only on the 2", () => {
    const after = seat(engineAfter([MISS, MISS, MISS, T(1), D(2), S(2)]));
    expect(after.runsPerInning.slice(0, 2)).toEqual([0, 3]);
    expect(after.runs).toBe(3);
  });

  it("reaches 81 over a perfect game and completes after inning 9", () => {
    const engine = engineAfter(perfectGame());
    expect(seat(engine).runs).toBe(81);
    expect(seat(engine).runsPerInning).toEqual([9, 9, 9, 9, 9, 9, 9, 9, 9]);
    expect(engine.state().status).toBe("COMPLETE");
    expect(engine.isComplete()).toBe(true);
  });

  it("refuses a dart once inning 9 has closed", () => {
    const engine = engineAfter(perfectGame());
    expect(() => engine.record(T(9))).toThrow(/ended/);
  });

  it("would complete only on inning 9's third dart", () => {
    const darts = perfectGame();
    const early = engineAfter(darts.slice(0, 25));
    expect(early.wouldComplete(T(9))).toBe(false);
    const last = engineAfter(darts.slice(0, 26));
    expect(last.wouldComplete(MISS)).toBe(true);
  });

  it("persists each inning's runs as the turn total", () => {
    const engine = engineAfter([T(1), MISS, S(1), D(2), MISS, MISS]);
    const totals = engine.facts().turns.map((turn) => turn.totalScore);
    expect(totals).toEqual([4, 2]);
    expect(engine.facts().stages[0].stageTypeKey).toBe("EXERCISE_BLOCK");
  });

  it("undoes across an inning boundary back to the open visit", () => {
    const engine = engineAfter([T(1), S(1), MISS, D(2)]);
    expect(engine.undo()).toBe(true);
    const after = seat(engine);
    expect(after.targetIndex).toBe(1);
    expect(after.runs).toBe(4);
    expect(after.runsPerInning.slice(0, 2)).toEqual([4, 0]);
    expect(engine.undo()).toBe(true);
    const reopened = seat(engine);
    expect(reopened.targetIndex).toBe(0);
    expect(reopened.dartsThisVisit).toBe(2);
    expect(reopened.runs).toBe(4);
  });

  it("folds the same state from facts as the live engine", () => {
    const engine = engineAfter([T(1), S(1), MISS, D(2)]);
    expect(foldBaseballState(engine.facts(), config)).toEqual(engine.state());
  });

  it("applies one dart to a seat", () => {
    const start = initialBaseballState(config).seats[0];
    expect(applyBaseballDart(start, D(1))).toMatchObject({
      runs: 2,
      dartsThisVisit: 1,
      hitsThisVisit: 1,
    });
  });
});

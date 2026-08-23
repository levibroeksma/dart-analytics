import { describe, it, expect } from "vitest";
import {
  appendCompletedTurn,
  appendObservedDart,
  appendResolvedDart,
  cloneTurns,
  dartsThrownBy,
  doubleTargetIntent,
  openOrCreateTurn,
  openVisit,
  resolveObservation,
  sumDartScores,
  undoLastDart,
  undoLastUnit,
  undoStagedTurn,
} from "@modules/game/turn-log.module";
import type {
  DartFact,
  DartObservation,
  StageFact,
  TurnFact,
} from "@modules/types";

function dart(overrides: Partial<DartFact> = {}): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: 20,
    hitZoneKey: "SINGLE",
    score: 20,
    locationX: null,
    locationY: null,
    ...overrides,
  };
}

function turn(overrides: Partial<TurnFact> = {}): TurnFact {
  return {
    clientKey: "turn-1",
    stageClientKey: "block-1",
    participantRef: "p1",
    sequence: 1,
    completedAt: null,
    totalScore: 0,
    darts: [],
    ...overrides,
  };
}

const observation: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: null,
  locationY: null,
};

describe("sumDartScores", () => {
  it("totals the board score of every dart", () => {
    expect(
      sumDartScores([
        dart({ score: 20 }),
        dart({ score: 60 }),
        dart({ score: 1 }),
      ]),
    ).toBe(81);
  });

  it("is 0 for an empty visit", () => {
    expect(sumDartScores([])).toBe(0);
  });
});

describe("cloneTurns", () => {
  it("copies both the turns and their dart arrays", () => {
    const source = [turn({ darts: [dart()] })];
    const copy = cloneTurns(source);

    expect(copy).toEqual(source);
    expect(copy[0]).not.toBe(source[0]);
    expect(copy[0].darts).not.toBe(source[0].darts);
  });
});

describe("dartsThrownBy", () => {
  it("counts only the named participant's own darts", () => {
    const turns = [
      turn({ participantRef: "p1", darts: [dart(), dart()] }),
      turn({ participantRef: "p2", darts: [dart()] }),
      turn({ participantRef: "p1", darts: [dart()] }),
    ];

    expect(dartsThrownBy("p1", turns)).toBe(3);
    expect(dartsThrownBy("p2", turns)).toBe(1);
    expect(dartsThrownBy("p3", turns)).toBe(0);
  });
});

describe("openOrCreateTurn", () => {
  it("reuses the last turn when the caller's rule accepts it", () => {
    const turns = [turn()];
    const open = openOrCreateTurn(turns, "block-1", "p1", () => true);

    expect(open).toBe(turns[0]);
    expect(turns).toHaveLength(1);
  });

  it("appends a fresh turn, numbered next, when the rule refuses", () => {
    const turns = [turn()];
    const open = openOrCreateTurn(turns, "block-1", "p2", () => false);

    expect(turns).toHaveLength(2);
    expect(open.sequence).toBe(2);
    expect(open.participantRef).toBe("p2");
    expect(open.completedAt).toBeNull();
    expect(open.darts).toEqual([]);
    expect(open.clientKey).not.toBe("turn-1");
  });

  it("appends on an empty log without consulting the rule", () => {
    const turns: TurnFact[] = [];
    const open = openOrCreateTurn(turns, "block-1", "p1", () => true);

    expect(turns).toEqual([open]);
    expect(open.sequence).toBe(1);
  });
});

describe("doubleTargetIntent", () => {
  it("aims at the target's own double", () => {
    expect(doubleTargetIntent({ kind: "NUMBER", number: 16 })).toEqual({
      intendedTargetNumber: 16,
      intendedZoneKey: "DOUBLE",
    });
  });

  it("aims at the inner bull on the BULL target", () => {
    expect(doubleTargetIntent({ kind: "BULL" })).toEqual({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });
});

describe("appendObservedDart", () => {
  it("appends a scored dart with no intention by default", () => {
    const open = turn();
    const appended = appendObservedDart(open, observation);

    expect(appended.sequence).toBe(1);
    expect(appended.intendedTargetNumber).toBeNull();
    expect(appended.intendedZoneKey).toBeNull();
    expect(appended.score).toBe(60);
    expect(open.darts).toEqual([appended]);
    expect(open.totalScore).toBe(60);
  });

  it("carries the intention it is given and keeps the total in step", () => {
    const open = turn({ darts: [dart({ score: 20 })], totalScore: 20 });
    const appended = appendObservedDart(
      open,
      observation,
      doubleTargetIntent({ kind: "BULL" }),
    );

    expect(appended.sequence).toBe(2);
    expect(appended.intendedTargetNumber).toBe(25);
    expect(appended.intendedZoneKey).toBe("INNER_BULL");
    expect(open.totalScore).toBe(80);
  });

  it("never stamps completedAt — the ruleset decides when a visit resolves", () => {
    const open = turn();
    appendObservedDart(open, observation);

    expect(open.completedAt).toBeNull();
  });
});

describe("appendCompletedTurn", () => {
  it("appends a dartless turn that is already closed", () => {
    const turns = [turn({ completedAt: "2026-01-01T00:00:00.000Z" })];
    const appended = appendCompletedTurn(turns, "block-1", "p2", 41);

    expect(turns).toHaveLength(2);
    expect(appended.sequence).toBe(2);
    expect(appended.participantRef).toBe("p2");
    expect(appended.totalScore).toBe(41);
    expect(appended.darts).toEqual([]);
    expect(appended.completedAt).not.toBeNull();
  });
});

describe("openVisit", () => {
  it("returns the trailing turn while it is still open", () => {
    const turns = [turn()];
    expect(openVisit(turns)).toBe(turns[0]);
  });

  it("returns null once the trailing turn has closed", () => {
    expect(
      openVisit([turn({ completedAt: "2026-01-01T00:00:00.000Z" })]),
    ).toBeNull();
  });

  it("returns null on an empty log", () => {
    expect(openVisit([])).toBeNull();
  });
});

describe("resolveObservation", () => {
  it("classifies a dart that carries coordinates", () => {
    const resolved = resolveObservation({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: 0,
    });

    expect(resolved).toEqual({
      targetNumber: 25,
      zoneKey: "INNER_BULL",
      score: 50,
    });
  });

  it("keeps a coordinate-less dart's own zone and scores it 0", () => {
    expect(
      resolveObservation({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      }),
    ).toEqual({ targetNumber: null, zoneKey: "MISS", score: 0 });
  });
});

describe("appendResolvedDart", () => {
  it("records where the dart landed and leaves the visit total alone", () => {
    const open = turn({ totalScore: 7 });
    const appended = appendResolvedDart(
      open,
      { hitTargetNumber: null, hitZoneKey: "MISS", locationX: 3, locationY: 4 },
      { targetNumber: 20, zoneKey: "TREBLE", score: 60 },
    );

    expect(appended.hitTargetNumber).toBe(20);
    expect(appended.hitZoneKey).toBe("TREBLE");
    expect(appended.score).toBe(60);
    expect(appended.locationX).toBe(3);
    expect(appended.locationY).toBe(4);
    expect(appended.intendedZoneKey).toBeNull();
    expect(open.totalScore).toBe(7);
  });
});

describe("undoLastDart", () => {
  it("pops one dart and reopens the visit", () => {
    const turns = [
      turn({
        darts: [dart({ score: 20 }), dart({ sequence: 2, score: 60 })],
        totalScore: 80,
        completedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];

    expect(undoLastDart(turns)).toBe(true);
    expect(turns[0].darts).toHaveLength(1);
    expect(turns[0].totalScore).toBe(20);
    expect(turns[0].completedAt).toBeNull();
  });

  it("removes the visit when its only dart goes", () => {
    const turns = [turn({ darts: [dart()], totalScore: 20 })];

    expect(undoLastDart(turns)).toBe(true);
    expect(turns).toEqual([]);
  });

  it("refuses a dartless trailing turn and an empty log", () => {
    const dartless = [turn()];
    expect(undoLastDart(dartless)).toBe(false);
    expect(dartless).toHaveLength(1);
    expect(undoLastDart([])).toBe(false);
  });
});

describe("undoLastUnit", () => {
  it("pops a whole dartless turn — the keypad's own unit", () => {
    const turns = [
      turn({ totalScore: 60, completedAt: "2026-01-01T00:00:00.000Z" }),
    ];

    expect(undoLastUnit(turns)).toBe(true);
    expect(turns).toEqual([]);
  });

  it("pops one dart from a board turn and reopens it", () => {
    const turns = [
      turn({
        darts: [dart({ score: 20 }), dart({ sequence: 2, score: 60 })],
        totalScore: 80,
        completedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];

    expect(undoLastUnit(turns)).toBe(true);
    expect(turns[0].darts).toHaveLength(1);
    expect(turns[0].totalScore).toBe(20);
    expect(turns[0].completedAt).toBeNull();
  });

  it("returns false on an empty log", () => {
    expect(undoLastUnit([])).toBe(false);
  });
});

describe("undoStagedTurn", () => {
  function stage(clientKey: string, sequence: number): StageFact {
    return {
      clientKey,
      stageTypeKey: "LEG",
      parentClientKey: null,
      sequence,
    };
  }

  it("pops the stage the undone keypad turn opened", () => {
    const stages = [stage("leg-1", 1), stage("leg-2", 2)];
    const turns = [turn({ stageClientKey: "leg-1", completedAt: "t" })];

    expect(undoStagedTurn(turns, stages)).toBe(true);
    expect(turns).toEqual([]);
    expect(stages.map((s) => s.clientKey)).toEqual(["leg-1"]);
  });

  it("keeps the open stage when the undone turn belongs to it", () => {
    const stages = [stage("leg-1", 1), stage("leg-2", 2)];
    const turns = [turn({ stageClientKey: "leg-2", completedAt: "t" })];

    expect(undoStagedTurn(turns, stages)).toBe(true);
    expect(stages.map((s) => s.clientKey)).toEqual(["leg-1", "leg-2"]);
  });

  it("never pops the only stage", () => {
    const stages = [stage("leg-1", 1)];
    const turns = [turn({ stageClientKey: "leg-0", completedAt: "t" })];

    expect(undoStagedTurn(turns, stages)).toBe(true);
    expect(stages).toHaveLength(1);
  });

  it("pops one dart at a time from a board visit", () => {
    const stages = [stage("leg-1", 1)];
    const turns = [
      turn({
        stageClientKey: "leg-1",
        darts: [dart({ score: 20 }), dart({ sequence: 2, score: 60 })],
        totalScore: 80,
        completedAt: "t",
      }),
    ];

    expect(undoStagedTurn(turns, stages)).toBe(true);
    expect(turns[0].darts).toHaveLength(1);
    expect(turns[0].totalScore).toBe(20);
    expect(turns[0].completedAt).toBeNull();
  });

  it("returns false on an empty log", () => {
    expect(undoStagedTurn([], [])).toBe(false);
  });
});

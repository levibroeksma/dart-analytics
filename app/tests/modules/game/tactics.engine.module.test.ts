import { describe, it, expect } from "vitest";
import {
  applyTacticsDart,
  foldTacticsState,
  initialTacticsState,
  isTacticsTarget,
  TACTICS_OBJECTIVES,
  TacticsEngine,
  tacticsEngineFactory,
  tacticsMarksOf,
} from "@modules/game/tactics.engine.module";
import {
  effectiveMarks,
  marksPerRound,
} from "@modules/game/marks-close.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type { DartObservation, DartZoneKey } from "@modules/types";
import type { Seated, TacticsSnapshot } from "@lib/types";

const config: Seated<TacticsSnapshot> = {
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
const IB = dart(25, "INNER_BULL");
const OB = dart(25, "OUTER_BULL");
const MISS = dart(null, "MISS");

const IDX = {
  20: 0,
  19: 1,
  18: 2,
  17: 3,
  16: 4,
  15: 5,
  BULL: 6,
  DOUBLES: 7,
  TRIPLES: 8,
};

function freshSeat() {
  return initialTacticsState(config).seats[0];
}

function seatAfter(observations: DartObservation[]) {
  return observations.reduce(applyTacticsDart, freshSeat());
}

describe("TACTICS_OBJECTIVES", () => {
  it("lists nine objectives in display order", () => {
    expect(TACTICS_OBJECTIVES).toEqual([
      20,
      19,
      18,
      17,
      16,
      15,
      25,
      "DOUBLES",
      "TRIPLES",
    ]);
  });
});

describe("tacticsEngineFactory", () => {
  it("registers itself under TACTICS_V1", () => {
    expect(tacticsEngineFactory.rulesetVersionKey).toBe("TACTICS_V1");
    expect(getEngineFactory("TACTICS_V1")).toBe(tacticsEngineFactory);
  });
});

describe("tacticsMarksOf on an open board", () => {
  it.each([
    [S(20), IDX[20], 1],
    [dart(20, "INNER_SINGLE"), IDX[20], 1],
    [dart(20, "OUTER_SINGLE"), IDX[20], 1],
    [D(19), IDX[19], 2],
    [T(15), IDX[15], 3],
    [OB, IDX.BULL, 1],
    [IB, IDX.BULL, 2],
    [dart(null, "INNER_BULL"), IDX.BULL, 2],
    [dart(7, "INNER_BULL"), IDX.BULL, 2],
    [D(7), IDX.DOUBLES, 1],
    [T(7), IDX.TRIPLES, 1],
    [D(1), IDX.DOUBLES, 1],
    [T(14), IDX.TRIPLES, 1],
  ])("maps %o to objective %i with %i marks", (obs, index, marks) => {
    expect(tacticsMarksOf(freshSeat(), obs)).toEqual({
      objectiveIndex: index,
      marks,
    });
  });

  it.each([S(7), S(1), MISS, dart(20, "MISS")])("gives %o no marks", (obs) => {
    expect(tacticsMarksOf(freshSeat(), obs)).toBeNull();
  });
});

describe("tacticsMarksOf with the number closed", () => {
  const closed20 = seatAfter([T(20)]);

  it("sends a double to Doubles", () => {
    expect(tacticsMarksOf(closed20, D(20))).toEqual({
      objectiveIndex: IDX.DOUBLES,
      marks: 1,
    });
  });

  it("sends a treble to Triples", () => {
    expect(tacticsMarksOf(closed20, T(20))).toEqual({
      objectiveIndex: IDX.TRIPLES,
      marks: 1,
    });
  });

  it("gives a single on the closed number no marks", () => {
    expect(tacticsMarksOf(closed20, S(20))).toBeNull();
  });
});

describe("tacticsMarksOf bull", () => {
  it("never feeds Doubles once the bull is closed", () => {
    const closedBull = seatAfter([IB, OB]);
    expect(closedBull.marks[IDX.BULL]).toBe(3);
    expect(tacticsMarksOf(closedBull, IB)).toEqual({
      objectiveIndex: IDX.BULL,
      marks: 2,
    });
    const after = applyTacticsDart(closedBull, dart(7, "INNER_BULL"));
    expect(after.marks[IDX.DOUBLES]).toBe(0);
    expect(after.marks[IDX.BULL]).toBe(3);
  });
});

describe("isTacticsTarget", () => {
  it.each([S(20), D(7), T(7), OB, IB, dart(null, "INNER_BULL")])(
    "is true for %o",
    (obs) => {
      expect(isTacticsTarget(obs)).toBe(true);
    },
  );

  it.each([S(7), S(14), MISS, dart(20, "MISS")])("is false for %o", (obs) => {
    expect(isTacticsTarget(obs)).toBe(false);
  });
});

describe("applyTacticsDart", () => {
  it("discards the spare mark of a closing double instead of feeding Doubles", () => {
    const seat = seatAfter([S(20), S(20), D(20)]);
    expect(seat.marks[IDX[20]]).toBe(3);
    expect(seat.marks[IDX.DOUBLES]).toBe(0);
    expect(seat.closedAtDart[IDX[20]]).toBe(3);
  });

  it("discards the spare marks of a closing treble instead of feeding Triples", () => {
    const seat = seatAfter([D(20), T(20)]);
    expect(seat.marks[IDX[20]]).toBe(3);
    expect(seat.marks[IDX.TRIPLES]).toBe(0);
  });

  it("feeds Doubles by one on the next double once the number is closed", () => {
    const seat = seatAfter([D(20), D(20), D(20)]);
    expect(seat.marks[IDX[20]]).toBe(3);
    expect(seat.marks[IDX.DOUBLES]).toBe(1);
  });

  it("feeds Triples by one on the next treble once the number is closed", () => {
    const seat = seatAfter([T(20), T(20)]);
    expect(seat.marks[IDX[20]]).toBe(3);
    expect(seat.marks[IDX.TRIPLES]).toBe(1);
  });

  it("counts a single on 1–14 as a thrown dart with no marks", () => {
    const seat = seatAfter([S(7)]);
    expect(seat.dartsThrown).toBe(1);
    expect(effectiveMarks(seat)).toBe(0);
  });

  it("caps Doubles and Triples at 3", () => {
    const seat = seatAfter([D(7), D(7), D(7), D(7), T(7), T(7), T(7), T(7)]);
    expect(seat.marks[IDX.DOUBLES]).toBe(3);
    expect(seat.marks[IDX.TRIPLES]).toBe(3);
    expect(seat.closedAtDart[IDX.DOUBLES]).toBe(3);
    expect(seat.closedAtDart[IDX.TRIPLES]).toBe(7);
  });

  it("adds nothing for a hit on a closed category", () => {
    const seat = seatAfter([D(7), D(7), D(7), D(7)]);
    expect(seat.marks[IDX.DOUBLES]).toBe(3);
    expect(seat.closedAtDart[IDX.DOUBLES]).toBe(3);
    expect(seat.dartsThrown).toBe(4);
  });

  it("completes when the ninth objective closes and reports MPR", () => {
    const seat = seatAfter([
      T(20),
      T(19),
      T(18),
      T(17),
      T(16),
      T(15),
      IB,
      OB,
      D(7),
      D(7),
      D(7),
      T(7),
      T(7),
      T(7),
    ]);
    expect(seat.status).toBe("COMPLETE");
    expect(seat.dartsThrown).toBe(14);
    expect(effectiveMarks(seat)).toBe(27);
    expect(marksPerRound(seat)).toBeCloseTo((27 / 14) * 3);
  });

  it("throws once complete", () => {
    const seat = seatAfter([
      T(20),
      T(19),
      T(18),
      T(17),
      T(16),
      T(15),
      IB,
      OB,
      D(7),
      D(7),
      D(7),
      T(7),
      T(7),
      T(7),
    ]);
    expect(() => applyTacticsDart(seat, MISS)).toThrow(/undo first/);
  });
});

describe("TacticsEngine", () => {
  it("writes null intent and the board score on every dart", () => {
    const engine = new TacticsEngine(config);
    engine.record(T(20));
    engine.record(D(7));
    const [first, second] = engine.facts().turns[0].darts;
    expect(first.intendedTargetNumber).toBeNull();
    expect(first.intendedZoneKey).toBeNull();
    expect(first.score).toBe(60);
    expect(second.score).toBe(14);
  });

  it("stores a double on 1–14 as a true hit fact, not a miss", () => {
    const engine = new TacticsEngine(config);
    engine.record(D(7));
    const [written] = engine.facts().turns[0].darts;
    expect(written.hitTargetNumber).toBe(7);
    expect(written.hitZoneKey).toBe("DOUBLE");
    expect(engine.state().seats[0].marks[IDX.DOUBLES]).toBe(1);
  });

  it("closes a visit on its third dart", () => {
    const engine = new TacticsEngine(config);
    engine.record(MISS);
    engine.record(MISS);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(MISS);
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
    engine.record(MISS);
    expect(engine.facts().turns).toHaveLength(2);
  });

  function recordAll(engine: TacticsEngine, observations: DartObservation[]) {
    for (const obs of observations) engine.record(obs);
  }

  const CLOSE_NUMBERS_AND_BULL = [
    T(20),
    T(19),
    T(18),
    T(17),
    T(16),
    T(15),
    IB,
    OB,
  ];
  const CLOSE_CATEGORIES = [D(7), D(7), D(7), T(7), T(7), T(7)];

  function runToLastObjective(engine: TacticsEngine) {
    recordAll(engine, [
      ...CLOSE_NUMBERS_AND_BULL,
      ...CLOSE_CATEGORIES.slice(0, -1),
    ]);
  }

  it.each([
    ["dart 1", [MISS, MISS], 1],
    ["dart 2", [], 2],
    ["dart 3", [MISS], 3],
  ])("ends the run on %s of a visit", (_label, pad, dartsInLastVisit) => {
    const engine = new TacticsEngine(config);
    recordAll(engine, [
      ...CLOSE_NUMBERS_AND_BULL,
      ...pad,
      ...CLOSE_CATEGORIES.slice(0, -1),
    ]);
    expect(engine.isComplete()).toBe(false);
    engine.record(T(7));
    const last = engine.facts().turns.at(-1)!;
    expect(engine.isComplete()).toBe(true);
    expect(last.darts).toHaveLength(dartsInLastVisit);
    expect(last.completedAt).not.toBeNull();
  });

  it("refuses a dart after completion and leaves facts untouched", () => {
    const engine = new TacticsEngine(config);
    runToLastObjective(engine);
    engine.record(T(7));
    const before = engine.facts();
    expect(() => engine.record(MISS)).toThrow();
    expect(engine.facts()).toEqual(before);
  });

  it("undo of the closing dart reopens the run and its visit", () => {
    const engine = new TacticsEngine(config);
    runToLastObjective(engine);
    engine.record(T(7));
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    const lastTurn = engine.facts().turns.at(-1)!;
    expect(lastTurn.completedAt).toBeNull();
    const dartsBefore = lastTurn.darts.length;
    engine.record(MISS);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(dartsBefore + 1);
  });

  it("wouldComplete is true only for the closing dart", () => {
    const engine = new TacticsEngine(config);
    runToLastObjective(engine);
    expect(engine.wouldComplete(MISS)).toBe(false);
    expect(engine.wouldComplete(S(7))).toBe(false);
    expect(engine.wouldComplete(D(7))).toBe(false);
    expect(engine.wouldComplete(T(7))).toBe(true);
  });

  it("replays prior facts into the same state across the dual-purpose boundary", () => {
    const live = new TacticsEngine(config);
    for (const obs of [D(20), D(20), D(20), T(20), S(19), T(7), D(15)]) {
      live.record(obs);
    }
    const replayed = new TacticsEngine(config, live.facts());
    expect(replayed.state()).toEqual(live.state());
    expect(foldTacticsState(live.facts(), config)).toEqual(live.state());
    const seat = live.state().seats[0];
    expect(seat.marks[IDX[20]]).toBe(3);
    expect(seat.marks[IDX.DOUBLES]).toBe(1);
    expect(seat.marks[IDX.TRIPLES]).toBe(2);
  });

  it("undo then replay matches a fresh recording", () => {
    const live = new TacticsEngine(config);
    for (const obs of [D(20), D(20), T(20)]) live.record(obs);
    live.undo();
    const fresh = new TacticsEngine(config);
    for (const obs of [D(20), D(20)]) fresh.record(obs);
    expect(live.state()).toEqual(fresh.state());
  });
});

import { describe, it, expect } from "vitest";
import {
  applyCricketDart,
  CricketEngine,
  cricketEngineFactory,
  cricketV2EngineFactory,
  cricketMarksOf,
  effectiveMarks,
  foldCricketState,
  initialCricketState,
  marksPerRound,
} from "@modules/game/cricket.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import * as marksClose from "@modules/game/marks-close.module";
import type { DartObservation, DartZoneKey } from "@modules/types";
import type { CricketSnapshot, Seated } from "@lib/types";

const config: Seated<CricketSnapshot> = {
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

const T = (n: number) => dart(n, "TREBLE");
const MISS = dart(null, "MISS");

function seatAfter(observations: DartObservation[]) {
  const seat = initialCricketState(config).seats[0];
  return observations.reduce(applyCricketDart, seat);
}

function closeAllButBull(engine: CricketEngine) {
  for (const n of [20, 19, 18, 17, 16, 15]) engine.record(T(n));
}

describe("cricketEngineFactory", () => {
  it("registers itself under CRICKET_V1", () => {
    expect(cricketEngineFactory.rulesetVersionKey).toBe("CRICKET_V1");
    expect(getEngineFactory("CRICKET_V1")).toBe(cricketEngineFactory);
  });
});

describe("cricketMarksOf", () => {
  it.each([
    [dart(20, "SINGLE"), 0, 1],
    [dart(20, "INNER_SINGLE"), 0, 1],
    [dart(20, "OUTER_SINGLE"), 0, 1],
    [dart(19, "DOUBLE"), 1, 2],
    [dart(15, "TREBLE"), 5, 3],
    [dart(25, "OUTER_BULL"), 6, 1],
    [dart(25, "INNER_BULL"), 6, 2],
    [dart(null, "INNER_BULL"), 6, 2],
  ])("maps %o to objective %i with %i marks", (obs, index, marks) => {
    expect(cricketMarksOf(obs)).toEqual({ objectiveIndex: index, marks });
  });

  it.each([dart(14, "TREBLE"), dart(1, "SINGLE"), MISS, dart(20, "MISS")])(
    "gives %o no marks",
    (obs) => {
      expect(cricketMarksOf(obs)).toBeNull();
    },
  );
});

describe("applyCricketDart", () => {
  it("caps an objective at 3 marks and records the closing dart", () => {
    const seat = seatAfter([dart(20, "SINGLE"), T(20)]);
    expect(seat.marks[0]).toBe(3);
    expect(seat.closedAtDart[0]).toBe(2);
    expect(effectiveMarks(seat)).toBe(3);
  });

  it("adds nothing for a hit on a closed objective but counts the dart", () => {
    const seat = seatAfter([T(20), T(20)]);
    expect(seat.marks[0]).toBe(3);
    expect(seat.closedAtDart[0]).toBe(1);
    expect(seat.dartsThrown).toBe(2);
  });

  it("counts off-objective darts and misses as thrown", () => {
    const seat = seatAfter([dart(7, "TREBLE"), MISS]);
    expect(seat.dartsThrown).toBe(2);
    expect(effectiveMarks(seat)).toBe(0);
  });

  it("resets dartsThisVisit after the third dart", () => {
    expect(seatAfter([MISS, MISS]).dartsThisVisit).toBe(2);
    expect(seatAfter([MISS, MISS, MISS]).dartsThisVisit).toBe(0);
  });

  it("completes on the dart that closes the seventh objective", () => {
    const seat = seatAfter([
      T(20),
      T(19),
      T(18),
      T(17),
      T(16),
      T(15),
      dart(25, "INNER_BULL"),
      dart(25, "OUTER_BULL"),
    ]);
    expect(seat.status).toBe("COMPLETE");
    expect(seat.dartsThrown).toBe(8);
    expect(seat.closedAtDart).toEqual([1, 2, 3, 4, 5, 6, 8]);
    expect(marksPerRound(seat)).toBeCloseTo((21 / 8) * 3);
  });

  it("throws once complete", () => {
    const seat = seatAfter([
      T(20),
      T(19),
      T(18),
      T(17),
      T(16),
      T(15),
      dart(25, "INNER_BULL"),
      dart(25, "OUTER_BULL"),
    ]);
    expect(() => applyCricketDart(seat, MISS)).toThrow(/undo first/);
  });
});

describe("marksPerRound", () => {
  it("is 0 before any dart", () => {
    expect(marksPerRound(initialCricketState(config).seats[0])).toBe(0);
  });
});

describe("CricketEngine", () => {
  it("writes null intent and the board score on every dart", () => {
    const engine = new CricketEngine(config);
    engine.record(T(20));
    const [written] = engine.facts().turns[0].darts;
    expect(written.intendedTargetNumber).toBeNull();
    expect(written.intendedZoneKey).toBeNull();
    expect(written.score).toBe(60);
  });

  it("returns the state after the dart", () => {
    const engine = new CricketEngine(config);
    engine.record(MISS);
    engine.record(MISS);
    const returned = engine.record(MISS);
    expect(returned).toEqual(engine.state());
    expect(returned.seats[0].dartsThrown).toBe(3);
  });

  it("closes a visit on its third dart", () => {
    const engine = new CricketEngine(config);
    engine.record(MISS);
    engine.record(MISS);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(MISS);
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
    engine.record(MISS);
    expect(engine.facts().turns).toHaveLength(2);
  });

  it("ends the run on dart 2 of a visit", () => {
    const engine = new CricketEngine(config);
    closeAllButBull(engine);
    engine.record(dart(25, "INNER_BULL"));
    engine.record(dart(25, "OUTER_BULL"));
    const turns = engine.facts().turns;
    expect(turns).toHaveLength(3);
    expect(turns[2].darts).toHaveLength(2);
    expect(turns[2].completedAt).not.toBeNull();
    expect(engine.isComplete()).toBe(true);
  });

  it("ends the run on dart 1 of a visit", () => {
    const engine = new CricketEngine(config);
    for (const obs of [
      T(20),
      T(19),
      T(18),
      T(17),
      T(16),
      dart(25, "INNER_BULL"),
      dart(25, "OUTER_BULL"),
      MISS,
      MISS,
      T(15),
    ]) {
      engine.record(obs);
    }
    const turns = engine.facts().turns;
    expect(turns).toHaveLength(4);
    expect(turns[3].darts).toHaveLength(1);
    expect(turns[3].completedAt).not.toBeNull();
    expect(engine.isComplete()).toBe(true);
  });

  it("refuses a dart after completion and leaves facts untouched", () => {
    const engine = new CricketEngine(config);
    closeAllButBull(engine);
    engine.record(dart(25, "INNER_BULL"));
    engine.record(dart(25, "OUTER_BULL"));
    const before = engine.facts();
    expect(() => engine.record(MISS)).toThrow(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
    expect(engine.facts()).toEqual(before);
  });

  it("undo of the closing dart reopens the run and its visit", () => {
    const engine = new CricketEngine(config);
    closeAllButBull(engine);
    engine.record(dart(25, "INNER_BULL"));
    engine.record(dart(25, "OUTER_BULL"));
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    const turns = engine.facts().turns;
    expect(turns.at(-1)!.completedAt).toBeNull();
    engine.record(MISS);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(2);
  });

  it("wouldComplete is true only for the closing dart", () => {
    const engine = new CricketEngine(config);
    closeAllButBull(engine);
    engine.record(dart(25, "INNER_BULL"));
    expect(engine.wouldComplete(MISS)).toBe(false);
    expect(engine.wouldComplete(dart(25, "OUTER_BULL"))).toBe(true);
  });

  it("replays prior facts into the same state", () => {
    const engine = new CricketEngine(config);
    engine.record(T(20));
    engine.record(dart(19, "DOUBLE"));
    const replayed = new CricketEngine(config, engine.facts());
    expect(replayed.state()).toEqual(engine.state());
    expect(foldCricketState(engine.facts(), config)).toEqual(engine.state());
  });
});

describe("marks-close core re-exports", () => {
  it("re-exports the core's effectiveMarks and marksPerRound unchanged", () => {
    expect(effectiveMarks).toBe(marksClose.effectiveMarks);
    expect(marksPerRound).toBe(marksClose.marksPerRound);
  });
});

describe("cricketV2EngineFactory", () => {
  it("is keyed CRICKET_V2 and builds a Cricket engine", () => {
    expect(cricketV2EngineFactory.rulesetVersionKey).toBe("CRICKET_V2");
    expect(cricketV2EngineFactory.stageOwnership).toBe("PER_SEAT");
  });
});

const S = (n: number) => dart(n, "SINGLE");
const D = (n: number) => dart(n, "DOUBLE");
const IB = dart(25, "INNER_BULL");
const OB = dart(25, "OUTER_BULL");

const duelConfig: Seated<CricketSnapshot> = {
  seats: [
    {
      participantRef: "p1",
      displayName: "Levi",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
    {
      participantRef: "p2",
      displayName: "Guest",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ],
};

function newDuel() {
  return new CricketEngine(duelConfig, undefined, "CRICKET_V2");
}

function playVisits(engine: CricketEngine, ...visits: DartObservation[][]) {
  for (const darts of visits) {
    for (const observation of darts) {
      if (engine.isComplete()) return;
      engine.record(observation);
    }
    for (let i = darts.length; i < 3 && !engine.isComplete(); i += 1) {
      engine.record(MISS);
    }
  }
}

const THREE_MISS = [MISS, MISS, MISS];
const SEVEN = [
  [T(20), T(19), T(18)],
  [T(17), T(16), T(15)],
];

describe("Cricket V2 duel", () => {
  it("registers a second factory for CRICKET_V2", () => {
    expect(cricketV2EngineFactory.rulesetVersionKey).toBe("CRICKET_V2");
    expect(getEngineFactory("CRICKET_V2")).toBe(cricketV2EngineFactory);
    expect(newDuel().rulesetVersionKey).toBe("CRICKET_V2");
  });

  it("scores points on a number the opponent has open", () => {
    const engine = newDuel();
    playVisits(engine, [T(20), S(20)]);
    expect(engine.state().seats[0].points).toBe(20);
  });

  it("scores the spare marks of a closing dart", () => {
    const engine = newDuel();
    playVisits(engine, [D(20)], THREE_MISS, [T(20)]);
    expect(engine.state().seats[0].marks[0]).toBe(3);
    expect(engine.state().seats[0].points).toBe(40);
  });

  it("scores nothing once both seats have closed the number", () => {
    const engine = newDuel();
    playVisits(engine, [T(20)], [T(20)], [S(20)]);
    expect(engine.state().seats[0].points).toBe(0);
  });

  it("scores the bull at 25 a mark", () => {
    const engine = newDuel();
    playVisits(engine, [IB, OB, IB]);
    expect(engine.state().seats[0].marks[6]).toBe(3);
    expect(engine.state().seats[0].points).toBe(50);
  });

  it("ignores darts off the objectives", () => {
    const engine = newDuel();
    playVisits(engine, [T(14), S(1), MISS]);
    expect(engine.state().seats[0].points).toBe(0);
    expect(engine.state().seats[0].dartsThrown).toBe(3);
  });

  it("wins on the closing dart mid-visit, stamps the visit and refuses another dart", () => {
    const engine = newDuel();
    playVisits(engine, SEVEN[0], THREE_MISS, SEVEN[1], THREE_MISS, [
      IB,
      OB,
      T(20),
    ]);
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.winnerParticipantRef).toBe("p1");
    expect(state.activeParticipantRef).toBe("p1");
    expect(engine.isComplete()).toBe(true);
    expect(engine.facts().turns.at(-1)?.completedAt).not.toBeNull();
    expect(() => engine.record(MISS)).toThrow("game has ended");
  });

  it("reports wouldComplete only for the winning dart", () => {
    const engine = newDuel();
    playVisits(engine, SEVEN[0], THREE_MISS, SEVEN[1], THREE_MISS);
    engine.record(IB);
    expect(engine.wouldComplete(MISS)).toBe(false);
    expect(engine.wouldComplete(OB)).toBe(true);
  });

  it("reopens the game when the winning dart is undone", () => {
    const engine = newDuel();
    playVisits(engine, SEVEN[0], THREE_MISS, SEVEN[1], THREE_MISS, [IB, OB]);
    expect(engine.undo()).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().winnerParticipantRef).toBeNull();
  });

  it("keeps a closed-out seat that is behind throwing, and it wins on catching up", () => {
    const engine = newDuel();
    playVisits(
      engine,
      THREE_MISS,
      [T(20), S(20)],
      SEVEN[0],
      THREE_MISS,
      SEVEN[1],
      THREE_MISS,
      [IB, OB, S(19)],
      THREE_MISS,
    );
    expect(engine.state().seats[0].status).toBe("COMPLETE");
    expect(engine.state().seats[0].points).toBe(19);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().activeParticipantRef).toBe("p1");
    playVisits(engine, [S(19)]);
    expect(engine.state().winnerParticipantRef).toBe("p1");
  });

  it("lets the other seat win by closing out ahead of a closed-out opponent", () => {
    const engine = newDuel();
    playVisits(
      engine,
      THREE_MISS,
      [T(20), S(20)],
      SEVEN[0],
      THREE_MISS,
      SEVEN[1],
      THREE_MISS,
      [IB, OB, S(19)],
      [T(19), T(18), T(17)],
      THREE_MISS,
      [T(16), T(15), IB],
      THREE_MISS,
      [OB],
    );
    expect(engine.state().winnerParticipantRef).toBe("p2");
  });

  it("undoing a scoring dart takes its points back", () => {
    const engine = newDuel();
    playVisits(engine, [T(20)], THREE_MISS);
    engine.record(S(20));
    expect(engine.state().seats[0].points).toBe(20);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].points).toBe(0);
    expect(engine.state().seats[0].marks[0]).toBe(3);
  });

  it("undoing the dart that kills a number lets it score again", () => {
    const engine = newDuel();
    playVisits(engine, [T(20)]);
    for (let i = 0; i < 3; i += 1) engine.record(S(20));
    expect(engine.state().seats[1].marks[0]).toBe(3);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[1].marks[0]).toBe(2);
    engine.record(MISS);
    playVisits(engine, [S(20)]);
    expect(engine.state().seats[0].points).toBe(20);
  });

  it("keeps V1 solo state identical to the pre-V2 engine apart from points and winner", () => {
    const log = [
      T(20),
      dart(19, "DOUBLE"),
      MISS,
      dart(25, "INNER_BULL"),
      S(20),
      dart(14, "SINGLE"),
      T(19),
      T(18),
      T(17),
      T(16),
      T(15),
      dart(25, "OUTER_BULL"),
    ];
    const seat = (
      marks: number[],
      closedAtDart: (number | null)[],
      objectiveHits: number[],
      trebleHits: number,
      dartsThrown: number,
      status: "IN_PROGRESS" | "COMPLETE",
    ) => ({
      participantRef: "participant-1",
      sideKey: "A",
      marks,
      closedAtDart,
      objectiveHits,
      trebleHits,
      dartsThrown,
      dartsThisVisit: 0,
      status,
      points: 0,
    });
    const expected = {
      2: seat(
        [3, 2, 0, 0, 0, 0, 0],
        [1, null, null, null, null, null, null],
        [1, 1, 0, 0, 0, 0, 0],
        1,
        3,
        "IN_PROGRESS",
      ),
      5: seat(
        [3, 2, 0, 0, 0, 0, 2],
        [1, null, null, null, null, null, null],
        [2, 1, 0, 0, 0, 0, 1],
        1,
        6,
        "IN_PROGRESS",
      ),
      11: seat(
        [3, 3, 3, 3, 3, 3, 3],
        [1, 7, 8, 9, 10, 11, 12],
        [2, 2, 1, 1, 1, 1, 2],
        6,
        12,
        "COMPLETE",
      ),
    } as const;
    const engine = new CricketEngine(config);
    log.forEach((observation, index) => {
      const state = engine.record(observation);
      const want = expected[index as keyof typeof expected];
      if (want) {
        expect(state).toEqual({
          activeParticipantRef: "participant-1",
          status: want.status,
          winnerParticipantRef: null,
          seats: [want],
        });
      }
    });
  });

  it("folds a V2 solo log exactly as V1", () => {
    const v1 = new CricketEngine(config);
    const v2 = new CricketEngine(config, undefined, "CRICKET_V2");
    for (const observation of [T(20), S(20), D(5), MISS, IB]) {
      v1.record(observation);
      v2.record(observation);
    }
    expect(v2.state()).toEqual(v1.state());
    expect(v2.state().winnerParticipantRef).toBeNull();
  });
});

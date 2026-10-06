import { describe, it, expect } from "vitest";
import {
  applyCricketDart,
  CricketEngine,
  cricketEngineFactory,
  cricketMarksOf,
  effectiveMarks,
  foldCricketState,
  initialCricketState,
  marksPerRound,
} from "@modules/game/cricket.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
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
    expect(() => engine.record(MISS)).toThrow();
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

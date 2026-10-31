import { describe, it, expect } from "vitest";
import {
  foldMickeyMouseState,
  initialMickeyMouseState,
  isMickeyMouseTarget,
  MICKEY_MOUSE_OBJECTIVES,
  MickeyMouseEngine,
  mickeyMouseDipOf,
  mickeyMouseEngineFactory,
  mickeyMouseMarksOf,
} from "@modules/game/mickey-mouse.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { seededUniform } from "@modules/game/seeded-rng.module";
import { randomObservation } from "./support/engine-oracle";
import type { DartObservation, DartZoneKey } from "@modules/types";
import type { MickeyMouseSnapshot, Seated } from "@lib/types";

const config: Seated<MickeyMouseSnapshot> = {
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
  14: 6,
  13: 7,
  12: 8,
  DOUBLES: 9,
  TRIPLES: 10,
  BULL: 11,
};

const NUMBER_TREBLES = [20, 19, 18, 17, 16, 15, 14, 13, 12].map(T);
const ALL_BUT_LAST = [...NUMBER_TREBLES, IB, OB, D(7), D(7)];

function newEngine() {
  return new MickeyMouseEngine(config);
}

function recordAll(engine: MickeyMouseEngine, observations: DartObservation[]) {
  for (const observation of observations) engine.record(observation);
}

describe("MICKEY_MOUSE_OBJECTIVES", () => {
  it("lists twelve objectives in display order", () => {
    expect(MICKEY_MOUSE_OBJECTIVES).toEqual([
      20,
      19,
      18,
      17,
      16,
      15,
      14,
      13,
      12,
      "DOUBLES",
      "TRIPLES",
      25,
    ]);
  });
});

describe("mickeyMouseEngineFactory", () => {
  it("registers itself under MICKEY_MOUSE_V1", () => {
    expect(mickeyMouseEngineFactory.rulesetVersionKey).toBe("MICKEY_MOUSE_V1");
    expect(getEngineFactory("MICKEY_MOUSE_V1")).toBe(mickeyMouseEngineFactory);
  });
});

describe("mickeyMouseMarksOf and mickeyMouseDipOf", () => {
  it.each([
    [
      "T20",
      T(20),
      { objectiveIndex: IDX[20], marks: 3 },
      { objectiveIndex: IDX.TRIPLES, marks: 1 },
    ],
    [
      "D20",
      D(20),
      { objectiveIndex: IDX[20], marks: 2 },
      { objectiveIndex: IDX.DOUBLES, marks: 1 },
    ],
    ["S20", S(20), { objectiveIndex: IDX[20], marks: 1 }, null],
    [
      "D12",
      D(12),
      { objectiveIndex: IDX[12], marks: 2 },
      { objectiveIndex: IDX.DOUBLES, marks: 1 },
    ],
    ["D7", D(7), { objectiveIndex: IDX.DOUBLES, marks: 1 }, null],
    ["T7", T(7), { objectiveIndex: IDX.TRIPLES, marks: 1 }, null],
    ["S7", S(7), null, null],
    ["miss", MISS, null, null],
    ["outer bull", OB, { objectiveIndex: IDX.BULL, marks: 1 }, null],
    ["inner bull", IB, { objectiveIndex: IDX.BULL, marks: 2 }, null],
    [
      "inner bull carrying 20",
      dart(20, "INNER_BULL"),
      { objectiveIndex: IDX.BULL, marks: 2 },
      null,
    ],
  ])("%s", (_label, observation, hit, dip) => {
    expect(mickeyMouseMarksOf(observation)).toEqual(hit);
    expect(mickeyMouseDipOf(observation)).toEqual(dip);
  });
});

describe("isMickeyMouseTarget", () => {
  it("is true for a treble on 7 and false for a single", () => {
    expect(isMickeyMouseTarget(T(7))).toBe(true);
    expect(isMickeyMouseTarget(S(7))).toBe(false);
  });
});

describe("MickeyMouseEngine", () => {
  it("a treble 20 on an open 20 marks 20 three times and Triples once; undo reverses both", () => {
    const engine = newEngine();
    engine.record(T(20));
    const seat = engine.state().seats[0];
    expect(seat.marks[IDX[20]]).toBe(3);
    expect(seat.marks[IDX.TRIPLES]).toBe(1);
    engine.undo();
    expect(engine.state().seats[0].marks.every((m) => m === 0)).toBe(true);
  });

  it("a double 20 with 20 closed marks Doubles and drops the number's marks", () => {
    const engine = newEngine();
    recordAll(engine, [T(20), D(20)]);
    const seat = engine.state().seats[0];
    expect(seat.marks[IDX[20]]).toBe(3);
    expect(seat.marks[IDX.DOUBLES]).toBe(1);
    expect(seat.marks[IDX.TRIPLES]).toBe(1);
  });

  it("stores a double on 7 as a true hit fact, not a miss", () => {
    const engine = newEngine();
    engine.record(D(7));
    const [written] = engine.facts().turns[0].darts;
    expect(written.hitTargetNumber).toBe(7);
    expect(written.hitZoneKey).toBe("DOUBLE");
    expect(written.intendedTargetNumber).toBeNull();
    expect(written.score).toBe(14);
    expect(engine.state().seats[0].marks[IDX.DOUBLES]).toBe(1);
  });

  it("scores no points, whatever the spare marks", () => {
    const engine = newEngine();
    recordAll(engine, [T(20), T(20), T(20)]);
    expect(engine.state().seats[0].points).toBe(0);
  });

  it("a single and a miss mark nothing", () => {
    const engine = newEngine();
    recordAll(engine, [S(7), MISS]);
    expect(engine.state().seats[0].marks.every((m) => m === 0)).toBe(true);
    expect(engine.state().seats[0].dartsThrown).toBe(2);
  });

  it("one dart that closes two objectives stamps both closedAtDart", () => {
    const engine = newEngine();
    recordAll(engine, [S(20), D(7), D(7), D(20)]);
    const seat = engine.state().seats[0];
    expect(seat.closedAtDart[IDX[20]]).toBe(4);
    expect(seat.closedAtDart[IDX.DOUBLES]).toBe(4);
  });

  it.each([
    ["dart 1", [MISS, MISS], 1],
    ["dart 2", [], 2],
    ["dart 3", [MISS], 3],
  ])("ends the run on %s of a visit", (_label, pad, dartsInLastVisit) => {
    const engine = newEngine();
    recordAll(engine, [...ALL_BUT_LAST, ...pad]);
    expect(engine.isComplete()).toBe(false);
    engine.record(D(7));
    const last = engine.facts().turns.at(-1)!;
    expect(engine.isComplete()).toBe(true);
    expect(last.darts).toHaveLength(dartsInLastVisit);
    expect(last.completedAt).not.toBeNull();
  });

  it("refuses a dart after completion and leaves facts untouched", () => {
    const engine = newEngine();
    recordAll(engine, [...ALL_BUT_LAST, D(7)]);
    const before = engine.facts();
    expect(() => engine.record(MISS)).toThrow(/game has ended/);
    expect(engine.facts()).toEqual(before);
  });

  it("undo of the closing dart reopens the run and its visit", () => {
    const engine = newEngine();
    recordAll(engine, [...ALL_BUT_LAST, D(7)]);
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    const turnsBefore = engine.facts().turns.length;
    const dartsBefore = engine.facts().turns.at(-1)!.darts.length;
    expect(engine.facts().turns.at(-1)!.completedAt).toBeNull();
    engine.record(MISS);
    expect(engine.facts().turns).toHaveLength(turnsBefore);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(dartsBefore + 1);
  });

  it("wouldComplete is true only for the dart that closes the last objective", () => {
    const engine = newEngine();
    recordAll(engine, ALL_BUT_LAST);
    expect(engine.wouldComplete(MISS)).toBe(false);
    expect(engine.wouldComplete(S(7))).toBe(false);
    expect(engine.wouldComplete(D(7))).toBe(true);
  });

  it("rehydration from prior facts equals live recording over a seeded run", () => {
    for (const seed of [1, 2, 3]) {
      const rand = seededUniform(seed, 0);
      const live = newEngine();
      for (let step = 0; step < 250 && !live.isComplete(); step += 1) {
        live.record(randomObservation(rand));
        const replayed = new MickeyMouseEngine(config, live.facts());
        expect(replayed.state()).toEqual(live.state());
        expect(foldMickeyMouseState(live.facts(), config)).toEqual(
          live.state(),
        );
      }
    }
  });
});

describe("initialMickeyMouseState", () => {
  it("starts twelve objectives open on seat 0", () => {
    const state = initialMickeyMouseState(config);
    expect(state.seats[0].marks).toHaveLength(12);
    expect(state.activeParticipantRef).toBe("participant-1");
  });
});

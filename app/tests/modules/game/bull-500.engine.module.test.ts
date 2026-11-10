import { describe, it, expect } from "vitest";
import {
  BULL_500_LIVE_NUMBER,
  BULL_500_RULES,
  BULL_500_TARGET,
  Bull500Engine,
  bull500EngineFactory,
  bull500Unlocked,
  bull500VisitPoints,
  foldBull500State,
} from "@modules/game/bull-500.engine.module";
import { boardScore } from "@modules/game/board-progression.module";
import { dartGameEngineFactory } from "@modules/game/dart-engine-shell.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { seededUniform } from "@modules/game/seeded-rng.module";
import { randomObservation } from "./support/engine-oracle";
import type {
  DartFact,
  DartObservation,
  DartZoneKey,
  Bull500State,
} from "@modules/types";
import type { Bull500Snapshot, Seated } from "@lib/types";

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
    score: boardScore(hitTargetNumber, hitZoneKey),
  };
}

const s = (n: number) => dart(n, "OUTER_SINGLE");
const d = (n: number) => dart(n, "DOUBLE");
const t = (n: number) => dart(n, "TREBLE");
const outerBull = dart(25, "OUTER_BULL");
const innerBull = dart(25, "INNER_BULL");
const miss = dart(null, "MISS");

describe("bull 500 constants", () => {
  it("targets 500 on the 20 with three darts a visit", () => {
    expect(BULL_500_TARGET).toBe(500);
    expect(BULL_500_LIVE_NUMBER).toBe(20);
    expect(BULL_500_RULES.dartsPerVisit).toBe(3);
    expect(BULL_500_RULES.pointsOf).toBe(bull500VisitPoints);
  });
});

describe("bull500VisitPoints", () => {
  it.each([
    ["no bull scores nothing", [s(20), t(20), d(20)], 0],
    ["outer bull then T20 and S20", [outerBull, t(20), s(20)], 80],
    [
      "T20, inner bull, D20 scores only the double",
      [t(20), innerBull, d(20)],
      40,
    ],
    ["a bull on dart 3 leaves no scoring dart", [t(20), s(20), outerBull], 0],
    ["T20 before the bull scores 0, not 120", [t(20), outerBull, t(20)], 60],
    [
      "a second bull after the unlock scores 0",
      [outerBull, innerBull, t(20)],
      60,
    ],
    ["a bull after the live dart scores 0", [outerBull, t(20), innerBull], 60],
    ["an off-20 dart after the unlock scores 0", [outerBull, s(19), d(20)], 40],
    [
      "an off-board dart after the unlock scores 0",
      [outerBull, miss, s(20)],
      20,
    ],
    ["bull on dart 1 then two misses", [innerBull, miss, miss], 0],
  ])("%s", (_label, darts, points) => {
    expect(bull500VisitPoints(darts)).toBe(points);
  });
});

describe("bull500Unlocked", () => {
  it("is true when an outer or inner bull is among the darts", () => {
    expect(bull500Unlocked([s(20), outerBull])).toBe(true);
    expect(bull500Unlocked([innerBull])).toBe(true);
  });

  it("is false without a bull", () => {
    expect(bull500Unlocked([])).toBe(false);
    expect(bull500Unlocked([t(20), miss])).toBe(false);
  });
});

const solo: Seated<Bull500Snapshot> = {
  target: 500,
  live_number: 20,
  seats: [
    {
      participantRef: "p1",
      displayName: "Player 1",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
  ],
};

function obs(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const os = (n: number) => obs(n, "OUTER_SINGLE");
const ot = (n: number) => obs(n, "TREBLE");
const oBull = obs(25, "OUTER_BULL");
const iBull = obs(25, "INNER_BULL");
const oMiss = obs(null, "MISS");

const LOCKED_VISIT = [os(1), os(1), os(1)];
const WORTH_120 = [oBull, ot(20), ot(20)];
const AT_480 = [...WORTH_120, ...WORTH_120, ...WORTH_120, ...WORTH_120];

function engineAfter(observations: DartObservation[]): Bull500Engine {
  const engine = new Bull500Engine(solo);
  for (const observation of observations) engine.record(observation);
  return engine;
}

const seatOf = (state: Bull500State) => state.seats[0];

describe("bull 500 engine", () => {
  it("registers BULL_500_V1 as a PER_SEAT engine", () => {
    expect(getEngineFactory("BULL_500_V1")).toBe(bull500EngineFactory);
    expect(bull500EngineFactory.stageOwnership).toBe("PER_SEAT");
  });

  it("folds an empty log to the starting state", () => {
    expect(foldBull500State({ stages: [], turns: [] }, solo)).toEqual({
      activeParticipantRef: "p1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      seats: [
        {
          participantRef: "p1",
          sideKey: "A",
          total: 0,
          visits: 0,
          dartsThrown: 0,
          bestVisit: 0,
          scoringVisits: 0,
          openTotal: 0,
          dartsInVisit: 0,
          unlocked: false,
        },
      ],
    });
  });

  it("books a visit's points and tracks the best visit", () => {
    const state = engineAfter([
      ...WORTH_120,
      oBull,
      os(20),
      oMiss,
      ...LOCKED_VISIT,
    ]).state();
    expect(seatOf(state)).toMatchObject({
      total: 140,
      visits: 3,
      dartsThrown: 9,
      bestVisit: 120,
      scoringVisits: 2,
    });
  });

  it("the unlock does not carry to the next visit", () => {
    const state = engineAfter([
      os(1),
      os(1),
      oBull,
      os(20),
      os(20),
      os(20),
    ]).state();
    expect(seatOf(state)).toMatchObject({ total: 0, visits: 2 });
  });

  it("a second bull after the unlock scores nothing", () => {
    const state = engineAfter([oBull, iBull, ot(20)]).state();
    expect(seatOf(state).total).toBe(60);
  });

  it("an open visit shows its darts and whether it has unlocked", () => {
    const engine = new Bull500Engine(solo);
    engine.record(os(1));
    expect(seatOf(engine.state())).toMatchObject({
      dartsInVisit: 1,
      unlocked: false,
      total: 0,
    });
    engine.record(oBull);
    expect(seatOf(engine.state())).toMatchObject({
      dartsInVisit: 2,
      unlocked: true,
    });
    engine.record(os(20));
    expect(seatOf(engine.state())).toMatchObject({
      dartsInVisit: 0,
      unlocked: false,
      total: 20,
    });
  });

  it("passing 500 on dart 2 still takes dart 3 and completes only at visit close", () => {
    const engine = engineAfter([...AT_480, oBull, ot(20)]);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.isComplete()).toBe(false);
    engine.record(os(5));
    expect(engine.state()).toMatchObject({
      status: "COMPLETE",
      winningSideKey: "A",
    });
    expect(seatOf(engine.state())).toMatchObject({
      total: 540,
      visits: 5,
      dartsThrown: 15,
      bestVisit: 120,
    });
    expect(engine.isComplete()).toBe(true);
    expect(engine.facts().turns.at(-1)?.darts).toHaveLength(3);
  });

  it("an overshoot completes the game without a bust", () => {
    const state = engineAfter([...AT_480, oBull, ot(20), ot(20)]).state();
    expect(seatOf(state).total).toBe(600);
    expect(state.status).toBe("COMPLETE");
  });

  it("landing exactly on 500 completes the game", () => {
    const state = engineAfter([...AT_480, oBull, os(20), oMiss]).state();
    expect(seatOf(state).total).toBe(500);
    expect(state.status).toBe("COMPLETE");
  });

  it("refuses a dart after the game is complete", () => {
    const engine = engineAfter([...AT_480, oBull, ot(20), ot(20)]);
    expect(() => engine.record(oMiss)).toThrow(/game has ended/);
  });

  it("undoing the finishing dart reopens the visit and the game", () => {
    const engine = engineAfter([...AT_480, oBull, ot(20), os(5)]);
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toMatchObject({
      status: "IN_PROGRESS",
      winningSideKey: null,
    });
    expect(seatOf(engine.state())).toMatchObject({
      total: 480,
      dartsInVisit: 2,
      unlocked: true,
    });
    expect(engine.isComplete()).toBe(false);
    engine.record(os(5));
    const rebuilt = bull500EngineFactory.create(solo, engine.facts());
    expect(rebuilt.state()).toEqual(engine.state());
  });

  it("wouldComplete is true only for the third dart that reaches 500", () => {
    expect(new Bull500Engine(solo).wouldComplete(oBull)).toBe(false);
    expect(engineAfter(AT_480).wouldComplete(ot(20))).toBe(false);
    const afterBull = engineAfter([...AT_480, oBull]);
    expect(afterBull.wouldComplete(ot(20))).toBe(false);
    const afterMiss = engineAfter([...AT_480, oBull, oMiss]);
    expect(afterMiss.wouldComplete(os(20))).toBe(true);
    expect(afterMiss.wouldComplete(oMiss)).toBe(false);
  });

  it("intends the bull until the visit unlocks, then the 20, with no ring", () => {
    const [first] = engineAfter([os(1), oBull, os(20), os(1)]).facts().turns;
    expect(first.darts.map((dart) => dart.intendedTargetNumber)).toEqual([
      25, 25, 20,
    ]);
    const second = engineAfter([os(1), oBull, os(20), os(1)]).facts().turns[1];
    expect(second.darts[0].intendedTargetNumber).toBe(25);
    expect(first.darts.every((dart) => dart.intendedZoneKey === null)).toBe(
      true,
    );
  });

  it("stores a bull with its board score, never game points", () => {
    const [bull, live] = engineAfter([iBull, ot(20)]).facts().turns[0].darts;
    expect(bull).toMatchObject({ score: 50, hitTargetNumber: 25 });
    expect(live).toMatchObject({ score: 60 });
  });

  it("a factory for an unserved key throws", () => {
    expect(() =>
      dartGameEngineFactory(
        new Bull500Engine(solo).spec,
        Bull500Engine,
        "FIVES_V1",
      ),
    ).toThrow(/is not served by this spec/);
  });

  it("rehydrating from facts matches live recording", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rand = seededUniform(seed, 0);
      const engine = new Bull500Engine(solo);
      for (let step = 0; step < 600 && !engine.isComplete(); step += 1) {
        if (rand() < 0.15) engine.undo();
        else engine.record(randomObservation(rand));
        const rebuilt = bull500EngineFactory.create(solo, engine.facts());
        expect(rebuilt.state()).toEqual(engine.state());
      }
    }
  });
});

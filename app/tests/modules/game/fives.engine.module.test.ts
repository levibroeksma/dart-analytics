import { describe, it, expect } from "vitest";
import {
  FIVES_TARGET,
  fivesEngineFactory,
  FivesEngine,
  fivesPoints,
  foldFivesState,
} from "@modules/game/fives.engine.module";
import { dartGameEngineFactory } from "@modules/game/dart-engine-shell.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { seededUniform } from "@modules/game/seeded-rng.module";
import { randomObservation } from "./support/engine-oracle";
import type { DartObservation, DartZoneKey, FivesState } from "@modules/types";
import type { FivesSnapshot, Seated } from "@lib/types";

function configOf(count: number): Seated<FivesSnapshot> {
  const sides = ["A", "B", "C", "D"];
  return {
    seats: Array.from({ length: count }, (_, index) => ({
      participantRef: `p${index + 1}`,
      displayName: `Player ${index + 1}`,
      sideKey: sides[index],
      participantTypeKey: "PLAYER" as const,
    })),
  };
}

const duel = configOf(2);

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const s = (n: number) => dart(n, "OUTER_SINGLE");
const t = (n: number) => dart(n, "TREBLE");
const miss = dart(null, "MISS");
const missVisit = [miss, miss, miss];

function engineAfter(
  observations: DartObservation[],
  config = duel,
): FivesEngine {
  const engine = new FivesEngine(config);
  for (const observation of observations) engine.record(observation);
  return engine;
}

const seatOf = (state: FivesState, ref: string) =>
  state.seats.find((seat) => seat.participantRef === ref)!;

const A_AT_36 = [t(20), t(20), t(20), ...missVisit];
const A_AT_50 = [...A_AT_36, t(20), s(5), s(5), ...missVisit];

describe("fivesPoints", () => {
  it.each([
    [45, 9],
    [180, 36],
    [5, 1],
    [0, 0],
    [7, 0],
    [25, 5],
  ])("a total of %i scores %i", (total, points) => {
    expect(fivesPoints(total)).toBe(points);
  });
});

describe("fives engine", () => {
  it("registers FIVES_V1 as a SHARED engine", () => {
    expect(getEngineFactory("FIVES_V1")).toBe(fivesEngineFactory);
    expect(fivesEngineFactory.stageOwnership).toBe("SHARED");
    expect(FIVES_TARGET).toBe(51);
  });

  it("a visit with an off-board dart scores nothing, however its total divides", () => {
    const voided = engineAfter([s(20), s(20), miss]).state();
    expect(seatOf(voided, "p1")).toMatchObject({
      total: 0,
      voids: 1,
      scoringVisits: 0,
    });
    const onBoard = engineAfter([s(20), s(20), s(5)]).state();
    expect(seatOf(onBoard, "p1")).toMatchObject({
      total: 9,
      voids: 0,
      scoringVisits: 1,
    });
  });

  it("a total not divisible by 5 scores 0 and is neither void nor bust", () => {
    const state = engineAfter([s(20), s(20), s(3)]).state();
    expect(seatOf(state, "p1")).toMatchObject({
      total: 0,
      visits: 1,
      voids: 0,
      busts: 0,
      scoringVisits: 0,
    });
  });

  it("alternates seats per visit and holds a short visit open", () => {
    const engine = new FivesEngine(duel);
    engine.record(s(20));
    engine.record(s(20));
    expect(engine.state().activeParticipantRef).toBe("p1");
    expect(seatOf(engine.state(), "p1")).toMatchObject({
      total: 0,
      visits: 0,
      openTotal: 40,
      dartsInVisit: 2,
    });
    engine.record(s(5));
    expect(engine.state().activeParticipantRef).toBe("p2");
    engine.undo();
    expect(engine.state().activeParticipantRef).toBe("p1");
    expect(seatOf(engine.state(), "p1")).toMatchObject({
      total: 0,
      openTotal: 40,
      dartsInVisit: 2,
    });
  });

  it("180 is the most a visit scores", () => {
    expect(seatOf(engineAfter(A_AT_36).state(), "p1").total).toBe(36);
  });

  it("exactly 51 on dart 3 wins at once and the next seat never throws", () => {
    const engine = engineAfter([...A_AT_36, t(15), s(20), s(10)]);
    const state = engine.state();
    expect(seatOf(state, "p1").total).toBe(51);
    expect(state).toMatchObject({
      status: "COMPLETE",
      winningSideKey: "A",
      activeParticipantRef: "p1",
    });
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record(miss)).toThrow(/game has ended/);
  });

  it("undoing the winning dart reopens the visit and the leg", () => {
    const engine = engineAfter([...A_AT_36, t(15), s(20), s(10)]);
    expect(engine.undo()).toBe(true);
    const state = engine.state();
    expect(state).toMatchObject({
      status: "IN_PROGRESS",
      winningSideKey: null,
      activeParticipantRef: "p1",
    });
    expect(seatOf(state, "p1")).toMatchObject({
      total: 36,
      dartsInVisit: 2,
    });
    expect(engine.isComplete()).toBe(false);
  });

  it("after an undone win the seat throws on and can win again", () => {
    const engine = engineAfter([...A_AT_36, t(15), s(20), s(10)]);
    engine.undo();
    engine.record(s(10));
    expect(engine.state()).toMatchObject({
      status: "COMPLETE",
      winningSideKey: "A",
    });
    const rebuilt = fivesEngineFactory.create(duel, engine.facts());
    expect(rebuilt.state()).toEqual(engine.state());
  });

  it("a visit past 51 busts: the total stays and the bust counts", () => {
    const state = engineAfter([...A_AT_50, s(10), s(10), s(5)]).state();
    expect(seatOf(state, "p1")).toMatchObject({
      total: 50,
      busts: 1,
      voids: 0,
    });
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("a bust then a visit worth one point wins at 51", () => {
    const state = engineAfter([
      ...A_AT_50,
      s(10),
      s(10),
      s(5),
      ...missVisit,
      s(1),
      s(2),
      s(2),
    ]).state();
    expect(seatOf(state, "p1").total).toBe(51);
    expect(state).toMatchObject({ status: "COMPLETE", winningSideKey: "A" });
  });

  it("180 busts at 20 points and wins at 15", () => {
    const at20 = [t(20), s(20), s(20), ...missVisit];
    const busted = engineAfter([...at20, t(20), t(20), t(20)]).state();
    expect(seatOf(busted, "p1")).toMatchObject({ total: 20, busts: 1 });
    const at15 = [t(15), s(20), s(10), ...missVisit];
    const won = engineAfter([...at15, t(20), t(20), t(20)]).state();
    expect(seatOf(won, "p1")).toMatchObject({ total: 51 });
    expect(won.status).toBe("COMPLETE");
  });

  it("wouldComplete is true only for the winning dart", () => {
    const engine = engineAfter([...A_AT_36, t(15), s(20)]);
    expect(engine.wouldComplete(s(10))).toBe(true);
    expect(engine.wouldComplete(s(11))).toBe(false);
    expect(engine.wouldComplete(miss)).toBe(false);
    expect(new FivesEngine(duel).wouldComplete(s(10))).toBe(false);
  });

  it("writes NO_INTENT and the board score", () => {
    const [first] = engineAfter([t(20)]).facts().turns[0].darts;
    expect(first).toMatchObject({
      intendedTargetNumber: null,
      intendedZoneKey: null,
      score: 60,
    });
  });

  it("a miss is stored as a MISS dart with score 0", () => {
    const [first] = engineAfter([miss]).facts().turns[0].darts;
    expect(first).toMatchObject({ hitZoneKey: "MISS", score: 0 });
  });

  it("a factory for an unserved key throws", () => {
    expect(() =>
      dartGameEngineFactory(
        new FivesEngine(duel).spec,
        FivesEngine,
        "KILLER_V1",
      ),
    ).toThrow(/is not served by this spec/);
  });

  it("foldFivesState folds an empty log to the starting state", () => {
    expect(foldFivesState({ stages: [], turns: [] }, duel)).toEqual({
      activeParticipantRef: "p1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      seats: [
        expect.objectContaining({ participantRef: "p1", total: 0 }),
        expect.objectContaining({ participantRef: "p2", total: 0 }),
      ],
    });
  });

  it.each([2, 3, 4])(
    "rehydrating from facts matches live recording at %i seats",
    (seatCount) => {
      const config = configOf(seatCount);
      for (const seed of [1, 2, 3, 4, 5]) {
        const rand = seededUniform(seed, 0);
        let engine = new FivesEngine(config);
        for (let step = 0; step < 400 && !engine.isComplete(); step += 1) {
          if (rand() < 0.15) engine.undo();
          else engine.record(randomObservation(rand));
          const rebuilt = fivesEngineFactory.create(config, engine.facts());
          expect(rebuilt.state()).toEqual(engine.state());
          if (step % 25 === 24)
            engine = new FivesEngine(config, engine.facts());
        }
      }
    },
  );
});

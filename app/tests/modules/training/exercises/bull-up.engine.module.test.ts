import { describe, expect, it } from "vitest";
import {
  BullUpEngine,
  bullUpEngineFactory,
  foldBullUpState,
} from "@modules/training/exercises/bull-up.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { DartObservation } from "@modules/types";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");
const S20 = dart(20, "SINGLE");
const BULL = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");

function play(engine: BullUpEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("BullUpEngine", () => {
  it("starts with no throws and no last tier", () => {
    expect(bullUpEngineFactory.create({}).state()).toEqual({
      throws: 0,
      bullseyes: 0,
      bulls: 0,
      lastTier: null,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("counts a bullseye as a bullseye and a bull", () => {
    const state = play(new BullUpEngine({}), [BULL]);
    expect(state).toMatchObject({
      throws: 1,
      bullseyes: 1,
      bulls: 1,
      lastTier: "BULLSEYE",
    });
  });

  it("counts an outer bull as a bull only", () => {
    const state = play(new BullUpEngine({}), [OUTER]);
    expect(state).toMatchObject({
      throws: 1,
      bullseyes: 0,
      bulls: 1,
      lastTier: "OUTER_BULL",
    });
  });

  it("counts any other hit and off-board as a miss", () => {
    const state = play(new BullUpEngine({}), [S20, MISS]);
    expect(state).toMatchObject({
      throws: 2,
      bullseyes: 0,
      bulls: 0,
      lastTier: "MISS",
    });
  });

  it("aims every dart at the inner bull and records the board score", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER, S20, MISS]);
    const darts = engine.facts().turns.flatMap((t) => t.darts);
    expect(
      darts.map((d) => [d.intendedTargetNumber, d.intendedZoneKey]),
    ).toEqual(Array(4).fill([25, "INNER_BULL"]));
    expect(darts.map((d) => d.score)).toEqual([50, 25, 20, 0]);
  });

  it("writes each throw as its own completed turn", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER, MISS]);
    const turns = engine.facts().turns;
    expect(turns).toHaveLength(3);
    expect(turns.map((t) => t.darts.length)).toEqual([1, 1, 1]);
    expect(turns.map((t) => t.sequence)).toEqual([1, 2, 3]);
    expect(turns.every((t) => t.completedAt !== null)).toBe(true);
    expect(turns.map((t) => t.totalScore)).toEqual([50, 25, 0]);
    expect(engine.facts().stages).toEqual([
      expect.objectContaining({ stageTypeKey: "EXERCISE_BLOCK", sequence: 1 }),
    ]);
  });

  it("expiry judges every throw — none is left open", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER]);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.state()).toMatchObject({
      throws: 2,
      bulls: 2,
      status: "COMPLETE",
    });
  });

  it("refuses a throw once complete", () => {
    const engine = new BullUpEngine({});
    engine.expireTimer();
    expect(() => engine.record(BULL)).toThrow();
  });

  it("undo un-completes first, then removes the throw and its turn", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.facts().turns).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state()).toMatchObject({ throws: 1, lastTier: "BULLSEYE" });

    engine.record(MISS);
    expect(engine.facts().turns.map((t) => t.sequence)).toEqual([1, 2]);
  });

  it("undo on an empty log returns false", () => {
    expect(new BullUpEngine({}).undo()).toBe(false);
  });

  it("rehydrates from prior facts and keeps counting", () => {
    const first = new BullUpEngine({});
    play(first, [BULL, MISS]);
    const resumed = new BullUpEngine({}, first.facts());
    expect(resumed.state()).toEqual(first.state());
    resumed.record(OUTER);
    expect(resumed.state()).toMatchObject({
      throws: 3,
      bullseyes: 1,
      bulls: 2,
    });
  });

  it("foldBullUpState matches the live state", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER, S20]);
    expect(foldBullUpState(engine.facts(), false)).toEqual(engine.state());
  });

  it("rejects a non-empty config", () => {
    expect(() => new BullUpEngine({ target: 25 } as never)).toThrow();
  });

  it("is registered under BULL_UP_V1", () => {
    expect(getDartExerciseEngineFactory("BULL_UP_V1")).toBe(
      bullUpEngineFactory,
    );
  });

  it("produces facts the events batch accepts", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER, MISS]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});

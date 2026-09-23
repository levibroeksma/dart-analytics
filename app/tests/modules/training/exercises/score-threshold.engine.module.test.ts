import { describe, expect, it } from "vitest";
import {
  foldScoreThresholdState,
  ScoreThresholdEngine,
  scoreThresholdEngineFactory,
} from "@modules/training/exercises/score-threshold.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { ScoreThresholdConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";

const CONFIG: ScoreThresholdConfigData = { threshold: 65 };

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");
const T20 = dart(20, "TREBLE");
const S5 = dart(5, "SINGLE");

function play(
  engine: ScoreThresholdEngine,
  darts: DartObservation[],
): ReturnType<ScoreThresholdEngine["state"]> {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("ScoreThresholdEngine", () => {
  it("starts with no visits, no beats and no last total", () => {
    const engine = scoreThresholdEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      threshold: 65,
      beats: 0,
      visits: 0,
      lastVisitTotal: null,
      currentVisitTotal: 0,
      dartsInVisit: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("counts a visit of exactly 65 as a beat", () => {
    const state = play(new ScoreThresholdEngine(CONFIG), [T20, S5, MISS]);

    expect(state.visits).toBe(1);
    expect(state.beats).toBe(1);
    expect(state.lastVisitTotal).toBe(65);
    expect(state.currentVisitTotal).toBe(0);
    expect(state.dartsInVisit).toBe(0);
  });

  it("does not count a visit of 64 as a beat", () => {
    const state = play(new ScoreThresholdEngine(CONFIG), [
      T20,
      dart(4, "SINGLE"),
      MISS,
    ]);

    expect(state.visits).toBe(1);
    expect(state.beats).toBe(0);
    expect(state.lastVisitTotal).toBe(64);
  });

  it("scores doubles and bulls at board value", () => {
    const state = play(new ScoreThresholdEngine(CONFIG), [
      dart(20, "DOUBLE"),
      dart(25, "OUTER_BULL"),
      MISS,
    ]);

    expect(state.lastVisitTotal).toBe(65);
    expect(state.beats).toBe(1);
  });

  it("judges a visit only once its third dart lands", () => {
    const state = play(new ScoreThresholdEngine(CONFIG), [T20, T20]);

    expect(state.visits).toBe(0);
    expect(state.beats).toBe(0);
    expect(state.currentVisitTotal).toBe(120);
    expect(state.dartsInVisit).toBe(2);
    expect(state.lastVisitTotal).toBeNull();
  });

  it("starts every visit from 0", () => {
    const state = play(new ScoreThresholdEngine(CONFIG), [
      T20,
      T20,
      T20,
      S5,
      S5,
      S5,
    ]);

    expect(state.visits).toBe(2);
    expect(state.beats).toBe(1);
    expect(state.lastVisitTotal).toBe(15);
  });

  it("records no intended target on any dart", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    play(engine, [T20, MISS]);

    const darts = engine.facts().turns.flatMap((turn) => turn.darts);
    expect(
      darts.map((d) => [d.intendedTargetNumber, d.intendedZoneKey]),
    ).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it("leaves an unfinished visit unjudged at timer expiry", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    play(engine, [T20, T20, T20, T20, S5]);
    engine.expireTimer();

    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.visits).toBe(1);
    expect(state.beats).toBe(1);
    expect(state.dartsThrown).toBe(5);
  });

  it("undoes the last dart, un-judging its visit", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    play(engine, [T20, S5, MISS]);

    expect(engine.undo()).toBe(true);
    expect(engine.state().visits).toBe(0);
    expect(engine.state().currentVisitTotal).toBe(65);
  });

  it("un-completes before undoing a dart", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    play(engine, [T20]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().dartsThrown).toBe(1);
  });

  it("refuses to record once complete", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    engine.expireTimer();

    expect(() => engine.record(MISS)).toThrow();
  });

  it("rehydrates in-progress state from prior facts", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    play(engine, [T20, S5, MISS, T20]);

    const resumed = scoreThresholdEngineFactory.create(CONFIG, engine.facts());

    expect(resumed.state()).toEqual(engine.state());
  });

  it("rejects a threshold other than 65", () => {
    expect(
      () => new ScoreThresholdEngine({ threshold: 60 } as never),
    ).toThrow();
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("SCORE_THRESHOLD_V1")).toBe(
      scoreThresholdEngineFactory,
    );
  });

  it("produces facts the events-batch API accepts", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    play(engine, [T20, S5, MISS]);

    const parsed = EventsBatchRequest.safeParse(
      buildEventsBatch(engine.facts()),
    );

    expect(parsed.success).toBe(true);
  });
});

describe("foldScoreThresholdState", () => {
  it("derives state from a fact log without an engine instance", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    play(engine, [T20, T20, T20, S5]);

    expect(foldScoreThresholdState(engine.facts(), CONFIG, false)).toEqual(
      engine.state(),
    );
  });
});

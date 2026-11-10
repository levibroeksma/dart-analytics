import { describe, it, expect } from "vitest";
import {
  ACE_TARGET_POOL,
  AceEngine,
  aceDartPoints,
  aceEngineFactory,
  aceRoundScores,
  aceTargetFor,
  foldAceState,
} from "@modules/game/ace.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { seededUniform } from "@modules/game/seeded-rng.module";
import { randomObservation } from "./support/engine-oracle";
import type { DartObservation, DartZoneKey } from "@modules/types";
import type { AceSnapshot, Seated } from "@lib/types";

function configOf(
  count: number,
  rounds = 3,
  drawSeed = 7,
): Seated<AceSnapshot> {
  const sides = ["A", "B", "C", "D"];
  return {
    rounds,
    drawSeed,
    seats: Array.from({ length: count }, (_, index) => ({
      participantRef: `p${index + 1}`,
      displayName: `Player ${index + 1}`,
      sideKey: sides[index],
      participantTypeKey: "PLAYER" as const,
    })),
  };
}

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const miss = dart(null, "MISS");
const ringOn = (target: number, zone: DartZoneKey) => dart(target, zone);

describe("aceTargetFor", () => {
  it("is deterministic in (seed, round) and always from the pool", () => {
    for (let round = 0; round < 12; round++) {
      expect(aceTargetFor(99, round)).toBe(aceTargetFor(99, round));
      expect(ACE_TARGET_POOL).toContain(aceTargetFor(99, round));
    }
  });

  it("the pool is 1-20 and the bull (25)", () => {
    expect(ACE_TARGET_POOL).toHaveLength(21);
    expect(ACE_TARGET_POOL.at(-1)).toBe(25);
  });

  it("does not depend on earlier rounds, so undo and replay redraw it", () => {
    expect(aceTargetFor(5, 4)).toBe(aceTargetFor(5, 4));
    expect(
      Array.from({ length: 12 }, (_, round) => aceTargetFor(5, round)),
    ).toEqual(Array.from({ length: 12 }, (_, round) => aceTargetFor(5, round)));
  });
});

describe("aceDartPoints", () => {
  it.each([
    [17, dart(17, "INNER_SINGLE"), 1],
    [17, dart(17, "OUTER_SINGLE"), 1],
    [17, dart(17, "SINGLE"), 1],
    [17, dart(17, "DOUBLE"), 2],
    [17, dart(17, "TREBLE"), 3],
    [17, dart(18, "TREBLE"), 0],
    [17, dart(25, "OUTER_BULL"), 0],
    [17, miss, 0],
    [25, dart(25, "OUTER_BULL"), 4],
    [25, dart(25, "INNER_BULL"), 6],
    [25, dart(20, "TREBLE"), 0],
    [25, miss, 0],
  ])("target %i, dart %j scores %i", (target, observation, points) => {
    expect(
      aceDartPoints(target, {
        hitTargetNumber: observation.hitTargetNumber,
        hitZoneKey: observation.hitZoneKey,
      }),
    ).toBe(points);
  });
});

describe("ace engine", () => {
  it("registers ACE_V1 as a PER_SEAT engine", () => {
    expect(getEngineFactory("ACE_V1")).toBe(aceEngineFactory);
    expect(aceEngineFactory.stageOwnership).toBe("PER_SEAT");
  });

  it("scores only darts on the round's target, by ring", () => {
    const config = configOf(2);
    const target = aceTargetFor(config.drawSeed, 0);
    const engine = new AceEngine(config);
    const hits =
      target === 25
        ? [dart(25, "INNER_BULL"), dart(25, "OUTER_BULL"), miss]
        : [ringOn(target, "TREBLE"), ringOn(target, "DOUBLE"), miss];
    for (const observation of hits) engine.record(observation);
    const state = engine.state();
    expect(state.seats[0].total).toBe(target === 25 ? 10 : 5);
    expect(state.activeParticipantRef).toBe("p2");
  });

  it("every seat throws at the same target in a round", () => {
    const config = configOf(3);
    const engine = new AceEngine(config);
    const target = aceTargetFor(config.drawSeed, 0);
    expect(engine.state().target).toBe(target);
    for (let i = 0; i < 6; i++) engine.record(miss);
    expect(engine.state().target).toBe(target);
    for (let i = 0; i < 3; i++) engine.record(miss);
    expect(engine.state().target).toBe(aceTargetFor(config.drawSeed, 1));
  });

  it("ends after the last seat's visit in the last round; highest total wins", () => {
    const config = configOf(2, 3);
    const engine = new AceEngine(config);
    for (let round = 0; round < 3; round++) {
      const target = aceTargetFor(config.drawSeed, round);
      const best =
        target === 25 ? dart(25, "INNER_BULL") : ringOn(target, "TREBLE");
      engine.record(best);
      engine.record(miss);
      engine.record(miss);
      for (let i = 0; i < 3; i++) engine.record(miss);
    }
    const state = engine.state();
    expect(engine.isComplete()).toBe(true);
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
    expect(() => engine.record(miss)).toThrow();
  });

  it("equal highest totals are a shared win (TIE)", () => {
    const config = configOf(2, 3);
    const engine = new AceEngine(config);
    for (let i = 0; i < 18; i++) engine.record(miss);
    const state = engine.state();
    expect(state.status).toBe("TIE");
    expect(state.winningSideKey).toBeNull();
    expect(engine.isComplete()).toBe(true);
  });

  it("wouldComplete is true only for the final dart of the final visit", () => {
    const config = configOf(2, 3);
    const engine = new AceEngine(config);
    for (let i = 0; i < 17; i++) {
      expect(engine.wouldComplete(miss)).toBe(false);
      engine.record(miss);
    }
    expect(engine.wouldComplete(miss)).toBe(true);
  });

  it("a finished game neither completes again nor accepts another dart", () => {
    const engine = new AceEngine(configOf(2, 3));
    for (let i = 0; i < 18; i++) engine.record(miss);
    expect(engine.isComplete()).toBe(true);
    expect(engine.wouldComplete(miss)).toBe(false);
    expect(() => engine.record(miss)).toThrow();
    expect(engine.state().seats.every((seat) => seat.dartsInVisit === 0)).toBe(
      true,
    );
  });

  it("undo reopens a completed game", () => {
    const config = configOf(2, 3);
    const engine = new AceEngine(config);
    for (let i = 0; i < 18; i++) engine.record(miss);
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[1].dartsInVisit).toBe(2);
  });

  it("records no intent and stores board scores, never Ace points", () => {
    const config = configOf(2);
    const target = aceTargetFor(config.drawSeed, 0);
    const engine = new AceEngine(config);
    engine.record(
      target === 25 ? dart(25, "INNER_BULL") : ringOn(target, "TREBLE"),
    );
    const fact = engine.facts().turns[0].darts[0];
    expect(fact.score).toBe(target === 25 ? 50 : target * 3);
    expect(fact.intendedTargetNumber).toBeNull();
    expect(fact.intendedZoneKey).toBeNull();
  });

  it("an open visit shows its Ace points so far", () => {
    const config = configOf(2);
    const target = aceTargetFor(config.drawSeed, 0);
    const engine = new AceEngine(config);
    engine.record(
      target === 25 ? dart(25, "OUTER_BULL") : ringOn(target, "DOUBLE"),
    );
    const seat = engine.state().seats[0];
    expect(seat).toMatchObject({
      dartsInVisit: 1,
      visits: 0,
      total: 0,
      openPoints: target === 25 ? 4 : 2,
    });
  });

  it("aceRoundScores lists each closed round's score beside its target", () => {
    const config = configOf(2, 3);
    const engine = new AceEngine(config);
    for (let i = 0; i < 6; i++) engine.record(miss);
    expect(aceRoundScores(engine.facts(), config, "p1")).toEqual([
      { round: 1, target: aceTargetFor(config.drawSeed, 0), points: 0 },
    ]);
  });

  it("folding from prior facts equals live recording, at 2, 3 and 4 seats", () => {
    for (const count of [2, 3, 4]) {
      const config = configOf(count, 5, 123 + count);
      const rand = seededUniform(count, 1);
      const live = new AceEngine(config);
      while (!live.isComplete()) live.record(randomObservation(rand));
      const rebuilt = aceEngineFactory.create(config, live.facts());
      expect(rebuilt.state()).toEqual(live.state());
      expect(foldAceState(live.facts(), config)).toEqual(live.state());
    }
  });
});

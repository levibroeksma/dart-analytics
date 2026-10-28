import { describe, it, expect } from "vitest";
import {
  foldKillerState,
  KillerEngine,
  killerEngineFactory,
} from "@modules/game/killer.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  DartObservation,
  DartZoneKey,
  KillerSeatState,
  KillerState,
} from "@modules/types";
import type { KillerSnapshot, Seated } from "@lib/types";

const config: Seated<KillerSnapshot> = {
  lives: 3,
  seatNumbers: [5, 12],
  seats: [
    {
      participantRef: "p1",
      displayName: "Levi",
      sideKey: "A",
      participantTypeKey: "PLAYER",
    },
    {
      participantRef: "p2",
      displayName: "Guest",
      sideKey: "B",
      participantTypeKey: "GUEST",
    },
  ],
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const d = (n: number) => dart(n, "DOUBLE");
const s = (n: number) => dart(n, "OUTER_SINGLE");
const miss = dart(null, "MISS");

function engineAfter(observations: DartObservation[]): KillerEngine {
  const engine = new KillerEngine(config);
  for (const observation of observations) engine.record(observation);
  return engine;
}

const seatA = (state: KillerState) => state.seats[0];
const seatB = (state: KillerState) => state.seats[1];

/** A Killer, B at 1 life, A to throw: A D5 then D12 D12; B misses; A D12 to start. */
const B_AT_ONE_LIFE = [d(5), d(12), d(12), miss, miss, miss];

describe("killer engine", () => {
  it("registers KILLER_V1 as a SHARED engine", () => {
    expect(getEngineFactory("KILLER_V1")).toBe(killerEngineFactory);
    expect(killerEngineFactory.stageOwnership).toBe("SHARED");
  });

  it("seat 0 opens; 3 darts pass the turn", () => {
    const engine = new KillerEngine(config);
    expect(engine.state().activeParticipantRef).toBe("p1");
    engine.record(miss);
    engine.record(miss);
    expect(engine.state().activeParticipantRef).toBe("p1");
    engine.record(miss);
    expect(engine.state().activeParticipantRef).toBe("p2");
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
  });

  it("becoming a Killer on dart 1 lets darts 2–3 take lives (E4)", () => {
    const state = engineAfter([d(5), d(12), d(12)]).state();
    expect(seatB(state).lives).toBe(1);
    expect(seatA(state)).toMatchObject({
      killer: true,
      livesTaken: 2,
      dartsToKiller: 1,
    });
  });

  it("two own-double hits in one visit end not-Killer (E5)", () => {
    const state = engineAfter([d(5), d(5), miss]).state();
    expect(seatA(state)).toMatchObject({ killer: false, dartsToKiller: 1 });
  });

  it("a non-Killer's hit on another double takes nothing", () => {
    const state = engineAfter([d(12), s(12), miss]).state();
    expect(seatB(state).lives).toBe(3);
    expect(seatA(state).dartsThrown).toBe(3);
  });

  it("mid-visit win closes the visit", () => {
    const engine = engineAfter([...B_AT_ONE_LIFE, d(12)]);
    const state = engine.state();
    expect(state).toMatchObject({
      status: "COMPLETE",
      winningSideKey: "A",
      outOrder: ["p2"],
    });
    expect(seatB(state)).toMatchObject({ lives: 0, out: true });
    const last = engine.facts().turns.at(-1);
    expect(last?.darts).toHaveLength(1);
    expect(last?.completedAt).not.toBeNull();
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record(miss)).toThrow(/game has ended/);
  });

  it("undo reopens an elimination", () => {
    const engine = engineAfter([...B_AT_ONE_LIFE, d(12)]);
    expect(engine.undo()).toBe(true);
    const state = engine.state();
    expect(state).toMatchObject({
      status: "IN_PROGRESS",
      winningSideKey: null,
      outOrder: [],
      activeParticipantRef: "p1",
    });
    expect(seatB(state).lives).toBe(1);
    expect(engine.facts().turns.at(-1)?.darts).toHaveLength(3);
  });

  it("undo across a Killer toggle restores the status", () => {
    const engine = engineAfter([d(5), d(5)]);
    engine.undo();
    expect(seatA(engine.state()).killer).toBe(true);
    engine.undo();
    expect(seatA(engine.state())).toMatchObject({
      killer: false,
      dartsToKiller: null,
    });
  });

  it("rehydrates mid-visit", () => {
    const engine = engineAfter([d(5), miss, miss, s(1), d(12)]);
    const rebuilt = killerEngineFactory.create(config, engine.facts());
    expect(rebuilt.state()).toEqual(engine.state());
    rebuilt.record(miss);
    engine.record(miss);
    expect(rebuilt.state()).toEqual(engine.state());
    expect(rebuilt.state().activeParticipantRef).toBe("p1");
  });

  it("wouldComplete is true only for the eliminating dart", () => {
    const engine = engineAfter(B_AT_ONE_LIFE);
    expect(engine.wouldComplete(d(12))).toBe(true);
    expect(engine.wouldComplete(d(5))).toBe(false);
    expect(engine.wouldComplete(s(12))).toBe(false);
    expect(new KillerEngine(config).wouldComplete(d(12))).toBe(false);
  });

  it("writes NO_INTENT and the board score", () => {
    const [first] = engineAfter([d(12)]).facts().turns[0].darts;
    expect(first).toMatchObject({
      intendedTargetNumber: null,
      intendedZoneKey: null,
      score: 24,
    });
  });

  it("foldKillerState folds an empty log to the starting state", () => {
    expect(foldKillerState({ stages: [], turns: [] }, config)).toEqual({
      activeParticipantRef: "p1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      outOrder: [],
      seats: [
        expect.objectContaining({ number: 5, lives: 3, killer: false }),
        expect.objectContaining({ number: 12, lives: 3, killer: false }),
      ],
    });
  });

  it("golden: one full 2-seat game", () => {
    const game = [
      [s(5), d(5), d(12)],
      [d(5), d(12), d(5)],
      [d(5), d(12), d(5)],
      [d(12), d(5), d(12)],
      [d(12), miss, s(12)],
      [d(5), miss, miss],
      [d(12)],
    ].flat();
    const engine = new KillerEngine(config);
    const fmt = (seat: KillerSeatState) =>
      `${seat.lives}${seat.killer ? "K" : ""}${seat.out ? "X" : ""}`;
    const lines = game.map((observation) => {
      const thrower = engine.state().activeParticipantRef;
      const state = engine.record(observation);
      const label = `${observation.hitZoneKey}:${observation.hitTargetNumber}`;
      return `${thrower} ${label} → A:${fmt(seatA(state))} B:${fmt(seatB(state))}`;
    });
    const end = engine.state();
    lines.push(
      `${end.status} winner=${end.winningSideKey} out=${end.outOrder.join(",")} ` +
        `taken=${end.seats.map((seat) => seat.livesTaken).join("/")} ` +
        `toKiller=${end.seats.map((seat) => seat.dartsToKiller ?? "—").join("/")}`,
    );
    expect(lines).toMatchSnapshot();
  });
});

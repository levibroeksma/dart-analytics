import { describe, it, expect } from "vitest";
import {
  foldPrisonerState,
  PrisonerEngine,
  prisonerEngineFactory,
  prisonerDartResults,
} from "@modules/game/prisoner.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { WON_TARGET } from "@modules/game/prisoner-policy";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type {
  DartObservation,
  DartZoneKey,
  PrisonerSeatState,
  PrisonerState,
} from "@modules/types";
import type { PrisonerSnapshot, Seated, SeatFact } from "@lib/types";

function seat(n: number): SeatFact {
  return {
    participantRef: `p${n}`,
    displayName: `Seat ${n}`,
    sideKey: String.fromCharCode(64 + n),
    participantTypeKey: n === 1 ? "PLAYER" : "GUEST",
  };
}

const config: Seated<PrisonerSnapshot> = {
  darts: 3,
  seats: [seat(1), seat(2)],
};

const threeSeats: Seated<PrisonerSnapshot> = {
  darts: 3,
  seats: [seat(1), seat(2), seat(3)],
};

/** A coordinate-captured dart at the centre of `zone` on `n`. */
function at(n: number, zone: DartZoneKey): DartObservation {
  const point = zoneCentroid(n, zone);
  if (!point) throw new Error(`no centroid for ${zone} ${n}`);
  return {
    hitTargetNumber: n,
    hitZoneKey: zone,
    locationX: point.x,
    locationY: point.y,
  };
}

const outer = (n: number) => at(n, "OUTER_SINGLE");
const inner = (n: number) => at(n, "INNER_SINGLE");
const dbl = (n: number) => at(n, "DOUBLE");
const trb = (n: number) => at(n, "TREBLE");
const bull = (): DartObservation => ({
  hitTargetNumber: 25,
  hitZoneKey: "OUTER_BULL",
  locationX: 10,
  locationY: 0,
});
const bullseye = (): DartObservation => ({
  hitTargetNumber: 25,
  hitZoneKey: "INNER_BULL",
  locationX: 0,
  locationY: 0,
});
const miss: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

/** Three plain misses that change nothing: doubles never count. */
const PLAIN = [dbl(5), dbl(5), dbl(5)];

function engineAfter(
  inputs: DartObservation[],
  seats: Seated<PrisonerSnapshot> = config,
): PrisonerEngine {
  const engine = new PrisonerEngine(seats);
  for (const input of inputs) engine.record(input);
  return engine;
}

const seatOf = (state: PrisonerState, ref: string): PrisonerSeatState => {
  const found = state.seats.find((s) => s.participantRef === ref);
  if (!found) throw new Error(`no seat ${ref}`);
  return found;
};

/** A from target 1 to target 20 in seven visits; B throws plain misses between. */
const CLIMB_TO_20: DartObservation[] = [
  ...[1, 4, 7, 10, 13, 16].flatMap((n) => [
    outer(n),
    outer(n + 1),
    outer(n + 2),
    ...PLAIN,
  ]),
  outer(19),
  dbl(5),
  dbl(5),
  ...PLAIN,
];

/** A lodges a prisoner on 1 and holds 2; B bulls once and holds 2, budget 2; A's 2-dart visit passes. */
const B_HOLDS_TWO: DartObservation[] = [
  inner(1),
  dbl(5),
  dbl(5),
  bull(),
  dbl(5),
  dbl(5),
  dbl(5),
  dbl(5),
];

/** B lodges a prisoner on 1; A captures it with an advancing outer 1 and holds 4. */
const A_HOLDS_FOUR: DartObservation[] = [
  ...PLAIN,
  inner(1),
  dbl(5),
  dbl(5),
  outer(1),
  dbl(5),
  dbl(5),
  dbl(5),
  dbl(5),
];

describe("prisoner engine", () => {
  it("registers PRISONER_V1 as a SHARED engine", () => {
    expect(getEngineFactory("PRISONER_V1")).toBe(prisonerEngineFactory);
    expect(prisonerEngineFactory.stageOwnership).toBe("SHARED");
  });

  it("starts every seat on target 1 holding three; seat 1 throws", () => {
    const state = new PrisonerEngine(config).state();
    expect(state).toMatchObject({
      activeParticipantRef: "p1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      wonBy: null,
      outOrder: [],
      lodged: {},
      dartsLeft: 3,
    });
    expect(state.seats[0]).toEqual({
      participantRef: "p1",
      sideKey: "A",
      held: 3,
      out: false,
      target: 1,
      sitting: 0,
      budget: 3,
      captured: 0,
      imprisoned: 0,
    });
  });

  it("A opens on outer 1 to target 2; B throws once A's three darts are gone", () => {
    const engine = new PrisonerEngine(config);
    const first = engine.record(outer(1));
    expect(seatOf(first, "p1").target).toBe(2);
    expect(first).toMatchObject({ activeParticipantRef: "p1", dartsLeft: 2 });
    engine.record(dbl(5));
    const closed = engine.record(trb(5));
    expect(closed).toMatchObject({ activeParticipantRef: "p2", dartsLeft: 3 });
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
  });

  it("a missed dart sits out the next visit (2 darts), and returns for the one after (3)", () => {
    const engine = engineAfter([miss, dbl(5), dbl(5), ...PLAIN]);
    const before = engine.state();
    expect(seatOf(before, "p1")).toMatchObject({
      held: 3,
      sitting: 1,
      budget: 2,
    });
    expect(before).toMatchObject({ activeParticipantRef: "p1", dartsLeft: 2 });
    engine.record(dbl(5));
    const closed = engine.record(dbl(5));
    expect(closed.activeParticipantRef).toBe("p2");
    expect(engine.facts().turns.at(-1)?.darts).toHaveLength(2);
    expect(seatOf(closed, "p1")).toMatchObject({ sitting: 0, budget: 3 });
    for (const dart of PLAIN) engine.record(dart);
    engine.record(dbl(5));
    engine.record(dbl(5));
    expect(engine.state()).toMatchObject({
      activeParticipantRef: "p1",
      dartsLeft: 1,
    });
    engine.record(dbl(5));
    expect(engine.facts().turns.at(-1)?.darts).toHaveLength(3);
  });

  it("plain misses (double, treble, off-target inner, non-target outer) change nothing and sit nothing out", () => {
    const state = engineAfter([dbl(1), trb(1), inner(7)]).state();
    expect(seatOf(state, "p1")).toMatchObject({
      held: 3,
      target: 1,
      sitting: 0,
      budget: 3,
    });
    expect(state.lodged).toEqual({});
    const later = engineAfter([dbl(1), trb(1), outer(9)]).state();
    expect(seatOf(later, "p1")).toMatchObject({
      held: 3,
      target: 1,
      sitting: 0,
    });
  });

  it("Focus 1: inner 1 then outer 1 at target 1 — prison, then advance and capture; the third dart goes at 2", () => {
    const engine = new PrisonerEngine(config);
    const prisoned = engine.record(inner(1));
    expect(seatOf(prisoned, "p1")).toMatchObject({ held: 2, target: 1 });
    expect(prisoned.lodged).toEqual({ 1: 1 });
    const captured = engine.record(outer(1));
    expect(seatOf(captured, "p1")).toMatchObject({
      held: 3,
      target: 2,
      captured: 1,
      imprisoned: 1,
    });
    expect(captured.lodged).toEqual({});
    expect(captured.dartsLeft).toBe(1);
    const third = engine.record(outer(2));
    expect(seatOf(third, "p1")).toMatchObject({ held: 3, target: 3 });
    expect(third.activeParticipantRef).toBe("p2");
  });

  it("Focus 2: outer 20 at target 20 wins at once as the visit's first dart; record refused; undo reopens", () => {
    const engine = engineAfter(CLIMB_TO_20);
    const before = engine.state();
    expect(seatOf(before, "p1").target).toBe(20);
    expect(before.activeParticipantRef).toBe("p1");
    expect(engine.wouldComplete(outer(19))).toBe(false);
    expect(engine.wouldComplete(inner(20))).toBe(false);
    expect(engine.wouldComplete(outer(20))).toBe(true);
    const won = engine.record(outer(20));
    expect(won).toMatchObject({
      status: "COMPLETE",
      winningSideKey: "A",
      wonBy: "COMPLETED_20",
      dartsLeft: 0,
    });
    expect(seatOf(won, "p1").target).toBe(WON_TARGET);
    const last = engine.facts().turns.at(-1);
    expect(last?.darts).toHaveLength(1);
    expect(last?.completedAt).not.toBeNull();
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record(dbl(5))).toThrow(/game has ended/);
    expect(engine.wouldComplete(outer(20))).toBe(false);
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual(before);
  });

  it("Focus 3: B holding one dart is prisoned by the bull and goes out at once; A wins LAST_IN", () => {
    const engine = engineAfter(B_HOLDS_TWO);
    expect(seatOf(engine.state(), "p2")).toMatchObject({ held: 2, budget: 2 });
    expect(engine.state().activeParticipantRef).toBe("p2");
    expect(engine.wouldComplete(bull())).toBe(false);
    const one = engine.record(bull());
    expect(seatOf(one, "p2")).toMatchObject({ held: 1, out: false });
    expect(engine.wouldComplete(bullseye())).toBe(true);
    const out = engine.record(bullseye());
    expect(seatOf(out, "p2")).toMatchObject({ held: 0, out: true });
    expect(out).toMatchObject({
      status: "COMPLETE",
      winningSideKey: "A",
      wonBy: "LAST_IN",
      outOrder: ["p2"],
    });
    expect(engine.facts().turns.at(-1)?.completedAt).not.toBeNull();
    expect(() => engine.record(dbl(5))).toThrow(/game has ended/);
  });

  it("Focus 3: a capture earlier in the same visit keeps B in past a later prison", () => {
    const engine = engineAfter(B_HOLDS_TWO);
    const captured = engine.record(outer(1));
    expect(seatOf(captured, "p2")).toMatchObject({
      held: 3,
      target: 2,
      captured: 1,
    });
    const after = engine.record(bull());
    expect(seatOf(after, "p2")).toMatchObject({ held: 2, out: false });
    expect(after).toMatchObject({
      status: "IN_PROGRESS",
      activeParticipantRef: "p1",
      lodged: {},
    });
  });

  it("Focus 4: both seats' darts all sitting out — the walk skips both, returns their darts, and A throws", () => {
    const engine = engineAfter([miss, miss, miss]);
    expect(seatOf(engine.state(), "p1")).toMatchObject({
      sitting: 3,
      budget: 0,
    });
    expect(engine.state().activeParticipantRef).toBe("p2");
    engine.record(miss);
    engine.record(miss);
    const state = engine.record(miss);
    expect(state.activeParticipantRef).toBe("p1");
    expect(state.dartsLeft).toBe(3);
    expect(seatOf(state, "p1")).toMatchObject({ sitting: 0, budget: 3 });
    expect(seatOf(state, "p2")).toMatchObject({ sitting: 0, budget: 3 });
    for (const dart of PLAIN) engine.record(dart);
    expect(engine.state().activeParticipantRef).toBe("p2");
  });

  it("a seat whose darts all sit out is skipped once; the other seat throws again", () => {
    const engine = engineAfter([miss, miss, miss]);
    for (const dart of PLAIN) engine.record(dart);
    const state = engine.state();
    expect(state.activeParticipantRef).toBe("p2");
    expect(seatOf(state, "p1")).toMatchObject({
      held: 3,
      sitting: 0,
      budget: 3,
    });
    for (const dart of PLAIN) engine.record(dart);
    expect(engine.state().activeParticipantRef).toBe("p1");
  });

  it("Focus 5: a bull costs a dart and lodges nothing", () => {
    const state = engineAfter([bull()]).state();
    expect(seatOf(state, "p1")).toMatchObject({ held: 2, imprisoned: 1 });
    expect(state.lodged).toEqual({});
  });

  it("Focus 7: one valid hit on a number with several prisoners takes one", () => {
    const state = engineAfter([
      inner(1),
      dbl(5),
      dbl(5),
      inner(1),
      dbl(5),
      dbl(5),
      dbl(5),
      outer(1),
    ]).state();
    expect(state.lodged).toEqual({ 1: 1 });
    expect(seatOf(state, "p1")).toMatchObject({ held: 3, captured: 1 });
  });

  it("Focus 8: a capture on a non-target number does not advance; A holds 4 and throws 4 next visit", () => {
    const noAdvance = engineAfter([
      outer(1),
      outer(2),
      dbl(5),
      inner(1),
      dbl(5),
      dbl(5),
      outer(1),
    ]);
    expect(seatOf(noAdvance.state(), "p1")).toMatchObject({
      target: 3,
      held: 4,
      captured: 1,
    });
    const engine = engineAfter(A_HOLDS_FOUR);
    const before = engine.state();
    expect(seatOf(before, "p1")).toMatchObject({
      held: 4,
      budget: 4,
      target: 2,
    });
    expect(seatOf(before, "p2")).toMatchObject({ held: 2, budget: 2 });
    expect(before).toMatchObject({ activeParticipantRef: "p1", dartsLeft: 4 });
    for (const dart of PLAIN) engine.record(dart);
    expect(engine.state()).toMatchObject({
      activeParticipantRef: "p1",
      dartsLeft: 1,
    });
    const closed = engine.record(dbl(5));
    expect(closed.activeParticipantRef).toBe("p2");
    expect(engine.facts().turns.at(-1)?.darts).toHaveLength(4);
  });

  it("a capture mid-visit adds no throw to that visit", () => {
    const engine = engineAfter([...PLAIN, inner(1), dbl(5), dbl(5)]);
    engine.record(outer(1));
    engine.record(dbl(5));
    const closed = engine.record(dbl(5));
    expect(seatOf(closed, "p1").held).toBe(4);
    expect(closed.activeParticipantRef).toBe("p2");
    expect(engine.facts().turns.at(-1)?.darts).toHaveLength(3);
  });

  it("three seats: an out seat is passed by the rota and play goes on", () => {
    const engine = engineAfter(
      [...PLAIN, ...PLAIN, bull(), bull(), bull()],
      threeSeats,
    );
    const state = engine.state();
    expect(state).toMatchObject({
      status: "IN_PROGRESS",
      outOrder: ["p3"],
      activeParticipantRef: "p1",
    });
    expect(seatOf(state, "p3").out).toBe(true);
    for (const dart of PLAIN) engine.record(dart);
    for (const dart of PLAIN) engine.record(dart);
    expect(engine.state().activeParticipantRef).toBe("p1");
  });

  it("folds from facts to the live state", () => {
    const engine = engineAfter(A_HOLDS_FOUR);
    expect(foldPrisonerState(engine.facts(), config)).toEqual(engine.state());
  });
});

/**
 * The golden game: a prison, a capture by advance, a bounce-out, a bull, a
 * capture off target, a skipped visit, and a win by 20 on a visit's first dart.
 */
const GOLDEN: DartObservation[] = [
  inner(1),
  outer(1),
  outer(2),
  outer(1),
  miss,
  bull(),
  outer(3),
  outer(4),
  inner(5),
  outer(5),
  miss,
  miss,
  dbl(2),
  trb(2),
  inner(7),
  outer(2),
  outer(3),
  outer(4),
  ...[5, 7, 9, 11, 13, 15].flatMap((n) => [
    outer(n),
    outer(n + 1),
    dbl(1),
    dbl(1),
    dbl(1),
  ]),
  outer(17),
  dbl(18),
  dbl(1),
  dbl(1),
  dbl(1),
  outer(18),
  outer(19),
  dbl(1),
  dbl(1),
  dbl(1),
  outer(20),
];

function zoneLabel(dart: DartObservation): string {
  switch (dart.hitZoneKey) {
    case "OUTER_SINGLE":
      return `outer ${dart.hitTargetNumber}`;
    case "INNER_SINGLE":
      return `inner ${dart.hitTargetNumber}`;
    case "DOUBLE":
      return `D${dart.hitTargetNumber}`;
    case "TREBLE":
      return `T${dart.hitTargetNumber}`;
    case "OUTER_BULL":
      return "bull";
    default:
      return dart.hitZoneKey.toLowerCase();
  }
}

describe("prisoner golden game", () => {
  it("plays to a win by 20; every step rehydrates; wouldComplete only on the winning dart", () => {
    const engine = new PrisonerEngine(config);
    const lines: string[] = [];
    const states: PrisonerState[] = [engine.state()];
    GOLDEN.forEach((dart, i) => {
      const ref = engine.state().activeParticipantRef;
      expect(engine.wouldComplete(dart)).toBe(i === GOLDEN.length - 1);
      const state = engine.record(dart);
      const seatState = seatOf(state, ref);
      lines.push(
        `${ref} ${zoneLabel(dart)} → target:${seatState.target} held:${seatState.held}`,
      );
      states.push(state);
      expect(new PrisonerEngine(config, engine.facts()).state()).toEqual(state);
    });
    expect(engine.state()).toMatchObject({
      status: "COMPLETE",
      winningSideKey: "A",
      wonBy: "COMPLETED_20",
    });
    expect(lines.join("\n")).toMatchSnapshot();
    for (let i = GOLDEN.length - 1; i >= 0; i--) {
      expect(engine.undo()).toBe(true);
      expect(engine.state()).toEqual(states[i]);
      expect(new PrisonerEngine(config, engine.facts()).state()).toEqual(
        states[i],
      );
    }
    expect(engine.undo()).toBe(false);
  });

  it("Focus 9: the skip, the captures and the bull fold as the rules say", () => {
    const engine = engineAfter(GOLDEN.slice(0, 18));
    const state = engine.state();
    expect(seatOf(state, "p1")).toMatchObject({
      held: 2,
      target: 5,
      captured: 1,
      imprisoned: 2,
      sitting: 0,
      budget: 2,
    });
    expect(seatOf(state, "p2")).toMatchObject({
      held: 3,
      target: 5,
      captured: 1,
      imprisoned: 1,
      sitting: 0,
      budget: 3,
    });
    expect(state.lodged).toEqual({});
    expect(state.activeParticipantRef).toBe("p1");
    const turns = engine.facts().turns;
    expect(turns.map((turn) => turn.participantRef)).toEqual([
      "p1",
      "p2",
      "p1",
      "p2",
      "p1",
      "p2",
      "p2",
    ]);
    expect(turns.map((turn) => turn.darts.length)).toEqual([
      3, 3, 3, 1, 2, 3, 3,
    ]);
  });

  it("labels each dart of a visit", () => {
    const engine = engineAfter(GOLDEN.slice(0, 3));
    const facts = engine.facts();
    const opening = foldPrisonerState({ ...facts, turns: [] }, config);
    expect(
      prisonerDartResults(
        opening,
        facts.turns[0].participantRef,
        facts.turns[0].darts,
      ),
    ).toEqual(["Prison", "Advance and capture", "Advance"]);
    const afterA = foldPrisonerState(facts, config);
    expect(
      prisonerDartResults(afterA, "p2", [outer(1), miss, bull(), dbl(9)]),
    ).toEqual(["Advance", "Miss", "Prison", "Miss"]);
  });
});

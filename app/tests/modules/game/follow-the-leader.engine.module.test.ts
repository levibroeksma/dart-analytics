import { describe, it, expect } from "vitest";
import {
  foldFollowTheLeaderState,
  FollowTheLeaderEngine,
  followTheLeaderEngineFactory,
} from "@modules/game/follow-the-leader.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  BedFact,
  DartObservation,
  DartZoneKey,
  FollowTheLeaderAction,
  FollowTheLeaderState,
} from "@modules/types";
import type { FollowTheLeaderSnapshot, Seated } from "@lib/types";

const config: Seated<FollowTheLeaderSnapshot> = {
  lives: 3,
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
const t = (n: number) => dart(n, "TREBLE");
const s = (n: number) => dart(n, "OUTER_SINGLE");
const ob = dart(25, "OUTER_BULL");
const ib = dart(50, "INNER_BULL");
const miss = dart(null, "MISS");
const STOP: FollowTheLeaderAction = { kind: "STOP" };
const KEEP: FollowTheLeaderAction = { kind: "KEEP" };

type Input = DartObservation | FollowTheLeaderAction;

function engineAfter(inputs: Input[]): FollowTheLeaderEngine {
  const engine = new FollowTheLeaderEngine(config);
  for (const input of inputs) engine.record(input);
  return engine;
}

const seatA = (state: FollowTheLeaderState) => state.seats[0];
const seatB = (state: FollowTheLeaderState) => state.seats[1];

/** A opens on T18; A leads, B to match. */
const OPENED = [t(18)];

/** B failed T18 (B at 2), A to lead with a keep allowed. */
const B_FAILED = [...OPENED, s(18), s(18), s(18)];

describe("follow the leader engine", () => {
  it("registers FOLLOW_THE_LEADER_V1 as a SHARED engine", () => {
    expect(getEngineFactory("FOLLOW_THE_LEADER_V1")).toBe(
      followTheLeaderEngineFactory,
    );
    expect(followTheLeaderEngineFactory.stageOwnership).toBe("SHARED");
  });

  it("seat 0 opens; an off-board opening dart is stored and thrown again", () => {
    const engine = new FollowTheLeaderEngine(config);
    expect(engine.state()).toMatchObject({
      activeParticipantRef: "p1",
      phase: "OPENING",
      target: null,
      leaderRef: null,
    });
    const afterMiss = engine.record(miss);
    expect(afterMiss).toMatchObject({
      activeParticipantRef: "p1",
      phase: "OPENING",
    });
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
    const afterSet = engine.record(t(18));
    expect(afterSet).toMatchObject({
      target: { number: 18, ring: "TREBLE" },
      leaderRef: "p1",
      activeParticipantRef: "p2",
      phase: "MATCH",
    });
    expect(engine.facts().turns).toHaveLength(2);
  });

  it("a matcher's three missed darts cost a life; target and leader stand", () => {
    const state = engineAfter(B_FAILED).state();
    expect(seatB(state).lives).toBe(2);
    expect(seatA(state).lives).toBe(3);
    expect(state).toMatchObject({
      target: { number: 18, ring: "TREBLE" },
      leaderRef: "p1",
      activeParticipantRef: "p1",
      phase: "LEAD",
      keepAllowed: true,
    });
  });

  it("a keep writes a closed dartless kept turn; undo pops it", () => {
    const engine = engineAfter(B_FAILED);
    const state = engine.record(KEEP);
    const last = engine.facts().turns.at(-1);
    expect(last).toMatchObject({ participantRef: "p1", kept: true, darts: [] });
    expect(last?.completedAt).not.toBeNull();
    expect(state).toMatchObject({
      activeParticipantRef: "p2",
      phase: "MATCH",
      keepAllowed: false,
      target: { number: 18, ring: "TREBLE" },
    });
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.at(-1)?.kept).not.toBe(true);
    expect(engine.state()).toMatchObject({
      activeParticipantRef: "p1",
      keepAllowed: true,
    });
  });

  it("a stop after a match closes the visit with no loss; undo reopens it", () => {
    const engine = engineAfter(OPENED);
    const matched = engine.record(t(18));
    expect(matched).toMatchObject({ matched: true, canStop: true });
    const stopped = engine.record(STOP);
    expect(seatB(stopped).lives).toBe(3);
    expect(stopped).toMatchObject({
      leaderRef: "p1",
      activeParticipantRef: "p1",
      phase: "LEAD",
      keepAllowed: false,
      canStop: false,
    });
    expect(engine.facts().turns.at(-1)?.completedAt).not.toBeNull();
    expect(engine.undo()).toBe(true);
    const last = engine.facts().turns.at(-1);
    expect(last?.completedAt).toBeNull();
    expect(last?.darts).toHaveLength(1);
    expect(engine.state()).toMatchObject({
      activeParticipantRef: "p2",
      canStop: true,
    });
  });

  it("a dart after a stop opens a new turn, not the stopped one", () => {
    const engine = engineAfter([...OPENED, t(18), STOP, d(20)]);
    const turns = engine.facts().turns;
    expect(turns).toHaveLength(3);
    expect(turns[2]).toMatchObject({ participantRef: "p1" });
    expect(turns[2].darts).toHaveLength(1);
  });

  it("a spare dart off the board costs a life after a match", () => {
    const state = engineAfter([...OPENED, t(18), s(5), miss]).state();
    expect(seatB(state).lives).toBe(2);
    expect(state).toMatchObject({
      target: { number: 18, ring: "TREBLE" },
      leaderRef: "p1",
      keepAllowed: false,
    });
  });

  it("the last spare dart on the board sets the target; the matcher leads", () => {
    const state = engineAfter([...OPENED, t(18), s(5), d(20)]).state();
    expect(seatB(state).lives).toBe(3);
    expect(state).toMatchObject({
      target: { number: 20, ring: "DOUBLE" },
      leaderRef: "p2",
      activeParticipantRef: "p1",
      phase: "MATCH",
    });
  });

  it("a match on the third dart leaves no spare: leader unchanged, no loss", () => {
    const state = engineAfter([...OPENED, s(1), s(2), t(18)]).state();
    expect(seatB(state).lives).toBe(3);
    expect(state).toMatchObject({
      target: { number: 18, ring: "TREBLE" },
      leaderRef: "p1",
      activeParticipantRef: "p1",
      phase: "LEAD",
      keepAllowed: false,
    });
  });

  it("a spare dart in the target's own bed makes the matcher leader of it", () => {
    const state = engineAfter([...OPENED, t(18), t(18), STOP]).state();
    expect(state).toMatchObject({
      target: { number: 18, ring: "TREBLE" },
      leaderRef: "p2",
      activeParticipantRef: "p1",
      phase: "MATCH",
    });
  });

  it("an off-board leader dart is stored and the leader throws again", () => {
    const engine = engineAfter([...B_FAILED, miss]);
    expect(engine.state()).toMatchObject({
      activeParticipantRef: "p1",
      phase: "LEAD",
      target: { number: 18, ring: "TREBLE" },
      keepAllowed: false,
    });
    expect(engine.facts().turns.at(-1)?.completedAt).not.toBeNull();
    expect(engine.record(ib)).toMatchObject({
      target: { number: null, ring: "INNER_BULL" },
      activeParticipantRef: "p2",
    });
  });

  it("an outer bull does not match an inner bull target", () => {
    const state = engineAfter([ib, ob, ob, ob]).state();
    expect(seatB(state).lives).toBe(2);
  });

  it("keep is refused after a matcher matched, and allowed again after a full pass of fails", () => {
    const engine = engineAfter([...OPENED, t(18), STOP]);
    expect(() => engine.record(KEEP)).toThrow("Keep not allowed");
    engine.record(d(20));
    for (const observation of [miss, miss, miss]) engine.record(observation);
    expect(engine.state().keepAllowed).toBe(true);
  });

  it("stop is refused before a match and with no open visit", () => {
    expect(() => engineAfter(OPENED).record(STOP)).toThrow(
      "Stop needs a match first",
    );
    expect(() => engineAfter([...OPENED, s(1)]).record(STOP)).toThrow(
      "Stop needs a match first",
    );
    expect(() => new FollowTheLeaderEngine(config).record(STOP)).toThrow(
      "Stop needs a match first",
    );
  });

  describe("three lost matcher visits end the game", () => {
    const B_AT_ONE = [...B_FAILED, KEEP, miss, miss, miss, KEEP, miss, miss];

    it("completes with A the winner and the last turn closed", () => {
      const engine = engineAfter([...B_AT_ONE, miss]);
      const state = engine.state();
      expect(state).toMatchObject({
        status: "COMPLETE",
        winningSideKey: "A",
        outOrder: ["p2"],
        keepAllowed: false,
      });
      expect(seatB(state)).toMatchObject({ lives: 0, out: true });
      expect(engine.facts().turns.at(-1)?.completedAt).not.toBeNull();
      expect(engine.isComplete()).toBe(true);
      expect(() => engine.record(miss)).toThrow(/game has ended/);
      expect(() => engine.record(KEEP)).toThrow(/game has ended/);
      expect(() => engine.record(STOP)).toThrow(/game has ended/);
    });

    it("wouldComplete is true exactly on the closing dart", () => {
      const engine = engineAfter(B_AT_ONE);
      expect(engine.wouldComplete(miss)).toBe(true);
      expect(engine.wouldComplete(t(18))).toBe(false);
      expect(engine.wouldComplete(STOP)).toBe(false);
      expect(engineAfter([...B_FAILED, KEEP, miss]).wouldComplete(miss)).toBe(
        false,
      );
      expect(engineAfter(B_FAILED).wouldComplete(KEEP)).toBe(false);
      expect(engineAfter([...B_AT_ONE, miss]).wouldComplete(miss)).toBe(false);
    });

    it("wouldComplete is true for a stop whose last spare dart is off the board", () => {
      const engine = engineAfter([...B_FAILED, KEEP, miss, miss, miss, KEEP]);
      engine.record(t(18));
      engine.record(miss);
      expect(engine.wouldComplete(STOP)).toBe(true);
    });

    it("undo reopens the eliminating visit", () => {
      const engine = engineAfter([...B_AT_ONE, miss]);
      expect(engine.undo()).toBe(true);
      const state = engine.state();
      expect(state).toMatchObject({
        status: "IN_PROGRESS",
        winningSideKey: null,
        outOrder: [],
        activeParticipantRef: "p2",
      });
      expect(seatB(state).lives).toBe(1);
      const last = engine.facts().turns.at(-1);
      expect(last?.completedAt).toBeNull();
      expect(last?.darts).toHaveLength(2);
    });
  });

  it("writes NO_INTENT and the board score", () => {
    const [first] = engineAfter([t(18)]).facts().turns[0].darts;
    expect(first).toMatchObject({
      intendedTargetNumber: null,
      intendedZoneKey: null,
      score: 54,
    });
  });

  it("foldFollowTheLeaderState folds an empty log to the opening", () => {
    expect(foldFollowTheLeaderState({ stages: [], turns: [] }, config)).toEqual(
      {
        activeParticipantRef: "p1",
        status: "IN_PROGRESS",
        winningSideKey: null,
        outOrder: [],
        seats: [
          { participantRef: "p1", sideKey: "A", lives: 3, out: false },
          { participantRef: "p2", sideKey: "B", lives: 3, out: false },
        ],
        target: null,
        leaderRef: null,
        phase: "OPENING",
        matched: false,
        canStop: false,
        keepAllowed: false,
      },
    );
  });

  const GOLDEN: Input[] = [
    miss,
    t(18),
    s(18),
    s(18),
    s(18),
    KEEP,
    t(18),
    STOP,
    miss,
    d(20),
    d(20),
    s(5),
    STOP,
    s(1),
    s(2),
    s(5),
    t(20),
    t(20),
    s(1),
    miss,
    ib,
    ob,
    ob,
    ob,
    KEEP,
    miss,
    miss,
    miss,
  ];

  function inputLabel(input: Input): string {
    if ("kind" in input) return input.kind;
    if (input.hitZoneKey === "MISS") return "MISS";
    if (input.hitZoneKey === "OUTER_BULL") return "OB";
    if (input.hitZoneKey === "INNER_BULL") return "IB";
    const ring = { DOUBLE: "D", TREBLE: "T" }[input.hitZoneKey as string];
    return `${ring ?? "S"}${input.hitTargetNumber}`;
  }

  function bedLabel(bed: BedFact | null): string {
    if (bed === null) return "-";
    if (bed.ring === "OUTER_BULL") return "OB";
    if (bed.ring === "INNER_BULL") return "IB";
    return `${bed.ring[0]}${bed.number}`;
  }

  it("rehydration equals live state at every step of the golden game", () => {
    const engine = new FollowTheLeaderEngine(config);
    for (const input of GOLDEN) {
      engine.record(input);
      const rebuilt = followTheLeaderEngineFactory.create(
        config,
        engine.facts(),
      );
      expect(rebuilt.state()).toEqual(engine.state());
    }
  });

  it("golden: one full 2-seat game", () => {
    const engine = new FollowTheLeaderEngine(config);
    const lines = GOLDEN.map((input) => {
      const thrower = engine.state().activeParticipantRef;
      const state = engine.record(input);
      return `${thrower} ${inputLabel(input)} → target:${bedLabel(state.target)} lead:${state.leaderRef ?? "-"} A:${seatA(state).lives} B:${seatB(state).lives}`;
    });
    const end = engine.state();
    lines.push(
      `${end.status} winner=${end.winningSideKey} out=${end.outOrder.join(",")}`,
    );
    expect(lines).toMatchSnapshot();
  });
});

import { describe, it, expect } from "vitest";
import {
  applyOneTwentyOneVisit,
  OneTwentyOneEngine,
  oneTwentyOneEngineFactory,
  initialOneTwentyOneState,
} from "@modules/game/one-twenty-one.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import type { GameEngine } from "@modules/interfaces";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  OneTwentyOneSeatState,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
} from "@modules/types";
import type { OneTwentyOneSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config = () => ({ seats: SEATS }) satisfies Seated<OneTwentyOneSnapshot>;

type OneTwentyOneGameEngine = GameEngine<
  OneTwentyOneVisitInput,
  OneTwentyOneState
>;

/** Plays 3 clean overshoot busts at whatever target the engine is on. */
function bustAttempt(engine: OneTwentyOneGameEngine): OneTwentyOneState {
  engine.record({ scoreAttempted: 60 });
  engine.record({ scoreAttempted: 60 });
  return engine.record({ scoreAttempted: 60 });
}

describe("oneTwentyOneEngineFactory", () => {
  it("registers itself under 121_V1", () => {
    expect(oneTwentyOneEngineFactory.rulesetVersionKey).toBe("121_V1");
    expect(getEngineFactory("121_V1")).toBe(oneTwentyOneEngineFactory);
  });

  it("builds a OneTwentyOneEngine bound to the ruleset version", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(engine).toBeInstanceOf(OneTwentyOneEngine);
    expect(engine.rulesetVersionKey).toBe("121_V1");
  });
});

describe("initialOneTwentyOneState", () => {
  it("starts at 121 with a fresh budget", () => {
    const state = initialOneTwentyOneState(config());
    expect(state.activeParticipantRef).toBe("participant-1");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.winningSideKey).toBeNull();
    expect(state.seats[0]).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 121,
      remainingInAttempt: 121,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });
});

describe("applyOneTwentyOneVisit — legal reduction", () => {
  it("subtracts the visit score, stays in progress, and counts the visit", () => {
    const next = applyOneTwentyOneVisit(
      initialOneTwentyOneState(config()).seats[0],
      {
        scoreAttempted: 45,
      },
    );
    expect(next.remainingInAttempt).toBe(76);
    expect(next.currentTarget).toBe(121);
    expect(next.visitsThisAttempt).toBe(1);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("ignores a finish flag on a visit that does not reach zero", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 130,
      remainingInAttempt: 100,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 60,
      finishedOnDouble: true,
    });
    expect(next.remainingInAttempt).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("throws on a negative score", () => {
    expect(() =>
      applyOneTwentyOneVisit(initialOneTwentyOneState(config()).seats[0], {
        scoreAttempted: -1,
      }),
    ).toThrow(/0 and 180/);
  });

  it("throws above the 3-dart maximum of 180", () => {
    expect(() =>
      applyOneTwentyOneVisit(initialOneTwentyOneState(config()).seats[0], {
        scoreAttempted: 181,
      }),
    ).toThrow(/0 and 180/);
  });

  it("throws on a non-integer score", () => {
    expect(() =>
      applyOneTwentyOneVisit(initialOneTwentyOneState(config()).seats[0], {
        scoreAttempted: 60.5,
      }),
    ).toThrow(/0 and 180/);
  });
});

describe("applyOneTwentyOneVisit — bust matrix", () => {
  const at = (remainingInAttempt: number): OneTwentyOneSeatState => ({
    participantRef: "participant-1",
    sideKey: "A",
    currentTarget: 121,
    remainingInAttempt,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
  });

  it("busts on an overshoot and leaves the remaining score unchanged", () => {
    const next = applyOneTwentyOneVisit(at(40), { scoreAttempted: 50 });
    expect(next.remainingInAttempt).toBe(40);
    expect(next.visitsThisAttempt).toBe(1);
  });

  it("busts when the visit would leave exactly 1", () => {
    const next = applyOneTwentyOneVisit(at(41), { scoreAttempted: 40 });
    expect(next.remainingInAttempt).toBe(41);
  });

  it("treats a visit that would leave exactly 2 as a legal reduction", () => {
    const next = applyOneTwentyOneVisit(at(42), { scoreAttempted: 40 });
    expect(next.remainingInAttempt).toBe(2);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("busts when the visit reaches zero but no finish was declared", () => {
    const next = applyOneTwentyOneVisit(at(40), { scoreAttempted: 40 });
    expect(next.remainingInAttempt).toBe(40);
  });
});

describe("applyOneTwentyOneVisit — checkout climbs the ladder", () => {
  it("climbs the target by one and resets the budget on a sub-cap checkout", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 121,
      remainingInAttempt: 40,
      visitsThisAttempt: 1,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 40,
      finishedOnDouble: true,
    });
    expect(next).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 122,
      remainingInAttempt: 122,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });

  it("wins the session on a checkout at the cap target (170)", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 170,
      remainingInAttempt: 40,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 40,
      finishedOnDouble: true,
    });
    expect(next).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 170,
      remainingInAttempt: 0,
      visitsThisAttempt: 0,
      status: "WON",
    });
  });

  it("busts when the finishing dart was not a double, at any target", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 170,
      remainingInAttempt: 40,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 40,
      finishedOnDouble: false,
    });
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.currentTarget).toBe(170);
    expect(next.remainingInAttempt).toBe(40);
  });
});

describe("applyOneTwentyOneVisit — fail rule (v1: stay)", () => {
  it("resets the attempt at the same target after a 3rd-visit bust", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 130,
      remainingInAttempt: 30,
      visitsThisAttempt: 2,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, { scoreAttempted: 40 });
    expect(next).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 130,
      remainingInAttempt: 130,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });

  it("resets the attempt after a 3rd visit that scores but does not check out", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 130,
      remainingInAttempt: 50,
      visitsThisAttempt: 2,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, { scoreAttempted: 10 });
    expect(next).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 130,
      remainingInAttempt: 130,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });
});

describe("applyOneTwentyOneVisit — terminal state guard", () => {
  it("throws when called on a state that is already WON", () => {
    const wonState: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 170,
      remainingInAttempt: 0,
      visitsThisAttempt: 0,
      status: "WON",
    };
    expect(() =>
      applyOneTwentyOneVisit(wonState, { scoreAttempted: 20 }),
    ).toThrow();
  });
});

describe("OneTwentyOneEngine — record", () => {
  it("rejects an impossible visit score instead of inflating the total", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(() => engine.record({ scoreAttempted: -1 })).toThrow(/0 and 180/);
    expect(() => engine.record({ scoreAttempted: 181 })).toThrow(/0 and 180/);
    expect(engine.state().seats[0].remainingInAttempt).toBe(121);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("requires the finishing dart to be a double", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 81 });
    const busted = engine.record({
      scoreAttempted: 40,
      finishedOnDouble: false,
    });
    expect(busted.seats[0].status).toBe("IN_PROGRESS");
    expect(engine.state().seats[0].remainingInAttempt).toBe(40);
    expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);
  });

  it("climbs the ladder on checkout and opens a new ROUND stage", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 81 });
    const won = engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(won.seats[0].currentTarget).toBe(122);
    expect(engine.facts().stages).toHaveLength(2);
    expect(engine.facts().stages[1].stageTypeKey).toBe("ROUND");
  });

  it("opens a new ROUND stage after a fail-rule reset, at the same target", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    const after = bustAttempt(engine);
    expect(after.seats[0].currentTarget).toBe(121);
    expect(after.seats[0].remainingInAttempt).toBe(121);
    expect(engine.facts().stages).toHaveLength(2);
    expect(
      engine.facts().turns.filter((t) => t.stageClientKey === "round-1"),
    ).toHaveLength(3);
  });

  it("wins the whole session on a checkout at 170 and refuses further visits", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    const won = engine.record({ scoreAttempted: 170, finishedOnDouble: true });
    expect(won.status).toBe("WON");
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record({ scoreAttempted: 2 })).toThrow();
  });

  it("rehydrates mid-attempt from persisted facts", () => {
    const first = oneTwentyOneEngineFactory.create(config());
    first.record({ scoreAttempted: 60 });
    const resumed = oneTwentyOneEngineFactory.create(config(), first.facts());
    expect(resumed.state().seats[0].remainingInAttempt).toBe(61);
    expect(resumed.state().seats[0].visitsThisAttempt).toBe(1);
  });
});

describe("OneTwentyOneEngine.wouldComplete", () => {
  it("is true only for a checkout at the cap target", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    expect(
      engine.wouldComplete({ scoreAttempted: 170, finishedOnDouble: true }),
    ).toBe(true);
    expect(
      engine.wouldComplete({ scoreAttempted: 170, finishedOnDouble: false }),
    ).toBe(false);
  });

  it("is false for an ordinary scoring visit and for an already-complete session", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(engine.wouldComplete({ scoreAttempted: 60 })).toBe(false);

    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    engine.record({ scoreAttempted: 170, finishedOnDouble: true });
    expect(
      engine.wouldComplete({ scoreAttempted: 2, finishedOnDouble: true }),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    const factsBefore = engine.facts();
    const stateBefore = engine.state();
    engine.wouldComplete({ scoreAttempted: 121, finishedOnDouble: true });
    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("OneTwentyOneEngine.undo", () => {
  it("returns false when there is nothing to undo", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record over facts() for a visit inside an attempt", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 60 });
    const before = engine.facts();

    engine.record({ scoreAttempted: 20 });
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.state().seats[0].remainingInAttempt).toBe(61);
  });

  it("is an exact inverse for the visit that checked out and opened the next round", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 81 });
    const before = engine.facts();

    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(engine.facts().stages).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.state().seats[0]).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 121,
      remainingInAttempt: 40,
      visitsThisAttempt: 1,
      status: "IN_PROGRESS",
    });
  });

  it("is an exact inverse for the 3rd-visit fail-rule reset", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    const before = engine.facts();

    engine.record({ scoreAttempted: 60 });
    expect(engine.facts().stages).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.facts().stages).toHaveLength(1);
  });

  it("is an exact inverse for the visit that won the whole session", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    const before = engine.facts();

    engine.record({ scoreAttempted: 170, finishedOnDouble: true });
    expect(engine.isComplete()).toBe(true);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.isComplete()).toBe(false);
  });

  it("never emits a turn whose stage is missing, so the events batch builds", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 81 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    engine.record({ scoreAttempted: 60 });

    const batch = buildEventsBatch(engine.facts());
    expect(batch.stages).toHaveLength(2);
    expect(batch.stages[0].turns).toHaveLength(2);
    expect(batch.stages[1].turns).toHaveLength(1);
  });
});

describe("visual board capture", () => {
  /**
   * A located dart. The engine re-classifies from the coordinate, so the
   * claimed zone is never authoritative — but it is stated truthfully anyway.
   */
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: x,
    locationY: y,
  });

  const trebleTwenty = dartAt(0, -102, "TREBLE", 20);
  // Treble 19 (score 57) — lands cleanly in the treble ring at sector 19, per
  // this board's sector layout (`SECTOR_ORDER` in `board-geometry.module.ts`).
  // Used instead of a second/third `trebleTwenty` in these fixtures because
  // two T20s back to back leave a live remaining of exactly 1 (121 - 60 -
  // 60), which `settleVisit` correctly treats as an immediate bust — the
  // same rule `five-oh-one.engine.module.ts` already applies. That is real
  // dart-rule behaviour, not a bug, so these fixtures avoid triggering it
  // where the test means to show a still-open, not-yet-busted visit.
  const trebleNineteen = dartAt(-32, 98, "TREBLE", 19);
  const doubleTwenty = dartAt(0, -166, "DOUBLE", 20);

  it("deducts each dart from the remaining live total as it lands", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;

    engine.record(trebleTwenty);
    expect(engine.state().seats[0].remainingInAttempt).toBe(61);

    engine.record(trebleNineteen);
    expect(engine.state().seats[0].remainingInAttempt).toBe(4);
  });

  it("does not prematurely advance the visit counter while a visit is still open", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;

    engine.record(trebleTwenty);

    expect(engine.state().seats[0].visitsThisAttempt).toBe(0);
  });

  it("keeps dart rows with real scores when a visit busts", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;

    engine.record(trebleTwenty);
    engine.record(trebleNineteen);
    engine.record(trebleTwenty);

    const busted = engine.facts().turns.at(-1)!;
    expect(busted.totalScore).toBe(0);
    expect(busted.darts.map((dart) => dart.score)).toEqual([60, 57, 60]);
    expect(engine.state().seats[0].remainingInAttempt).toBe(121);
    expect(engine.state().seats[0].visitsThisAttempt).toBe(1);
  });

  it("checks out on a double and climbs the ladder", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    engine.record({ scoreAttempted: 41, finishedOnDouble: false });

    engine.record(doubleTwenty);
    engine.record(dartAt(0, -166, "DOUBLE", 20));

    expect(engine.state().seats[0]).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 122,
      remainingInAttempt: 122,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });

  it("wins the session on a checkout at the 170 cap target", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    expect(engine.state().seats[0].currentTarget).toBe(170);

    // Only a genuine DOUBLE dart checks a board visit out — matches
    // `five-oh-one.engine.module.ts`'s own `settleVisit`, which never treats
    // a bull hit as a double. A keypad visit first brings the remaining
    // total down to 80, then two D20 darts (40 + 40) finish it exactly.
    engine.record({ scoreAttempted: 90 });
    engine.record(doubleTwenty);
    engine.record(dartAt(0, -166, "DOUBLE", 20));

    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("WON");
  });

  it("leaves keypad behaviour unchanged", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;

    engine.record({ scoreAttempted: 60 });

    expect(engine.state().seats[0].remainingInAttempt).toBe(61);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(0);
  });
});

describe("OneTwentyOneEngine.wouldComplete — visual board", () => {
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: x,
    locationY: y,
  });

  it("is false for a dart that merely opens a visit", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    expect(engine.wouldComplete(dartAt(0, -102, "TREBLE", 20))).toBe(false);
  });

  it("is true for the checkout dart at the cap target", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    engine.record({ scoreAttempted: 90 });
    engine.record(dartAt(0, -166, "DOUBLE", 20));

    expect(engine.wouldComplete(dartAt(0, -166, "DOUBLE", 20))).toBe(true);
  });

  it("is false for the same checkout short of the cap target", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    expect(engine.wouldComplete(dartAt(0, -166, "DOUBLE", 20))).toBe(false);
  });

  it("does not mutate the fact log", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    const before = engine.facts();

    engine.wouldComplete(dartAt(0, -102, "TREBLE", 20));

    expect(engine.facts()).toEqual(before);
  });
});

describe("OneTwentyOneEngine.undo — dispatches on the fact log's shape", () => {
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: x,
    locationY: y,
  });

  it("undoes one dart at a time, reopening the visit", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    engine.record(dartAt(0, -102, "TREBLE", 20));
    engine.record(dartAt(0, -102, "TREBLE", 20));

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
    expect(engine.state().seats[0].remainingInAttempt).toBe(61);
  });

  it("removes the whole turn once its last dart is undone", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    engine.record(dartAt(0, -102, "TREBLE", 20));

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.state().seats[0].remainingInAttempt).toBe(121);
  });

  it("undoes a checkout that opened a new round, popping the round stage and reopening the checkout visit", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    engine.record({ scoreAttempted: 41, finishedOnDouble: false });
    engine.record(dartAt(0, -166, "DOUBLE", 20));
    engine.record(dartAt(0, -166, "DOUBLE", 20));
    expect(engine.facts().stages).toHaveLength(2);

    expect(engine.undo()).toBe(true);

    expect(engine.facts().stages).toHaveLength(1);
    const reopened = engine.facts().turns.at(-1)!;
    expect(reopened.darts).toHaveLength(1);
    expect(reopened.completedAt).toBeNull();
    expect(engine.state().seats[0].currentTarget).toBe(121);
  });

  it("a keypad-recorded turn still undoes as a whole visit, not a dart", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    engine.record({ scoreAttempted: 60 });

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(0);
  });
});

describe("121 checkout dart counts", () => {
  it("rejects a checkout claiming fewer darts than the route needs", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(() =>
      engine.record({
        scoreAttempted: 121,
        finishedOnDouble: true,
        dartsUsed: 2,
      }),
    ).toThrow(/at least 3 darts/);
  });

  it("accepts a checkout whose dart counts fit the route", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(() =>
      engine.record({
        scoreAttempted: 121,
        finishedOnDouble: true,
        dartsUsed: 3,
        dartsAtDouble: 1,
      }),
    ).not.toThrow();
  });
});

describe("OneTwentyOneEngine — 1v1", () => {
  const twoSeats = [
    {
      participantRef: "p1",
      displayName: "A",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
    {
      participantRef: "p2",
      displayName: "B",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];
  const twoSeatConfig: Seated<OneTwentyOneSnapshot> = { seats: twoSeats };

  it("alternates the active seat attempt by attempt", () => {
    const engine = new OneTwentyOneEngine(twoSeatConfig);
    expect(engine.state().activeParticipantRef).toBe("p1");
    engine.record({ scoreAttempted: 0 });
    expect(engine.state().activeParticipantRef).toBe("p2");
  });

  it("ends the match the instant one seat checks out at 170, the other seat never gets another turn", () => {
    const engine = new OneTwentyOneEngine(twoSeatConfig);
    // Climb p1 from 121 to 170 (49 climbs, one checkout per target), p2 idles at 0 every turn between.
    for (let target = 121; target < 170; target++) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true }); // p1 checks out
      engine.record({ scoreAttempted: 0 }); // p2 busts to keep its own target unchanged
    }
    const beforeFinal = engine.state();
    expect(beforeFinal.activeParticipantRef).toBe("p1");
    expect(beforeFinal.seats[0].currentTarget).toBe(170);

    const after = engine.record({
      scoreAttempted: 170,
      finishedOnDouble: true,
    });
    expect(after.seats[0].status).toBe("WON");
    expect(after.status).toBe("WON");
    expect(after.winningSideKey).toBe("A");
  });

  it("leaves a SOLO checkout at 170 with a null winningSideKey — there is no side to beat", () => {
    const engine = new OneTwentyOneEngine(config());
    for (let target = 121; target < 170; target++) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    const won = engine.record({ scoreAttempted: 170, finishedOnDouble: true });

    expect(won.status).toBe("WON");
    expect(won.seats[0].status).toBe("WON");
    expect(won.winningSideKey).toBeNull();
  });

  it("stamps every turn's participantRef with a seat present in seats[]", () => {
    const engine = new OneTwentyOneEngine(twoSeatConfig);
    engine.record({ scoreAttempted: 0 });
    engine.record({ scoreAttempted: 0 });
    const facts = engine.facts();
    for (const turn of facts.turns) {
      expect(
        twoSeats.some((seat) => seat.participantRef === turn.participantRef),
      ).toBe(true);
    }
  });

  it("rejects recording another visit for the trailing seat once the match has completed", () => {
    const engine = new OneTwentyOneEngine(twoSeatConfig);
    for (let target = 121; target < 170; target++) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
      engine.record({ scoreAttempted: 0 });
    }
    const won = engine.record({ scoreAttempted: 170, finishedOnDouble: true });
    expect(won.status).toBe("WON");
    expect(won.winningSideKey).toBe("A");
    expect(won.activeParticipantRef).toBe("p2");
    expect(won.seats[1].status).toBe("IN_PROGRESS");

    expect(() => engine.record({ scoreAttempted: 0 })).toThrow(/ended/);

    const after = engine.state();
    expect(after.status).toBe("WON");
    expect(after.winningSideKey).toBe("A");
  });

  it("wouldComplete is false for the trailing seat's own checkout dart once the match has completed", () => {
    // Facts constructed directly (bypassing record()) so the scenario holds
    // regardless of record()'s own guard: p1 has already checked out at 170
    // (match WON, A wins) while p2's climb — built the same way, one
    // checkout turn per rung — has independently also reached target 170
    // without yet checking out there. Evaluated in isolation, p2's next
    // checkout at 170 WOULD complete its own race; this is the exact shape
    // that must NOT read as "would complete the game" once the match is
    // already decided.
    const climbTurns = (participantRef: string, startSeq: number) =>
      Array.from({ length: 49 }, (_, i) => ({
        clientKey: `${participantRef}-climb-${i}`,
        stageClientKey: "round-1",
        participantRef,
        sequence: startSeq + i,
        completedAt: "2026-08-22T00:00:00.000Z",
        totalScore: 121 + i,
        darts: [],
      }));

    const prior: EngineFacts = {
      stages: [
        {
          clientKey: "round-1",
          stageTypeKey: "ROUND",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [
        ...climbTurns("p1", 1),
        {
          clientKey: "p1-win",
          stageClientKey: "round-1",
          participantRef: "p1",
          sequence: 50,
          completedAt: "2026-08-22T00:00:00.000Z",
          totalScore: 170,
          darts: [],
        },
        ...climbTurns("p2", 1),
      ],
    };

    const engine = new OneTwentyOneEngine(twoSeatConfig, prior);
    const state = engine.state();
    expect(state.status).toBe("WON");
    expect(state.winningSideKey).toBe("A");
    expect(state.activeParticipantRef).toBe("p2");
    const trailingSeat = state.seats.find((seat) => seat.sideKey === "B")!;
    expect(trailingSeat.status).toBe("IN_PROGRESS");
    expect(trailingSeat.currentTarget).toBe(170);

    expect(
      engine.wouldComplete({ scoreAttempted: 170, finishedOnDouble: true }),
    ).toBe(false);
  });
});

describe("121 board-dart resolution and undo", () => {
  it("keeps a coordinate-less dart's own zone and scores it 0", () => {
    const engine = new OneTwentyOneEngine(config());
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.hitTargetNumber).toBeNull();
    expect(dart.hitZoneKey).toBe("MISS");
    expect(dart.score).toBe(0);
    expect(dart.intendedZoneKey).toBeNull();
  });

  it("classifies a dart that carries coordinates and carries them onto the fact", () => {
    const engine = new OneTwentyOneEngine(config());
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: 0,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(25);
    expect(dart.hitZoneKey).toBe("INNER_BULL");
    expect(dart.score).toBe(50);
    expect(dart.locationY).toBe(0);
  });

  it("undo pops one dart at a time and takes the visit with the last one", () => {
    const engine = new OneTwentyOneEngine(config());
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: 0,
    });
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: 0,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toEqual([]);
    expect(engine.undo()).toBe(false);
  });
});

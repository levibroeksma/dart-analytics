import { describe, it, expect } from "vitest";
import {
  applyAroundTheClockDart,
  initialAroundTheClockState,
  isAroundTheClockHit,
  AroundTheClockEngine,
  aroundTheClockEngineFactory,
} from "@modules/game/around-the-clock.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  AroundTheClockSeatState,
  AroundTheClockState,
  DartObservation,
} from "@modules/types";
import type { AroundTheClockSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config: Seated<AroundTheClockSnapshot> = { seats: SEATS };

function numberHit(
  number: number,
  zone: "SINGLE" | "DOUBLE" | "TREBLE",
): DartObservation {
  return {
    hitTargetNumber: number,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  };
}

function miss(): DartObservation {
  return {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
}

function bullHit(zone: "OUTER_BULL" | "INNER_BULL"): DartObservation {
  return {
    hitTargetNumber: 25,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  };
}

describe("aroundTheClockEngineFactory", () => {
  it("registers itself under AROUND_THE_CLOCK_V1", () => {
    expect(aroundTheClockEngineFactory.rulesetVersionKey).toBe(
      "AROUND_THE_CLOCK_V1",
    );
    expect(getEngineFactory("AROUND_THE_CLOCK_V1")).toBe(
      aroundTheClockEngineFactory,
    );
  });

  it("builds an AroundTheClockEngine bound to the ruleset version", () => {
    const engine = aroundTheClockEngineFactory.create(config);
    expect(engine).toBeInstanceOf(AroundTheClockEngine);
    expect(engine.rulesetVersionKey).toBe("AROUND_THE_CLOCK_V1");
  });
});

describe("initialAroundTheClockState", () => {
  it("starts at target index 0 (number 1), no darts thrown, in progress", () => {
    const state = initialAroundTheClockState(config);
    expect(state.activeParticipantRef).toBe("participant-1");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.winningSideKey).toBeNull();
    expect(state.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        targetIndex: 0,
        dartsThisVisit: 0,
        status: "IN_PROGRESS",
      },
    ]);
  });
});

describe("a solo circuit, read through the engine's own state()", () => {
  it("completes with a null winningSideKey — there is no side to beat, and no caller folds outside the engine", () => {
    const engine = new AroundTheClockEngine(config);
    let state = engine.state();
    for (let number = 1; number <= 20; number += 1) {
      state = engine.record(numberHit(number, "SINGLE"));
    }
    state = engine.record(bullHit("OUTER_BULL"));

    expect(state.seats[0].status).toBe("COMPLETE");
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBeNull();
    expect(engine.isComplete()).toBe(true);
  });
});

describe("isAroundTheClockHit — NUMBER target", () => {
  const target = targetAt(numbersPath(), 0);

  it.each(["SINGLE", "DOUBLE", "TREBLE"] as const)(
    "accepts a %s on the matching number",
    (zone) => {
      expect(isAroundTheClockHit(target, numberHit(1, zone))).toBe(true);
    },
  );

  it("rejects a MISS", () => {
    expect(isAroundTheClockHit(target, miss())).toBe(false);
  });

  it("rejects a hit on the wrong number", () => {
    expect(isAroundTheClockHit(target, numberHit(2, "SINGLE"))).toBe(false);
  });
});

describe("isAroundTheClockHit — BULL target", () => {
  const target = targetAt(numbersPath(), 20);

  it("accepts OUTER_BULL", () => {
    expect(isAroundTheClockHit(target, bullHit("OUTER_BULL"))).toBe(true);
  });

  it("accepts INNER_BULL", () => {
    expect(isAroundTheClockHit(target, bullHit("INNER_BULL"))).toBe(true);
  });

  it("rejects a MISS", () => {
    expect(isAroundTheClockHit(target, miss())).toBe(false);
  });

  it("rejects a hit on a number (wrong target number)", () => {
    expect(isAroundTheClockHit(target, numberHit(20, "TREBLE"))).toBe(false);
  });
});

const SEAT: AroundTheClockSeatState = {
  participantRef: "participant-1",
  sideKey: "A",
  targetIndex: 0,
  dartsThisVisit: 0,
  status: "IN_PROGRESS",
};

describe("applyAroundTheClockDart — mid-visit advance", () => {
  it("advances the target immediately within one visit, clearing two numbers in three darts", () => {
    let state = { ...SEAT };
    state = applyAroundTheClockDart(state, numberHit(1, "SINGLE"));
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toBe(1);

    state = applyAroundTheClockDart(state, numberHit(2, "DOUBLE"));
    expect(state.targetIndex).toBe(2);
    expect(state.dartsThisVisit).toBe(2);

    state = applyAroundTheClockDart(state, miss());
    expect(state.targetIndex).toBe(2);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("closes the visit at 3 darts with no advance when every dart misses", () => {
    let state = { ...SEAT };
    state = applyAroundTheClockDart(state, miss());
    state = applyAroundTheClockDart(state, miss());
    state = applyAroundTheClockDart(state, miss());
    expect(state.targetIndex).toBe(0);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("applyAroundTheClockDart — BULL completion", () => {
  it.each([0, 1, 2])(
    "completes immediately on a BULL hit as dart index %i of the visit",
    (dartsThisVisit) => {
      const state: AroundTheClockSeatState = {
        ...SEAT,
        targetIndex: 20,
        dartsThisVisit,
      };
      const next = applyAroundTheClockDart(state, bullHit("INNER_BULL"));
      expect(next).toEqual({
        ...SEAT,
        targetIndex: 20,
        dartsThisVisit: 0,
        status: "COMPLETE",
      });
    },
  );

  it("does not complete on a BULL miss and keeps counting the visit", () => {
    const state: AroundTheClockSeatState = {
      ...SEAT,
      targetIndex: 20,
      dartsThisVisit: 0,
    };
    const next = applyAroundTheClockDart(state, miss());
    expect(next).toEqual({
      ...SEAT,
      targetIndex: 20,
      dartsThisVisit: 1,
    });
  });
});

describe("applyAroundTheClockDart — terminal state guard", () => {
  it("throws when called on a COMPLETE state", () => {
    const terminal: AroundTheClockSeatState = {
      ...SEAT,
      targetIndex: 20,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
    expect(() => applyAroundTheClockDart(terminal, miss())).toThrow();
  });
});

describe("AroundTheClockEngine — fact log and derived state", () => {
  it("stores the real board score and null intention on every dart", () => {
    const engine = aroundTheClockEngineFactory.create(config);
    engine.record(numberHit(1, "TREBLE"));

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.score).toBe(3);
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
    expect(engine.state().seats[0].targetIndex).toBe(1);
  });

  it("keeps all three darts of a mid-visit-advance turn in one TurnFact", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    engine.record(numberHit(2, "DOUBLE"));
    engine.record(miss());

    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(3);
    expect(engine.state().seats[0].targetIndex).toBe(2);
  });

  it("stamps completedAt early when a BULL hit ends the session on the visit's 1st dart", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.state().seats[0].targetIndex).toBe(20);

    engine.record(bullHit("OUTER_BULL"));

    const lastTurn = engine.facts().turns.at(-1);
    expect(lastTurn?.darts).toHaveLength(1);
    expect(lastTurn?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(engine.isComplete()).toBe(true);
  });

  it("leaves completedAt null on an open visit that has not resolved", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(miss());
    expect(engine.facts().turns[0].completedAt).toBeNull();
  });

  it("rehydrates target index and completion from persisted facts", () => {
    const first = aroundTheClockEngineFactory.create(config);
    first.record(numberHit(1, "SINGLE"));
    first.record(numberHit(2, "SINGLE"));

    const resumed = aroundTheClockEngineFactory.create(config, first.facts());
    expect(resumed.state().seats[0].targetIndex).toBe(2);
    expect(resumed.state().seats[0].status).toBe("IN_PROGRESS");
  });
});

describe("AroundTheClockEngine.wouldComplete", () => {
  it("is true for a BULL hit on any dart of the visit, not only the 3rd", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.state().seats[0].targetIndex).toBe(20);
    expect(engine.wouldComplete(bullHit("INNER_BULL"))).toBe(true);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");
  });

  it("is false for a BULL miss", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.wouldComplete(miss())).toBe(false);
  });

  it("is false once the session has already ended", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    engine.record(bullHit("OUTER_BULL"));
    expect(engine.state().seats[0].status).toBe("COMPLETE");
    expect(engine.wouldComplete(bullHit("INNER_BULL"))).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    engine.wouldComplete(numberHit(2, "SINGLE"));

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("AroundTheClockEngine.undo", () => {
  it("returns false when there is no history", () => {
    const engine = new AroundTheClockEngine(config);
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record() when it extended the open visit", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    const before = engine.facts();
    engine.record(numberHit(2, "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("reopens a visit that closed early via a BULL completion, removing the 1-dart turn entirely", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    const turnsBeforeBull = engine.facts().turns.length;
    engine.record(bullHit("OUTER_BULL"));
    expect(engine.state().seats[0].status).toBe("COMPLETE");

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].targetIndex).toBe(20);
    expect(engine.facts().turns).toHaveLength(turnsBeforeBull);
  });

  it("walks back across a two-advance turn one dart at a time", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    engine.record(numberHit(2, "DOUBLE"));
    engine.record(miss());
    expect(engine.state().seats[0].targetIndex).toBe(2);

    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].targetIndex).toBe(2);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].targetIndex).toBe(1);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].targetIndex).toBe(0);
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = aroundTheClockEngineFactory.create(config);
    first.record(numberHit(1, "SINGLE"));

    const resumed = aroundTheClockEngineFactory.create(config, first.facts());
    resumed.record(numberHit(2, "SINGLE"));
    expect(resumed.state().seats[0].targetIndex).toBe(2);

    expect(resumed.undo()).toBe(true);
    expect(resumed.state().seats[0].targetIndex).toBe(1);
  });
});

describe("AroundTheClockEngine — 1v1", () => {
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
  const twoSeatConfig: Seated<AroundTheClockSnapshot> = { seats: twoSeats };

  function missDart(): DartObservation {
    return {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
  }

  /**
   * The observation that hits whatever `seat`'s own current target is (BULL
   * once its 20 numbers are cleared). `record()` always applies to whichever
   * seat the engine itself reports active — turns alternate every visit
   * exactly like every other PER_SEAT engine (Bob's 27, 121) until a seat
   * completes and `activeSeat`'s completion predicate hands every remaining
   * turn to the other — so driving two real seats through their own
   * circuits means asking each one, at the moment it is actually active,
   * what its own next target is, never assuming a fixed call order.
   */
  function targetHit(seat: AroundTheClockSeatState): DartObservation {
    return seat.targetIndex === 20
      ? {
          hitTargetNumber: 25,
          hitZoneKey: "INNER_BULL",
          locationX: null,
          locationY: null,
        }
      : {
          hitTargetNumber: seat.targetIndex + 1,
          hitZoneKey: "SINGLE",
          locationX: null,
          locationY: null,
        };
  }

  /**
   * Plays real darts against whichever seat the engine reports active,
   * always hitting that seat's own current target unless `miss` says this
   * particular dart should miss instead, until the match itself is no
   * longer IN_PROGRESS. Returns every state produced along the way so a
   * test can inspect the moment either seat finished, not only the outcome.
   */
  function playUntilDecided(
    engine: AroundTheClockEngine,
    miss: (seat: AroundTheClockSeatState) => boolean = () => false,
  ): AroundTheClockState[] {
    const history: AroundTheClockState[] = [];
    let state = engine.state();
    while (state.status === "IN_PROGRESS") {
      const activeSeat = state.seats.find(
        (seat) => seat.participantRef === state.activeParticipantRef,
      )!;
      state = engine.record(
        miss(activeSeat) ? missDart() : targetHit(activeSeat),
      );
      history.push(state);
    }
    return history;
  }

  it("alternates the active seat turn by turn while both are still in progress", () => {
    const engine = new AroundTheClockEngine(twoSeatConfig);
    expect(engine.state().activeParticipantRef).toBe("p1");
    engine.record(missDart());
    engine.record(missDart());
    engine.record(missDart());
    expect(engine.state().activeParticipantRef).toBe("p2");
  });

  it("keeps handing turns to a seat that has not finished once the other has", () => {
    const engine = new AroundTheClockEngine(twoSeatConfig);
    // Both seats hit everything (0 misses); p1 always throws turn 1, so its
    // own circuit's final turn always lands strictly before p2's — the
    // match must stay IN_PROGRESS with p2 active for at least one turn.
    const history = playUntilDecided(engine);
    const p1CompletedIndex = history.findIndex(
      (state) => state.seats[0].status === "COMPLETE",
    );
    expect(p1CompletedIndex).toBeGreaterThanOrEqual(0);
    const rightAfterP1Completed = history[p1CompletedIndex];
    expect(rightAfterP1Completed.status).toBe("IN_PROGRESS");
    expect(rightAfterP1Completed.activeParticipantRef).toBe("p2");

    const final = history.at(-1)!;
    expect(final.seats[1].status).toBe("COMPLETE");
    expect(final.status).not.toBe("IN_PROGRESS");
  });

  it("the seat with fewer darts to complete wins on a score-compare basis", () => {
    const engine = new AroundTheClockEngine(twoSeatConfig);
    // p2 misses its very first target twice (2 extra darts); p1 plays
    // flawlessly, so p1 finishes in fewer total darts.
    let p2Misses = 0;
    const history = playUntilDecided(engine, (seat) => {
      if (seat.participantRef !== "p2" || seat.targetIndex !== 0) return false;
      if (p2Misses >= 2) return false;
      p2Misses += 1;
      return true;
    });
    const state = history.at(-1)!;
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");

    // The exact metric scoreCompareWinner decided on: p1 needed its usual 21
    // darts (20 hits + BULL, 0 misses); p2 needed 23 (2 extra misses).
    const dartsThrownBy = (participantRef: string) =>
      engine
        .facts()
        .turns.filter((turn) => turn.participantRef === participantRef)
        .reduce((sum, turn) => sum + turn.darts.length, 0);
    expect(dartsThrownBy("p1")).toBe(21);
    expect(dartsThrownBy("p2")).toBe(23);
  });

  it("ties when both seats finish in the same number of darts", () => {
    const engine = new AroundTheClockEngine(twoSeatConfig);
    const history = playUntilDecided(engine);
    const state = history.at(-1)!;
    expect(state.status).toBe("TIE");
    expect(state.winningSideKey).toBeNull();
  });

  it("does not misattribute the next seat's dart onto a stale short-closed turn of the seat that just completed", () => {
    // p1 misses its very first target once, so its own circuit needs 22
    // darts (1 miss + 20 hits + 1 BULL) — not a multiple of 3 — so p1's
    // completing BULL lands as the very FIRST dart of an otherwise-fresh 8th
    // turn: a short-closed (1-dart) turn. p2 misses its first target twice,
    // so by the time p1's 8th own turn happens, p2 has only had 7 own turns
    // (21 darts) and sits mid-circuit at target 20 (number 20 still
    // unhit) — still IN_PROGRESS, not about to complete on its next dart.
    const engine = new AroundTheClockEngine(twoSeatConfig);
    let p1Misses = 0;
    let p2Misses = 0;
    let state = engine.state();
    while (state.seats[0].status === "IN_PROGRESS") {
      const activeSeat = state.seats.find(
        (seat) => seat.participantRef === state.activeParticipantRef,
      )!;
      const shouldMiss =
        activeSeat.targetIndex === 0 &&
        (activeSeat.participantRef === "p1" ? p1Misses < 1 : p2Misses < 2);
      if (shouldMiss) {
        activeSeat.participantRef === "p1" ? (p1Misses += 1) : (p2Misses += 1);
      }
      state = engine.record(shouldMiss ? missDart() : targetHit(activeSeat));
    }

    expect(state.seats[0].status).toBe("COMPLETE");
    expect(state.seats[1].status).toBe("IN_PROGRESS");
    expect(state.seats[1].targetIndex).toBe(19);
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.activeParticipantRef).toBe("p2");
    const p1LastTurn = engine.facts().turns.at(-1)!;
    expect(p1LastTurn.participantRef).toBe("p1");
    expect(p1LastTurn.darts).toHaveLength(1);

    // p2's very next dart must open its OWN fresh turn, not append onto
    // p1's already-closed, already-COMPLETE 1-dart turn.
    const p2SeatBefore = state.seats[1];
    const after = engine.record(targetHit(p2SeatBefore));
    const p2Turn = engine.facts().turns.at(-1)!;
    expect(p2Turn.participantRef).toBe("p2");
    expect(p2Turn.darts).toHaveLength(1);
    expect(after.seats[1].targetIndex).toBe(20);
    expect(after.seats[0].status).toBe("COMPLETE");
    expect(after.status).toBe("IN_PROGRESS");

    // undo() must revert only p2's own dart (its own fresh turn), leaving
    // p1's already-closed 1-dart completing turn — a different seat's
    // turn entirely — untouched.
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.at(-1)!.participantRef).toBe("p1");
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(1);
    const reverted = engine.state();
    expect(reverted.seats[0].status).toBe("COMPLETE");
    expect(reverted.seats[1].targetIndex).toBe(19);
    expect(reverted.seats[1].status).toBe("IN_PROGRESS");
    expect(reverted.activeParticipantRef).toBe("p2");
  });

  it("rejects recording another dart once both seats have completed", () => {
    const engine = new AroundTheClockEngine(twoSeatConfig);
    const history = playUntilDecided(engine);
    const state = history.at(-1)!;
    expect(state.status).not.toBe("IN_PROGRESS");
    expect(state.seats[0].status).toBe("COMPLETE");
    expect(state.seats[1].status).toBe("COMPLETE");

    expect(() => engine.record(missDart())).toThrow(/ended/);
    expect(engine.wouldComplete(missDart())).toBe(false);

    const after = engine.state();
    expect(after.status).toBe(state.status);
    expect(after.winningSideKey).toBe(state.winningSideKey);
  });
});

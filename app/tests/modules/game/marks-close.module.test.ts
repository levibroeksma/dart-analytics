import { describe, expect, it } from "vitest";
import {
  applyMarksDart,
  effectiveMarks,
  initialMarksSeat,
  marksPerRound,
  recordMarksDart,
} from "@modules/game/marks-close.module";
import type {
  DartObservation,
  MarksSeatState,
  MultiSeatState,
  TurnFact,
} from "@modules/types";

const seat = { participantRef: "p1", sideKey: "A" };

describe("initialMarksSeat", () => {
  it("starts n objectives at zero marks and open", () => {
    const state = initialMarksSeat(seat, 4);
    expect(state.marks).toEqual([0, 0, 0, 0]);
    expect(state.closedAtDart).toEqual([null, null, null, null]);
    expect(state.dartsThrown).toBe(0);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("applyMarksDart", () => {
  it("counts a null hit as a thrown dart only", () => {
    const next = applyMarksDart(initialMarksSeat(seat, 2), null);
    expect(next.marks).toEqual([0, 0]);
    expect(next.dartsThrown).toBe(1);
    expect(next.dartsThisVisit).toBe(1);
  });

  it("adds marks to the hit objective", () => {
    const next = applyMarksDart(initialMarksSeat(seat, 2), {
      objectiveIndex: 1,
      marks: 2,
    });
    expect(next.marks).toEqual([0, 2]);
  });

  it("caps at 3 and stamps closedAtDart on the closing dart", () => {
    let state = applyMarksDart(initialMarksSeat(seat, 2), {
      objectiveIndex: 0,
      marks: 2,
    });
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 2 });
    expect(state.marks[0]).toBe(3);
    expect(state.closedAtDart).toEqual([2, null]);
  });

  it("adds nothing to a closed objective", () => {
    let state = applyMarksDart(initialMarksSeat(seat, 2), {
      objectiveIndex: 0,
      marks: 3,
    });
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 3 });
    expect(state.marks[0]).toBe(3);
    expect(state.closedAtDart[0]).toBe(1);
    expect(state.dartsThrown).toBe(2);
  });

  it("completes on the last close and resets the visit counter", () => {
    let state = applyMarksDart(initialMarksSeat(seat, 2), {
      objectiveIndex: 0,
      marks: 3,
    });
    state = applyMarksDart(state, { objectiveIndex: 1, marks: 3 });
    expect(state.status).toBe("COMPLETE");
    expect(state.dartsThisVisit).toBe(0);
  });

  it("resets the visit counter after 3 darts", () => {
    let state = initialMarksSeat(seat, 2);
    for (let dart = 0; dart < 2; dart += 1) {
      state = applyMarksDart(state, null);
    }
    expect(state.dartsThisVisit).toBe(2);
    state = applyMarksDart(state, null);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.dartsThrown).toBe(3);
  });

  it("throws once the seat is complete", () => {
    const done = applyMarksDart(initialMarksSeat(seat, 1), {
      objectiveIndex: 0,
      marks: 3,
    });
    expect(() => applyMarksDart(done, null)).toThrow(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
  });
});

describe("effectiveMarks and marksPerRound", () => {
  it("sums marks after the cap", () => {
    let state = applyMarksDart(initialMarksSeat(seat, 3), {
      objectiveIndex: 0,
      marks: 3,
    });
    state = applyMarksDart(state, { objectiveIndex: 1, marks: 2 });
    expect(effectiveMarks(state)).toBe(5);
  });

  it("is 0 MPR before any dart", () => {
    expect(marksPerRound(initialMarksSeat(seat, 3))).toBe(0);
  });

  it("is marks over darts times 3", () => {
    let state = applyMarksDart(initialMarksSeat(seat, 3), {
      objectiveIndex: 0,
      marks: 3,
    });
    state = applyMarksDart(state, null);
    expect(marksPerRound(state)).toBe(4.5);
  });
});

describe("hit tallies", () => {
  it("start at zero", () => {
    const state = initialMarksSeat(seat, 3);
    expect(state.objectiveHits).toEqual([0, 0, 0]);
    expect(state.trebleHits).toBe(0);
  });

  it("count every hit per objective, even after it closed", () => {
    let state = initialMarksSeat(seat, 2);
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 3 });
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 1 });
    state = applyMarksDart(state, null);
    expect(state.objectiveHits).toEqual([2, 0]);
  });

  it("count 3-mark hits as trebles, even after the target closed", () => {
    let state = initialMarksSeat(seat, 2);
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 3 });
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 3 });
    state = applyMarksDart(state, { objectiveIndex: 1, marks: 2 });
    expect(state.trebleHits).toBe(2);
  });
});

describe("recordMarksDart", () => {
  const STAGE_KEY = "block-1";
  const miss: DartObservation = {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
  const bull: DartObservation = {
    hitTargetNumber: 25,
    hitZoneKey: "INNER_BULL",
    locationX: null,
    locationY: null,
  };

  /** One seat that completes on its first inner bull. */
  function deriveFrom(turns: TurnFact[]): () => MultiSeatState<MarksSeatState> {
    return () => {
      const darts = turns.flatMap((turn) => turn.darts);
      const done = darts.some((dart) => dart.hitZoneKey === "INNER_BULL");
      return {
        activeParticipantRef: seat.participantRef,
        seats: [
          {
            ...initialMarksSeat(seat, 1),
            status: done ? "COMPLETE" : "IN_PROGRESS",
          },
        ],
      };
    };
  }

  it("opens a visit on the first dart, left open", () => {
    const turns: TurnFact[] = [];
    recordMarksDart(turns, STAGE_KEY, miss, deriveFrom(turns));
    expect(turns).toHaveLength(1);
    expect(turns[0].stageClientKey).toBe(STAGE_KEY);
    expect(turns[0].participantRef).toBe(seat.participantRef);
    expect(turns[0].darts).toHaveLength(1);
    expect(turns[0].completedAt).toBeNull();
  });

  it("closes the visit on dart 3 and opens a new one on dart 4", () => {
    const turns: TurnFact[] = [];
    const derive = deriveFrom(turns);
    for (let i = 0; i < 3; i++) recordMarksDart(turns, STAGE_KEY, miss, derive);
    expect(turns).toHaveLength(1);
    expect(turns[0].completedAt).not.toBeNull();
    recordMarksDart(turns, STAGE_KEY, miss, derive);
    expect(turns).toHaveLength(2);
    expect(turns[1].darts).toHaveLength(1);
  });

  it("closes the visit early on the completing dart", () => {
    const turns: TurnFact[] = [];
    const state = recordMarksDart(turns, STAGE_KEY, bull, deriveFrom(turns));
    expect(turns[0].darts).toHaveLength(1);
    expect(turns[0].completedAt).not.toBeNull();
    expect(state.seats[0].status).toBe("COMPLETE");
  });

  it("refuses once the seat is complete and leaves the turns alone", () => {
    const turns: TurnFact[] = [];
    const derive = deriveFrom(turns);
    recordMarksDart(turns, STAGE_KEY, bull, derive);
    const snapshot = structuredClone(turns);
    expect(() => recordMarksDart(turns, STAGE_KEY, miss, derive)).toThrow(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
    expect(turns).toEqual(snapshot);
  });
});

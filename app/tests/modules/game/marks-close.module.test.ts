import { describe, expect, it } from "vitest";
import {
  applyMarksDart,
  effectiveMarks,
  initialMarksSeat,
  marksPerRound,
} from "@modules/game/marks-close.module";

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
    expect(() => applyMarksDart(done, null)).toThrow(/undo first/);
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

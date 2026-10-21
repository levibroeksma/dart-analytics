import { describe, it, expect } from "vitest";
import {
  applyTrackDart,
  foldTrackDarts,
  foldTrackSeats,
  initialTrackSeat,
} from "@modules/game/track-kernel.module";
import { isHitOn } from "@modules/game/board-progression.module";
import { boardScorePoints } from "@modules/game/track-policies";
import type { TrackRules } from "@modules/interfaces";
import type {
  DartObservation,
  TrackSeat,
  TrackTarget,
  TurnFact,
} from "@modules/types";

type Ext = { closed: number[] };

const SEAT = {
  participantRef: "p1",
  displayName: "P1",
  sideKey: "A",
  participantTypeKey: "PLAYER" as const,
};
const hitOn = (n: number): DartObservation => ({
  hitTargetNumber: n,
  hitZoneKey: "OUTER_SINGLE",
  locationX: null,
  locationY: null,
});
const MISS: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

/** Toy ruleset: numbers 1..3, 1 point per hit, 3-dart visits, advance per visit, log of hits per closed visit. */
const toy: TrackRules<Ext> = {
  doneMessage: "done",
  target: (seat) => ({ kind: "NUMBER", number: seat.targetIndex + 1 }),
  hit: isHitOn,
  points: (_target, _observation, hit) => (hit ? 1 : 0),
  visitOpen: (seat) => seat.dartsThisVisit < 3,
  onVisitClose: (seat) => ({
    ...seat,
    targetIndex: seat.targetIndex + 1,
    status: seat.targetIndex === 2 ? "DONE" : seat.status,
    ext: { closed: [...seat.ext.closed, seat.hitsThisVisit] },
  }),
};
const fresh = (): TrackSeat<Ext> => initialTrackSeat(SEAT, { closed: [] });

describe("track kernel", () => {
  it("initialTrackSeat starts at index 0, zero counters, IN_PROGRESS", () => {
    expect(fresh()).toEqual({
      participantRef: "p1",
      sideKey: "A",
      targetIndex: 0,
      score: 0,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "IN_PROGRESS",
      ext: { closed: [] },
    });
  });

  it("judges a dart: points into score, counters up, visit still open", () => {
    const seat = applyTrackDart(fresh(), hitOn(1), toy);
    expect(seat).toMatchObject({
      score: 1,
      dartsThisVisit: 1,
      hitsThisVisit: 1,
      targetIndex: 0,
    });
  });

  it("closes the visit when visitOpen turns false: onVisitClose sees the counters, then they reset", () => {
    let seat = fresh();
    for (const observation of [hitOn(1), MISS, hitOn(1)])
      seat = applyTrackDart(seat, observation, toy);
    expect(seat).toMatchObject({
      targetIndex: 1,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      score: 2,
      ext: { closed: [2] },
    });
  });

  it("onDart runs before visitOpen is read and sees the judged dart", () => {
    const seen: [number, boolean][] = [];
    const rules: TrackRules<Ext> = {
      ...toy,
      onDart: (seat, dart) => {
        seen.push([seat.dartsThisVisit, dart.hit]);
        return seat;
      },
    };
    applyTrackDart(fresh(), MISS, rules);
    applyTrackDart(fresh(), hitOn(1), rules);
    expect(seen).toEqual([
      [1, false],
      [1, true],
    ]);
  });

  it("a visit closed by onDart's state change resets counters after onVisitClose", () => {
    const rules: TrackRules<Ext> = {
      ...toy,
      onDart: (seat, dart) =>
        dart.hit ? { ...seat, dartsThisVisit: 3 } : seat,
    };
    expect(applyTrackDart(fresh(), hitOn(1), rules)).toMatchObject({
      targetIndex: 1,
      dartsThisVisit: 0,
      ext: { closed: [1] },
    });
  });

  it("without onVisitClose the counters still reset at the visit boundary", () => {
    const { onVisitClose: _drop, ...rest } = toy;
    let seat = fresh();
    for (const observation of [MISS, MISS, MISS])
      seat = applyTrackDart(seat, observation, rest);
    expect(seat).toMatchObject({ targetIndex: 0, dartsThisVisit: 0 });
  });

  it("throws doneMessage on a seat that is not IN_PROGRESS", () => {
    expect(() =>
      applyTrackDart({ ...fresh(), status: "DONE" }, MISS, toy),
    ).toThrow("done");
    expect(() =>
      applyTrackDart({ ...fresh(), status: "OUT" }, MISS, toy),
    ).toThrow("done");
  });

  it("foldTrackSeats folds each seat only over its own turns", () => {
    const turn = (participantRef: string, darts: DartObservation[]) =>
      ({ participantRef, darts }) as unknown as TurnFact;
    const seats = foldTrackSeats(
      [turn("p1", [hitOn(1), MISS, MISS]), turn("p2", [MISS])],
      [SEAT, { ...SEAT, participantRef: "p2", sideKey: "B" }],
      () => ({ closed: [] }),
      toy,
    );
    expect(seats.map((s) => [s.targetIndex, s.dartsThisVisit])).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it("initialTrackSeat takes an optional starting score", () => {
    expect(initialTrackSeat(SEAT, { closed: [] }, 27).score).toBe(27);
  });

  it("foldTrackSeats starts each seat at rules.startScore", () => {
    const turn = (participantRef: string, darts: DartObservation[]) =>
      ({ participantRef, darts }) as unknown as TurnFact;
    const [seat] = foldTrackSeats(
      [turn("p1", [hitOn(1), MISS])],
      [SEAT],
      () => ({ closed: [] }),
      { ...toy, startScore: 27 },
    );
    expect(seat.score).toBe(28);
  });

  it("foldTrackDarts folds every dart in write order from one seat", () => {
    const turn = (darts: DartObservation[]) =>
      ({ participantRef: "solo", darts }) as unknown as TurnFact;
    const seat = foldTrackDarts(
      [turn([hitOn(1), MISS, hitOn(1)]), turn([hitOn(2)])],
      fresh(),
      toy,
    );
    expect(seat).toMatchObject({
      targetIndex: 1,
      score: 3,
      dartsThisVisit: 1,
      hitsThisVisit: 1,
      ext: { closed: [2] },
    });
  });

  it("foldTrackDarts with no darts returns the initial seat", () => {
    const initial = fresh();
    expect(foldTrackDarts([], initial, toy)).toBe(initial);
  });

  it("initialTrackSeat takes a bare seat state", () => {
    expect(
      initialTrackSeat({ participantRef: "solo", sideKey: "solo" }, null),
    ).toMatchObject({ participantRef: "solo", sideKey: "solo" });
  });
});

describe("applyTrackDart on a zone path", () => {
  it("judges the dart with the ruleset's hit and passes the zone target to onDart", () => {
    const seen: TrackTarget[] = [];
    const rules: TrackRules<null, TrackTarget> = {
      doneMessage: "done",
      target: () => ({ kind: "ANY_DOUBLE" }),
      hit: isHitOn,
      points: boardScorePoints,
      onDart: (seat, dart) => {
        seen.push(dart.target);
        return seat;
      },
      visitOpen: () => true,
    };
    const seat = applyTrackDart(
      initialTrackSeat({ participantRef: "p", sideKey: "A" }, null),
      {
        hitTargetNumber: 25,
        hitZoneKey: "INNER_BULL",
        locationX: null,
        locationY: null,
      },
      rules,
    );
    expect(seat.score).toBe(50);
    expect(seat.hitsThisVisit).toBe(1);
    expect(seen).toEqual([{ kind: "ANY_DOUBLE" }]);
  });
});

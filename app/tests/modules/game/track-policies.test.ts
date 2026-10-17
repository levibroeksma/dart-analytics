import { describe, it, expect } from "vitest";
import {
  advanceToEnd,
  anyRingEitherBull,
  closeAfter,
  closeOnHitOrAfter,
  noPoints,
  outAtOrBelowZero,
  outBelowHits,
  pathTarget,
  penaltyOnBlank,
  pointsTable,
} from "@modules/game/track-policies";
import { initialTrackSeat } from "@modules/game/track-kernel.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import type { DartObservation, DartZoneKey, TrackSeat } from "@modules/types";

const SEAT = {
  participantRef: "p1",
  displayName: "P1",
  sideKey: "A",
  participantTypeKey: "PLAYER" as const,
};
const seat = (over: Partial<TrackSeat<null>> = {}): TrackSeat<null> => ({
  ...initialTrackSeat(SEAT, null),
  ...over,
});

describe("track policies", () => {
  it("pathTarget reads the path at targetIndex", () => {
    const path = doublesPath();
    expect(pathTarget(path)(seat({ targetIndex: 4 }))).toEqual(
      targetAt(path, 4),
    );
  });

  it("noPoints is always 0", () => {
    expect(noPoints()).toBe(0);
  });

  it("closeOnHitOrAfter(3): open until a hit or the third dart", () => {
    const open = closeOnHitOrAfter(3);
    expect(open(seat({ dartsThisVisit: 2, hitsThisVisit: 0 }))).toBe(true);
    expect(open(seat({ dartsThisVisit: 1, hitsThisVisit: 1 }))).toBe(false);
    expect(open(seat({ dartsThisVisit: 3, hitsThisVisit: 0 }))).toBe(false);
  });

  it("advanceToEnd(20): next target, or DONE in place at the last index", () => {
    const advance = advanceToEnd(20);
    expect(advance(seat({ targetIndex: 5 }))).toMatchObject({
      targetIndex: 6,
      status: "IN_PROGRESS",
    });
    expect(advance(seat({ targetIndex: 20 }))).toMatchObject({
      targetIndex: 20,
      status: "DONE",
    });
  });

  it("closeAfter(3): open until the third dart, hits or not", () => {
    const open = closeAfter(3);
    expect(open(seat({ dartsThisVisit: 2, hitsThisVisit: 2 }))).toBe(true);
    expect(open(seat({ dartsThisVisit: 3, hitsThisVisit: 0 }))).toBe(false);
  });

  it("penaltyOnBlank subtracts the penalty only when the visit hit nothing", () => {
    const penalise = penaltyOnBlank<null>((s) => s.targetIndex * 10);
    expect(
      penalise(seat({ score: 50, targetIndex: 2, hitsThisVisit: 0 })).score,
    ).toBe(30);
    expect(
      penalise(seat({ score: 50, targetIndex: 2, hitsThisVisit: 1 })).score,
    ).toBe(50);
  });

  it("outAtOrBelowZero: OUT at 0 or below, untouched above", () => {
    expect(outAtOrBelowZero(seat({ score: 0 })).status).toBe("OUT");
    expect(outAtOrBelowZero(seat({ score: -4 })).status).toBe("OUT");
    expect(outAtOrBelowZero(seat({ score: 1 })).status).toBe("IN_PROGRESS");
  });

  const on = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });
  const FIVE = { kind: "NUMBER", number: 5 } as const;
  const BULL = { kind: "BULL" } as const;

  it("anyRingEitherBull: any ring on the number, either bull on BULL", () => {
    for (const zone of [
      "SINGLE",
      "INNER_SINGLE",
      "OUTER_SINGLE",
      "DOUBLE",
      "TREBLE",
    ] as const)
      expect(anyRingEitherBull(FIVE, on(5, zone))).toBe(true);
    expect(anyRingEitherBull(FIVE, on(6, "TREBLE"))).toBe(false);
    expect(anyRingEitherBull(FIVE, on(null, "MISS"))).toBe(false);
    expect(anyRingEitherBull(BULL, on(25, "OUTER_BULL"))).toBe(true);
    expect(anyRingEitherBull(BULL, on(25, "INNER_BULL"))).toBe(true);
    expect(anyRingEitherBull(BULL, on(5, "SINGLE"))).toBe(false);
  });

  it("pointsTable: the target kind's row, only on the target's own section", () => {
    const points = pointsTable({
      number: { OUTER_SINGLE: 1, TREBLE: 9 },
      bull: { INNER_BULL: 4 },
    });
    expect(points(FIVE, on(5, "TREBLE"))).toBe(9);
    expect(points(FIVE, on(5, "OUTER_SINGLE"))).toBe(1);
    expect(points(FIVE, on(5, "DOUBLE"))).toBe(0);
    expect(points(FIVE, on(6, "TREBLE"))).toBe(0);
    expect(points(BULL, on(25, "INNER_BULL"))).toBe(4);
    expect(points(BULL, on(25, "OUTER_BULL"))).toBe(0);
    expect(points(BULL, on(5, "TREBLE"))).toBe(0);
  });

  it("outBelowHits: OUT when the visit hit fewer than n, untouched otherwise", () => {
    expect(outBelowHits(2)(seat({ hitsThisVisit: 1 })).status).toBe("OUT");
    expect(outBelowHits(2)(seat({ hitsThisVisit: 2 })).status).toBe(
      "IN_PROGRESS",
    );
    expect(outBelowHits(0)(seat({ hitsThisVisit: 0 })).status).toBe(
      "IN_PROGRESS",
    );
  });
});

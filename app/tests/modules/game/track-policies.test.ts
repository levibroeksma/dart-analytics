import { describe, it, expect } from "vitest";
import {
  advanceAfterDarts,
  advanceOnHit,
  advanceToEnd,
  anyRingEitherBull,
  boardScorePoints,
  chainOnTarget,
  closeAfter,
  closeAfterOrPastEnd,
  closeOnHitOrAfter,
  doneOnWrap,
  halveOnBlank,
  lapOnWrap,
  noPoints,
  outAtOrBelowZero,
  outBelowHits,
  outerSingleOnly,
  passOnWrap,
  pathTarget,
  penaltyOnBlank,
  pointsTable,
  recordVisitZone,
  resetOnMiss,
  sectionOf,
  shanghaiWin,
  stepBackBelowHits,
  tallyOnTarget,
  zoneBucketOf,
} from "@modules/game/track-policies";
import { initialTrackSeat } from "@modules/game/track-kernel.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import type {
  ChainTrackExt,
  DartObservation,
  DartZoneKey,
  HitCountTrackExt,
  JudgedDart,
  SequenceTrackExt,
  TrackSeat,
} from "@modules/types";

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

  it("outerSingleOnly: only the outer single on the number, either bull on BULL", () => {
    expect(outerSingleOnly(FIVE, on(5, "OUTER_SINGLE"))).toBe(true);
    for (const zone of ["SINGLE", "INNER_SINGLE", "DOUBLE", "TREBLE"] as const)
      expect(outerSingleOnly(FIVE, on(5, zone))).toBe(false);
    expect(outerSingleOnly(FIVE, on(6, "OUTER_SINGLE"))).toBe(false);
    expect(outerSingleOnly(BULL, on(25, "OUTER_BULL"))).toBe(true);
    expect(outerSingleOnly(BULL, on(25, "INNER_BULL"))).toBe(true);
    expect(outerSingleOnly(BULL, on(null, "MISS"))).toBe(false);
  });

  const judged = (hit: boolean) => ({
    observation: on(5, "TREBLE"),
    target: FIVE,
    hit,
    points: 0,
  });

  it("advanceOnHit: a hit moves on and spends the hit; a miss changes nothing", () => {
    expect(
      advanceOnHit(
        seat({ targetIndex: 4, hitsThisVisit: 1, dartsThisVisit: 2 }),
        judged(true),
      ),
    ).toMatchObject({ targetIndex: 5, hitsThisVisit: 0, dartsThisVisit: 2 });
    const unchanged = seat({ targetIndex: 4 });
    expect(advanceOnHit(unchanged, judged(false))).toBe(unchanged);
  });

  it("closeAfterOrPastEnd(3, 20): open below 3 darts while on the path", () => {
    const open = closeAfterOrPastEnd(3, 20);
    expect(open(seat({ dartsThisVisit: 2, targetIndex: 20 }))).toBe(true);
    expect(open(seat({ dartsThisVisit: 3, targetIndex: 4 }))).toBe(false);
    expect(open(seat({ dartsThisVisit: 1, targetIndex: 21 }))).toBe(false);
  });

  it("stepBackBelowHits(2): enough hits move on, fewer step back, floored at 0", () => {
    const judge = stepBackBelowHits(2);
    expect(judge(seat({ targetIndex: 4, hitsThisVisit: 2 })).targetIndex).toBe(
      5,
    );
    expect(judge(seat({ targetIndex: 20, hitsThisVisit: 3 })).targetIndex).toBe(
      21,
    );
    expect(judge(seat({ targetIndex: 4, hitsThisVisit: 1 })).targetIndex).toBe(
      3,
    );
    expect(judge(seat({ targetIndex: 0, hitsThisVisit: 0 })).targetIndex).toBe(
      0,
    );
  });

  it("lapOnWrap(20): past the end restarts at 0 and counts a lap", () => {
    const lap = lapOnWrap<{ laps: number }>(20);
    const base = initialTrackSeat(SEAT, { laps: 1 });
    expect(lap({ ...base, targetIndex: 21 })).toMatchObject({
      targetIndex: 0,
      status: "IN_PROGRESS",
      ext: { laps: 2 },
    });
    const onBull = { ...base, targetIndex: 20 };
    expect(lap(onBull)).toBe(onBull);
  });

  it("doneOnWrap(20): past the end finishes on the last target", () => {
    expect(doneOnWrap(20)(seat({ targetIndex: 21 }))).toMatchObject({
      targetIndex: 20,
      status: "DONE",
    });
    const onBull = seat({ targetIndex: 20 });
    expect(doneOnWrap(20)(onBull)).toBe(onBull);
  });

  it("boardScorePoints: a hit's board score, nothing for a miss", () => {
    expect(boardScorePoints(FIVE, on(5, "TREBLE"), true)).toBe(15);
    expect(boardScorePoints(FIVE, on(5, "DOUBLE"), true)).toBe(10);
    expect(boardScorePoints(FIVE, on(5, "OUTER_SINGLE"), true)).toBe(5);
    expect(boardScorePoints(FIVE, on(20, "TREBLE"), false)).toBe(0);
  });

  it("zoneBucketOf: single rings, double, treble; null otherwise", () => {
    expect(zoneBucketOf("INNER_SINGLE")).toBe("SINGLE");
    expect(zoneBucketOf("DOUBLE")).toBe("DOUBLE");
    expect(zoneBucketOf("TREBLE")).toBe("TREBLE");
    expect(zoneBucketOf("OUTER_BULL")).toBeNull();
    expect(zoneBucketOf("MISS")).toBeNull();
  });

  type Zones = { zones: (DartZoneKey | null)[]; shanghai: boolean };
  const zoned = (
    zones: (DartZoneKey | null)[],
    over: Partial<TrackSeat<Zones>> = {},
  ): TrackSeat<Zones> => ({
    ...initialTrackSeat(SEAT, { zones, shanghai: false }),
    ...over,
  });

  it("recordVisitZone: the zone on a hit, null on a miss, input untouched", () => {
    const before = zoned(["SINGLE"]);
    const dart = (hit: boolean) => ({
      observation: on(5, "TREBLE"),
      target: FIVE,
      hit,
      points: 0,
    });
    expect(recordVisitZone(before, dart(true)).ext.zones).toEqual([
      "SINGLE",
      "TREBLE",
    ]);
    expect(recordVisitZone(before, dart(false)).ext.zones).toEqual([
      "SINGLE",
      null,
    ]);
    expect(before.ext.zones).toEqual(["SINGLE"]);
  });

  it("halveOnBlank: a hitless visit halves the score, rounding half up", () => {
    expect(halveOnBlank(seat({ score: 15 })).score).toBe(8);
    expect(halveOnBlank(seat({ score: 16 })).score).toBe(8);
    expect(halveOnBlank(seat({ score: 0 })).score).toBe(0);
    const hit = seat({ score: 15, hitsThisVisit: 1 });
    expect(halveOnBlank(hit)).toBe(hit);
  });

  it("shanghaiWin: single, double and treble in any order finish the seat", () => {
    expect(
      shanghaiWin(zoned(["TREBLE", "OUTER_SINGLE", "DOUBLE"])),
    ).toMatchObject({ status: "DONE", ext: { shanghai: true } });
    for (const zones of [
      ["SINGLE", "SINGLE", "TREBLE"],
      ["DOUBLE", null, "TREBLE"],
    ] as (DartZoneKey | null)[][]) {
      const s = zoned(zones);
      expect(shanghaiWin(s)).toBe(s);
    }
  });

  const chained = (
    over: Partial<TrackSeat<ChainTrackExt>> = {},
    ext: Partial<ChainTrackExt> = {},
  ): TrackSeat<ChainTrackExt> => ({
    ...initialTrackSeat(SEAT, {
      chain: 0,
      finishedBest: [null, null, null],
      hits: 0,
      ...ext,
    }),
    ...over,
  });
  const thrown = (hit: boolean, points: number) => ({
    observation: on(5, hit ? "TREBLE" : "DOUBLE"),
    target: FIVE,
    hit,
    points,
  });

  it("sectionOf: a NUMBER target's number, 25 for BULL", () => {
    expect(sectionOf(FIVE)).toBe(5);
    expect(sectionOf(BULL)).toBe(25);
  });

  it("chainOnTarget: a hit grows the chain and counts", () => {
    expect(
      chainOnTarget(3)(chained({}, { chain: 2, hits: 2 }), thrown(true, 3)),
    ).toMatchObject({ targetIndex: 0, ext: { chain: 5, hits: 3 } });
  });

  it("chainOnTarget: a miss on an empty chain changes nothing", () => {
    const s = chained({ targetIndex: 1 });
    expect(chainOnTarget(3)(s, thrown(false, 0))).toBe(s);
  });

  it("chainOnTarget: a miss ends the chain, keeps the best, moves on", () => {
    expect(
      chainOnTarget(3)(
        chained(
          { targetIndex: 1 },
          { chain: 2, finishedBest: [null, 5, null] },
        ),
        thrown(false, 0),
      ),
    ).toMatchObject({
      targetIndex: 2,
      ext: { chain: 0, finishedBest: [null, 5, null] },
    });
    expect(
      chainOnTarget(3)(
        chained({ targetIndex: 2 }, { chain: 4 }),
        thrown(false, 0),
      ),
    ).toMatchObject({
      targetIndex: 0,
      ext: { chain: 0, finishedBest: [null, null, 4] },
    });
  });

  const sequenced = (
    over: Partial<TrackSeat<SequenceTrackExt>> = {},
    ext: Partial<SequenceTrackExt> = {},
  ): TrackSeat<SequenceTrackExt> => ({
    ...initialTrackSeat(SEAT, {
      chain: 0,
      finishedBest: null,
      hits: 0,
      sequences: 0,
      ...ext,
    }),
    ...over,
  });
  const struck = (hit: boolean, points: number) => ({
    observation: on(5, hit ? "TREBLE" : "DOUBLE"),
    target: FIVE,
    hit,
    points,
  });

  it("resetOnMiss: a hit grows the chain and moves to the next target", () => {
    expect(
      resetOnMiss(3)(sequenced({}, { chain: 1, hits: 1 }), struck(true, 3)),
    ).toMatchObject({
      targetIndex: 1,
      ext: { chain: 4, hits: 2, sequences: 0 },
    });
  });

  it("resetOnMiss: a hit on the last target wraps and counts a sequence", () => {
    expect(
      resetOnMiss(3)(
        sequenced({ targetIndex: 2 }, { chain: 2, hits: 2 }),
        struck(true, 1),
      ),
    ).toMatchObject({
      targetIndex: 0,
      ext: { chain: 3, hits: 3, sequences: 1 },
    });
  });

  it("resetOnMiss: a miss restarts and keeps the larger mark", () => {
    expect(
      resetOnMiss(3)(
        sequenced({ targetIndex: 2 }, { chain: 4, finishedBest: 3 }),
        struck(false, 0),
      ),
    ).toMatchObject({ targetIndex: 0, ext: { chain: 0, finishedBest: 4 } });
    expect(
      resetOnMiss(3)(
        sequenced({ targetIndex: 1 }, { chain: 2, finishedBest: 5 }),
        struck(false, 0),
      ),
    ).toMatchObject({ targetIndex: 0, ext: { chain: 0, finishedBest: 5 } });
  });

  it("resetOnMiss: a miss on an empty chain records no mark", () => {
    expect(resetOnMiss(3)(sequenced(), struck(false, 0))).toMatchObject({
      targetIndex: 0,
      ext: { chain: 0, finishedBest: null },
    });
  });
});

describe("Hit Count policies", () => {
  const tally = (
    over: Partial<TrackSeat<HitCountTrackExt>> = {},
    ext: Partial<HitCountTrackExt> = {},
  ): TrackSeat<HitCountTrackExt> => ({
    ...initialTrackSeat(SEAT, {
      dartsOnTarget: 0,
      hitsPerTarget: [0, 0],
      passes: 0,
      ...ext,
    }),
    ...over,
  });
  const judged = (hit: boolean): JudgedDart => ({
    observation: {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    },
    target: { kind: "TREBLE", number: 20 },
    hit,
    points: hit ? 1 : 0,
  });

  it("tallyOnTarget counts every dart and only hits against the current target", () => {
    const afterHit = tallyOnTarget(tally({ targetIndex: 1 }), judged(true));
    expect(afterHit.ext).toEqual({
      dartsOnTarget: 1,
      hitsPerTarget: [0, 1],
      passes: 0,
    });
    const afterMiss = tallyOnTarget(afterHit, judged(false));
    expect(afterMiss.ext).toEqual({
      dartsOnTarget: 2,
      hitsPerTarget: [0, 1],
      passes: 0,
    });
  });

  it("tallyOnTarget never mutates the seat it was given", () => {
    const before = tally();
    tallyOnTarget(before, judged(true));
    expect(before.ext.hitsPerTarget).toEqual([0, 0]);
  });

  it("advanceAfterDarts holds the target until its darts are thrown", () => {
    const seat = tally({}, { dartsOnTarget: 6 });
    expect(advanceAfterDarts<HitCountTrackExt>(9)(seat)).toBe(seat);
  });

  it("advanceAfterDarts moves on and zeroes the count once they are", () => {
    const moved = advanceAfterDarts<HitCountTrackExt>(9)(
      tally({ targetIndex: 0 }, { dartsOnTarget: 9 }),
    );
    expect(moved.targetIndex).toBe(1);
    expect(moved.ext.dartsOnTarget).toBe(0);
  });

  it("passOnWrap leaves an in-range index alone", () => {
    const seat = tally({ targetIndex: 1 });
    expect(passOnWrap<HitCountTrackExt>(1)(seat)).toBe(seat);
  });

  it("passOnWrap restarts past the last index and counts a pass", () => {
    const wrapped = passOnWrap<HitCountTrackExt>(1)(
      tally({ targetIndex: 2 }, { passes: 1 }),
    );
    expect(wrapped.targetIndex).toBe(0);
    expect(wrapped.ext.passes).toBe(2);
  });

  it("lapOnWrap still counts laps after sharing the wrap", () => {
    const lap = lapOnWrap<{ laps: number }>(20)({
      ...initialTrackSeat(SEAT, { laps: 0 }),
      targetIndex: 21,
    });
    expect(lap.targetIndex).toBe(0);
    expect(lap.ext.laps).toBe(1);
  });
});

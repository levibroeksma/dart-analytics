import { describe, it, expect } from "vitest";
import {
  applyCheckoutVisit,
  foldCheckoutSeats,
  foldCheckoutVisits,
  initialCheckoutSeat,
} from "@modules/game/checkout-kernel.module";
import {
  ladderTarget,
  storedTotalJudge,
  untilWon,
  walkTotalJudge,
  winAtCap,
} from "@modules/game/checkout-policies";
import type { SeatFact } from "@lib/types";
import type { CheckoutRules } from "@modules/interfaces";
import type { CheckoutSeat, TurnFact, VisitVerdict } from "@modules/types";

type Ext = { closed: [boolean, VisitVerdict["kind"]][] };

function rules(
  verdicts: VisitVerdict[],
  visitsPerAttempt = 2,
  last = 62,
): CheckoutRules<Ext> {
  let i = 0;
  return {
    visitsPerAttempt,
    judge: () => verdicts[i++],
    onAttemptClose: (seat, passed, verdict) => ({
      ...seat,
      ext: { closed: [...seat.ext.closed, [passed, verdict.kind]] },
    }),
    nextTarget: (seat) => (seat.target < last ? seat.target + 1 : null),
  };
}

const TURN = { darts: [] } as unknown as TurnFact;
const start = (): CheckoutSeat<Ext> => initialCheckoutSeat(61, { closed: [] });

describe("checkout kernel", () => {
  it("starts on the target with zero counters", () => {
    expect(start()).toEqual({
      target: 61,
      visitStart: 61,
      remaining: 61,
      dartsInVisit: 0,
      visitIndex: 0,
      attemptIndex: 0,
      attempts: 0,
      checkouts: 0,
      status: "IN_PROGRESS",
      ext: { closed: [] },
    });
  });

  it("an open visit shows the live remainder and dart count only", () => {
    const seat = applyCheckoutVisit(
      start(),
      TURN,
      rules([{ kind: "OPEN", remaining: 41, darts: 1 }]),
    );
    expect(seat).toMatchObject({
      remaining: 41,
      dartsInVisit: 1,
      visitStart: 61,
      visitIndex: 0,
    });
  });

  it("a checkout closes the attempt as passed and moves to the next target", () => {
    const seat = applyCheckoutVisit(
      start(),
      TURN,
      rules([{ kind: "CHECKOUT", darts: 2 }]),
    );
    expect(seat).toMatchObject({
      target: 62,
      visitStart: 62,
      remaining: 62,
      visitIndex: 0,
      dartsInVisit: 0,
      attemptIndex: 1,
      attempts: 1,
      checkouts: 1,
      ext: { closed: [[true, "CHECKOUT"]] },
    });
  });

  it("onAttemptClose sees the visit index of the checking-out visit", () => {
    const seen: number[] = [];
    const r = rules([
      { kind: "SPENT", remaining: 21 },
      { kind: "CHECKOUT", darts: 1 },
    ]);
    const spy: CheckoutRules<Ext> = {
      ...r,
      onAttemptClose: (seat, passed, verdict) => {
        seen.push(seat.visitIndex);
        return r.onAttemptClose(seat, passed, verdict);
      },
    };
    foldCheckoutVisits([TURN, TURN], start(), spy);
    expect(seen).toEqual([1]);
  });

  it("a spent visit carries its remainder; a bust carries the visit start", () => {
    const spent = applyCheckoutVisit(
      start(),
      TURN,
      rules([{ kind: "SPENT", remaining: 21 }]),
    );
    expect(spent).toMatchObject({
      visitIndex: 1,
      visitStart: 21,
      remaining: 21,
      attempts: 0,
    });
    const bust = applyCheckoutVisit(start(), TURN, rules([{ kind: "BUST" }]));
    expect(bust).toMatchObject({
      visitIndex: 1,
      visitStart: 61,
      remaining: 61,
      attempts: 0,
    });
  });

  it("the budget's last visit without a checkout fails the attempt", () => {
    const seat = foldCheckoutVisits(
      [TURN, TURN],
      start(),
      rules([{ kind: "SPENT", remaining: 21 }, { kind: "BUST" }]),
    );
    expect(seat).toMatchObject({
      target: 62,
      attempts: 1,
      checkouts: 0,
      visitIndex: 0,
      ext: { closed: [[false, "BUST"]] },
    });
  });

  it("a null next target ends the seat as DONE", () => {
    const seat = foldCheckoutVisits(
      [TURN, TURN],
      start(),
      rules(
        [
          { kind: "CHECKOUT", darts: 3 },
          { kind: "CHECKOUT", darts: 3 },
        ],
        2,
        62,
      ),
    );
    expect(seat).toMatchObject({
      status: "DONE",
      attempts: 2,
      checkouts: 2,
      attemptIndex: 2,
    });
  });
  it("a FAIL verdict closes the attempt as failed before the budget's last visit", () => {
    const seat = applyCheckoutVisit(start(), TURN, rules([{ kind: "FAIL" }]));
    expect(seat).toMatchObject({
      target: 62,
      visitStart: 62,
      remaining: 62,
      visitIndex: 0,
      attemptIndex: 1,
      attempts: 1,
      checkouts: 0,
      status: "IN_PROGRESS",
      ext: { closed: [[false, "FAIL"]] },
    });
  });
});

describe("foldCheckoutSeats", () => {
  const seats = [
    { participantRef: "p1", sideKey: "A" },
    { participantRef: "p2", sideKey: "B" },
  ] as SeatFact[];
  const seatRules: CheckoutRules<null> = {
    visitsPerAttempt: 1,
    judge: storedTotalJudge,
    onAttemptClose: (seat) => seat,
    nextTarget: ladderTarget(10, 1, 2, 170),
  };
  const stored = (
    ref: string,
    totalScore: number,
    completedAt: string | null = "x",
  ) =>
    ({
      clientKey: `${ref}-${totalScore}`,
      stageClientKey: "s",
      participantRef: ref,
      sequence: 1,
      completedAt,
      totalScore,
      darts: [],
    }) as TurnFact;

  it("folds each seat over its own turns, aligned with `seats`", () => {
    const folded = foldCheckoutSeats(
      [stored("p1", 41), stored("p2", 0), stored("p1", 0), stored("p2", 0)],
      seats,
      initialCheckoutSeat(41, null),
      seatRules,
    );
    expect(folded.map((s) => [s.target, s.attempts, s.checkouts])).toEqual([
      [50, 2, 1],
      [39, 2, 0],
    ]);
  });

  it("shows the open turn on its own seat only, ladder untouched", () => {
    const folded = foldCheckoutSeats(
      [stored("p1", 41), stored("p2", 0, null)],
      seats,
      initialCheckoutSeat(41, null),
      seatRules,
    );
    expect(folded[0].target).toBe(51);
    expect(folded[1]).toMatchObject({ target: 41, attempts: 0 });
  });
});

describe("checkout kernel — a seat a policy marked WON", () => {
  it("keeps WON on the cap target with the attempt booked", () => {
    const seat = applyCheckoutVisit(
      { ...initialCheckoutSeat(170, null), target: 170 },
      {
        completedAt: "2026-11-01T10:00:00Z",
        totalScore: 170,
        darts: [],
      } as unknown as TurnFact,
      {
        visitsPerAttempt: 3,
        judge: walkTotalJudge,
        onAttemptClose: winAtCap(170),
        nextTarget: untilWon(ladderTarget(1, 0, 121, 170)),
      },
    );
    expect(seat).toMatchObject({
      status: "WON",
      target: 170,
      attempts: 1,
      checkouts: 1,
      visitIndex: 0,
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  applyEliminationDart,
  foldElimination,
} from "@modules/game/elimination-kernel.module";
import type { EliminationRules } from "@modules/interfaces";
import type { ClosedVisit, DartObservation, TurnFact } from "@modules/types";
import { killerHit } from "@modules/game/elimination-policies";
import type { KillerExt } from "@modules/types";
import type { SeatFact } from "@lib/types";

type Ext = Record<string, never>;

const rules: EliminationRules<Ext> = {
  startingLives: 2,
  initExt: () => ({}),
  onDart: (_thrower, seats, dart) =>
    dart.hitZoneKey === "DOUBLE" && dart.hitTargetNumber !== null
      ? [
          {
            participantRef: seats[dart.hitTargetNumber - 1].participantRef,
            livesDelta: -1,
          },
        ]
      : [],
};

const seat = (n: number): SeatFact => ({
  participantRef: `p${n}`,
  displayName: `P${n}`,
  sideKey: "ABCD"[n - 1],
  participantTypeKey: "PLAYER",
});
const seats2 = [seat(1), seat(2)];
const seats3 = [seat(1), seat(2), seat(3)];
const seats4 = [seat(1), seat(2), seat(3), seat(4)];

const d = (n: number): DartObservation => ({
  hitTargetNumber: n,
  hitZoneKey: "DOUBLE",
  locationX: null,
  locationY: null,
});
const miss: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

let seq = 0;
function turn(
  ref: string,
  darts: DartObservation[],
  closed: boolean,
  kept?: boolean,
): TurnFact {
  seq += 1;
  return {
    clientKey: `t${seq}`,
    stageClientKey: "s1",
    participantRef: ref,
    sequence: seq,
    completedAt: closed ? "2026-10-27T00:00:00.000Z" : null,
    totalScore: 0,
    ...(kept === undefined ? {} : { kept }),
    darts: darts.map((dart, i) => ({
      ...dart,
      sequence: i + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      score: 0,
    })),
  };
}

describe("elimination kernel", () => {
  it("starts every seat at startingLives, seat 0 active", () => {
    const m = foldElimination([], seats3, rules);
    expect(m.seats.map((s) => s.lives)).toEqual([2, 2, 2]);
    expect(m.activeParticipantRef).toBe("p1");
    expect(m.status).toBe("IN_PROGRESS");
  });

  it("an open visit keeps its thrower", () => {
    expect(
      foldElimination([turn("p1", [miss], false)], seats3, rules)
        .activeParticipantRef,
    ).toBe("p1");
  });

  it("a closed visit passes to the next seat", () => {
    expect(
      foldElimination([turn("p1", [miss, miss, miss], true)], seats3, rules)
        .activeParticipantRef,
    ).toBe("p2");
  });

  it("lives clamp at zero and a seat at zero is out, in order", () => {
    const m = foldElimination(
      [turn("p1", [d(2), d(2), d(2)], true)],
      seats3,
      rules,
    );
    expect(m.seats[1]).toMatchObject({ lives: 0, out: true });
    expect(m.outOrder).toEqual(["p2"]);
  });

  it("the rota skips an out seat (3 seats)", () => {
    const m = foldElimination(
      [turn("p1", [d(2), d(2), miss], true)],
      seats3,
      rules,
    );
    expect(m.activeParticipantRef).toBe("p3");
  });

  it("the rota wraps past out seats (4 seats)", () => {
    const m = foldElimination(
      [
        turn("p1", [d(2), d(2), d(4)], true),
        turn("p3", [d(4), miss, miss], true),
      ],
      seats4,
      rules,
    );
    expect(m.outOrder).toEqual(["p2", "p4"]);
    expect(m.activeParticipantRef).toBe("p1");
  });

  it("a change to an out seat is ignored", () => {
    const m = foldElimination(
      [
        turn("p1", [d(2), d(2), miss], true),
        turn("p3", [d(2), miss, miss], true),
      ],
      seats3,
      rules,
    );
    expect(m.seats[1].lives).toBe(0);
    expect(m.outOrder).toEqual(["p2"]);
  });

  it("last seat standing completes the match", () => {
    const m = foldElimination([turn("p1", [d(2), d(2)], true)], seats2, rules);
    expect(m).toMatchObject({ status: "COMPLETE", winningSideKey: "A" });
  });

  it("applyEliminationDart applies the policy's changes to a seat list", () => {
    const after = applyEliminationDart(
      foldElimination([], seats2, rules).seats,
      "p1",
      d(2),
      rules,
    );
    expect(after[1].lives).toBe(1);
  });
});

type Shared = { closes: number };

const hookRules = (
  override?: EliminationRules<Ext, Shared>["activeOverride"],
  seen: ClosedVisit[] = [],
): EliminationRules<Ext, Shared> => ({
  ...rules,
  initShared: () => ({ closes: 0 }),
  onVisitClose: (visit, seatList, shared) => {
    seen.push(visit);
    const target = seatList.find((s) => s.participantRef === "p2");
    const strike = visit.kept && visit.participantRef === "p1";
    return {
      changes:
        strike && target ? [{ participantRef: "p2", livesDelta: -2 }] : [],
      shared: { closes: shared.closes + 1 },
    };
  },
  activeOverride: override,
});

describe("elimination kernel visit-close hook", () => {
  it("runs once per closed turn, never for the open turn", () => {
    const seen: ClosedVisit[] = [];
    foldElimination(
      [
        turn("p1", [miss, d(2)], true, true),
        turn("p2", [miss], true, false),
        turn("p3", [miss], false),
      ],
      seats3,
      hookRules(undefined, seen),
    );
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ participantRef: "p1", kept: true });
    expect(seen[0].darts).toHaveLength(2);
    expect(seen[1]).toMatchObject({ participantRef: "p2", kept: false });
  });

  it("kept defaults to false when the turn has none", () => {
    const seen: ClosedVisit[] = [];
    foldElimination(
      [turn("p1", [miss], true)],
      seats3,
      hookRules(undefined, seen),
    );
    expect(seen[0].kept).toBe(false);
  });

  it("applies changes through clamp and out rules, then decides the winner", () => {
    const m = foldElimination(
      [turn("p1", [miss], true, true)],
      seats2,
      hookRules(),
    );
    expect(m.seats[1]).toMatchObject({ lives: 0, out: true });
    expect(m.outOrder).toEqual(["p2"]);
    expect(m).toMatchObject({ status: "COMPLETE", winningSideKey: "A" });
  });

  it("threads shared turn to turn and returns it", () => {
    const m = foldElimination(
      [
        turn("p2", [miss], true, false),
        turn("p3", [miss], true, false),
        turn("p1", [miss], false),
      ],
      seats3,
      hookRules(),
    );
    expect(m.shared).toEqual({ closes: 2 });
  });

  it("shared is undefined with no hooks", () => {
    expect(foldElimination([], seats2, rules).shared).toBeUndefined();
  });

  it("activeOverride beats the rota after a closed turn", () => {
    const m = foldElimination(
      [turn("p1", [miss], true, false)],
      seats3,
      hookRules(() => "p3"),
    );
    expect(m.activeParticipantRef).toBe("p3");
  });

  it("a null override falls back to the rota", () => {
    const m = foldElimination(
      [turn("p1", [miss], true, false)],
      seats3,
      hookRules(() => null),
    );
    expect(m.activeParticipantRef).toBe("p2");
  });

  it("an open turn beats the override", () => {
    const m = foldElimination(
      [turn("p1", [miss], false)],
      seats3,
      hookRules(() => "p3"),
    );
    expect(m.activeParticipantRef).toBe("p1");
  });

  it("the override sees the folded seats and shared", () => {
    const m = foldElimination(
      [turn("p1", [miss], true, false)],
      seats3,
      hookRules((_seats, shared) => (shared.closes === 1 ? "p3" : null)),
    );
    expect(m.activeParticipantRef).toBe("p3");
  });
});

const KILLER_EXPECTED = {
  seats: [
    {
      participantRef: "p1",
      sideKey: "A",
      lives: 3,
      out: false,
      ext: {
        number: 5,
        killer: true,
        livesTaken: 3,
        dartsToKiller: 1,
        dartsThrown: 4,
      },
    },
    {
      participantRef: "p2",
      sideKey: "B",
      lives: 0,
      out: true,
      ext: {
        number: 12,
        killer: false,
        livesTaken: 0,
        dartsToKiller: null,
        dartsThrown: 3,
      },
    },
  ],
  outOrder: ["p2"],
  status: "COMPLETE",
  winningSideKey: "A",
  activeParticipantRef: "p1",
};

describe("elimination kernel Killer regression", () => {
  const killerRules: EliminationRules<KillerExt> = {
    startingLives: 3,
    initExt: (_seat, index) => ({
      number: [5, 12][index],
      killer: false,
      livesTaken: 0,
      dartsToKiller: null,
      dartsThrown: 0,
    }),
    onDart: killerHit,
  };
  const log = () => [
    turn("p1", [d(5), d(12), d(12)], true),
    turn("p2", [miss, miss, miss], true),
    turn("p1", [d(12)], false),
  ];

  it("folds a Killer log to its pre-change result", () => {
    const { shared, ...match } = foldElimination(log(), seats2, killerRules);
    expect(shared).toBeUndefined();
    expect(match).toStrictEqual(KILLER_EXPECTED);
  });
});

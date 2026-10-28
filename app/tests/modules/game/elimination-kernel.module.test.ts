import { describe, it, expect } from "vitest";
import {
  applyEliminationDart,
  foldElimination,
} from "@modules/game/elimination-kernel.module";
import type { EliminationRules } from "@modules/interfaces";
import type { DartObservation, TurnFact } from "@modules/types";
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
): TurnFact {
  seq += 1;
  return {
    clientKey: `t${seq}`,
    stageClientKey: "s1",
    participantRef: ref,
    sequence: seq,
    completedAt: closed ? "2026-10-27T00:00:00.000Z" : null,
    totalScore: 0,
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

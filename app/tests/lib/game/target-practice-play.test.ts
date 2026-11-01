import { describe, expect, it } from "vitest";
import {
  lastTurnSeatRound,
  ringTapObservation,
} from "@lib/game/target-practice-play";
import type { BoardTarget, TurnFact } from "@modules/types";

const NUMBER_TARGET: BoardTarget = { kind: "NUMBER", number: 7 };
const BULL_TARGET: BoardTarget = { kind: "BULL" };

describe("ringTapObservation", () => {
  it("a MISS carries no target number on any target", () => {
    const miss = {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
    expect(ringTapObservation(NUMBER_TARGET, "MISS")).toEqual(miss);
    expect(ringTapObservation(BULL_TARGET, "MISS")).toEqual(miss);
  });

  it.each(["SINGLE", "DOUBLE", "TREBLE"] as const)(
    "a %s tap on a number records that ring at the number",
    (ring) => {
      expect(ringTapObservation(NUMBER_TARGET, ring)).toEqual({
        hitTargetNumber: 7,
        hitZoneKey: ring,
        locationX: null,
        locationY: null,
      });
    },
  );

  it("on the bull SINGLE is the outer bull and DOUBLE the inner one", () => {
    expect(ringTapObservation(BULL_TARGET, "SINGLE")).toEqual({
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: null,
      locationY: null,
    });
    expect(ringTapObservation(BULL_TARGET, "DOUBLE")).toEqual({
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    });
  });

  it("a TREBLE tap on the bull stands for no dart", () => {
    expect(ringTapObservation(BULL_TARGET, "TREBLE")).toBeNull();
  });
});

describe("lastTurnSeatRound", () => {
  const turn = (participantRef: string) => ({ participantRef }) as TurnFact;

  it("is 0 before any turn", () => {
    expect(lastTurnSeatRound([])).toBe(0);
  });

  it("counts only the last turn's own seat in a solo session", () => {
    expect(lastTurnSeatRound([turn("a"), turn("a"), turn("a")])).toBe(2);
  });

  it("ignores the other seat's interleaved turns", () => {
    expect(
      lastTurnSeatRound([
        turn("a"),
        turn("b"),
        turn("a"),
        turn("b"),
        turn("a"),
      ]),
    ).toBe(2);
    expect(
      lastTurnSeatRound([turn("a"), turn("b"), turn("a"), turn("b")]),
    ).toBe(1);
  });
});

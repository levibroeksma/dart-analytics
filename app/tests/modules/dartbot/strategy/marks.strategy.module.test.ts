import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { chooseTarget } from "@modules/dartbot/strategy/marks.strategy.module";
import type { MarksView } from "@modules/interfaces";

const ORDER = [20, 19, 18, 17, 16, 15, 25];

function view(
  marks: Record<number, [number, number]> = {},
  points: [number, number] = [0, 0],
): MarksView {
  return {
    ownPoints: points[0],
    opponentPoints: points[1],
    objectives: ORDER.map((targetNumber) => {
      const [own, opponent] = marks[targetNumber] ?? [0, 0];
      return { targetNumber, own, opponent };
    }),
  };
}

describe("marks chooseTarget", () => {
  it("closes 20 first when nothing is marked", () => {
    expect(chooseTarget(view())).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
    });
  });

  it("closes the next open number once 20 is closed by both", () => {
    expect(chooseTarget(view({ 20: [3, 3] }))).toEqual({
      targetNumber: 19,
      zoneKey: "TREBLE",
    });
  });

  it("scores on a number it owns that the opponent has open", () => {
    expect(chooseTarget(view({ 20: [3, 1], 19: [3, 3] }))).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
    });
  });

  it("scores before closing a new number", () => {
    expect(chooseTarget(view({ 18: [3, 0] }))).toEqual({
      targetNumber: 18,
      zoneKey: "TREBLE",
    });
  });

  it("blocks a number the opponent closed and it has not", () => {
    expect(chooseTarget(view({ 17: [1, 3] }))).toEqual({
      targetNumber: 17,
      zoneKey: "TREBLE",
    });
  });

  it("blocks before scoring", () => {
    expect(chooseTarget(view({ 20: [3, 0], 15: [0, 3] }))).toEqual({
      targetNumber: 15,
      zoneKey: "TREBLE",
    });
  });

  it("blocks the first of several in fixed order", () => {
    expect(chooseTarget(view({ 17: [0, 3], 16: [0, 3] }))).toEqual({
      targetNumber: 17,
      zoneKey: "TREBLE",
    });
  });

  it("aims the inner bull for the bull", () => {
    const intent = chooseTarget(
      view({
        20: [3, 3],
        19: [3, 3],
        18: [3, 3],
        17: [3, 3],
        16: [3, 3],
        15: [3, 3],
      }),
    );
    expect(intent).toEqual({ targetNumber: 25, zoneKey: "INNER_BULL" });
    expect(zoneCentroid(25, "INNER_BULL")).toEqual({ x: 0, y: 0 });
  });

  it("falls back to treble 20 when every objective is dead", () => {
    const dead = Object.fromEntries(ORDER.map((n) => [n, [3, 3]])) as Record<
      number,
      [number, number]
    >;
    expect(chooseTarget(view(dead))).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
    });
  });

  it("returns an aimable treble for every number", () => {
    for (const n of ORDER.slice(0, 6)) {
      const intent = chooseTarget(
        view(
          Object.fromEntries(
            ORDER.filter((m) => m > n).map((m) => [m, [3, 3]]),
          ),
        ),
      );
      expect(zoneCentroid(intent.targetNumber, intent.zoneKey)).not.toBeNull();
    }
  });

  it("stops scoring once it leads on points and closes instead", () => {
    expect(chooseTarget(view({ 20: [3, 0] }, [40, 0]))).toEqual({
      targetNumber: 19,
      zoneKey: "TREBLE",
    });
  });

  it("keeps scoring when tied on points", () => {
    expect(chooseTarget(view({ 20: [3, 0] }, [20, 20]))).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
    });
  });

  it("scores when trailing on points", () => {
    expect(chooseTarget(view({ 20: [3, 0] }, [0, 40]))).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
    });
  });

  it("still blocks while leading on points", () => {
    expect(chooseTarget(view({ 17: [1, 3] }, [40, 0]))).toEqual({
      targetNumber: 17,
      zoneKey: "TREBLE",
    });
  });
});

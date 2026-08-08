import { describe, expect, it } from "vitest";
import { SECTOR_ORDER, classify } from "@lib/game/board/board-geometry.module";

/**
 * Every one of the 20 sectors, pinned individually. The earlier suite spot-checks
 * five positions plus one adjacency, which catches a whole-array rotation but not
 * a transposition confined to the untested stretch. A wrong SECTOR_ORDER scores
 * real darts under the wrong number, permanently and silently.
 */
describe("SECTOR_ORDER", () => {
  const CLOCKWISE_FROM_20 = [
    20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
  ];

  it("matches the regulation clockwise order", () => {
    expect([...SECTOR_ORDER]).toEqual(CLOCKWISE_FROM_20);
  });

  it("contains every board number exactly once", () => {
    expect([...SECTOR_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it.each(CLOCKWISE_FROM_20.map((n, i) => [i, n] as const))(
    "resolves sector index %i to number %i",
    (index, expected) => {
      const radians = index * 18 * (Math.PI / 180);
      const radius = 130;
      expect(
        classify(radius * Math.sin(radians), -radius * Math.cos(radians))
          .targetNumber,
      ).toBe(expected);
    },
  );
});

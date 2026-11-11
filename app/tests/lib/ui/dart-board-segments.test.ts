import { describe, it, expect } from "vitest";
import { BOARD_SEGMENTS } from "@lib/ui/dart-board-segments";

describe("BOARD_SEGMENTS", () => {
  it("lists the twenty numbers clockwise from 20", () => {
    expect(BOARD_SEGMENTS.map((segment) => segment.label)).toEqual(
      "20 1 18 4 13 6 10 15 2 17 3 19 7 16 8 11 14 9 12 5".split(" "),
    );
  });

  it("alternates dark and light, starting dark at 20", () => {
    expect(BOARD_SEGMENTS.map((segment) => segment.tone)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        index % 2 === 0 ? "dark" : "light",
      ),
    );
  });

  it("gives every segment a closed path per ring", () => {
    const paths = BOARD_SEGMENTS.flatMap((segment) => [
      segment.singleBig,
      segment.singleSmall,
      segment.treble,
      segment.double,
    ]);
    expect(paths).toHaveLength(80);
    expect(paths.filter((path) => /^M[-\d.,AL]+Z$/.test(path))).toHaveLength(
      80,
    );
    expect(new Set(paths).size).toBe(80);
  });

  it("puts 20's label straight above the centre and 3's straight below", () => {
    const top = BOARD_SEGMENTS[0]!;
    const bottom = BOARD_SEGMENTS.find((segment) => segment.label === "3")!;
    expect([top.labelX, top.labelY]).toEqual(["0", "-192"]);
    expect(bottom.labelY).toBe("192");
  });
});

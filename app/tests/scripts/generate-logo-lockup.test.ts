import { describe, expect, it } from "vitest";
import { parseBoardViewBox } from "../../scripts/generate-logo-lockup";

describe("generate-logo-lockup helpers", () => {
  it("reads the board dimensions from its viewBox", () => {
    expect(
      parseBoardViewBox('<svg viewBox="-220 -220 440 420"></svg>'),
    ).toEqual({
      minX: -220,
      minY: -220,
      width: 440,
      height: 420,
    });
  });

  it("rejects an invalid viewBox", () => {
    expect(() => parseBoardViewBox("<svg></svg>")).toThrow(
      "missing or invalid viewBox",
    );
  });
});

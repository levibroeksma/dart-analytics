import { describe, expect, it } from "vitest";
import { formatRemaining } from "@lib/game/play-countdown";

describe("formatRemaining", () => {
  it("formats whole minutes as mm:ss", () => {
    expect(formatRemaining(180000)).toBe("03:00");
  });

  it("floors partial seconds", () => {
    expect(formatRemaining(61999)).toBe("01:01");
  });

  it("clamps a negative remainder to 00:00", () => {
    expect(formatRemaining(-5000)).toBe("00:00");
  });

  it("treats null and undefined as 00:00", () => {
    expect(formatRemaining(null)).toBe("00:00");
    expect(formatRemaining(undefined)).toBe("00:00");
  });
});

import { describe, it, expect } from "vitest";
import { initialsOf, playerCountLabel } from "@lib/ui/initials";

describe("initialsOf", () => {
  it("takes first and last word initials", () => {
    expect(initialsOf("Levi Broeksma")).toBe("LB");
    expect(initialsOf("anna van der berg")).toBe("AB");
  });

  it("uses one letter for a single word", () => {
    expect(initialsOf("Levi")).toBe("L");
  });

  it("trims and collapses whitespace", () => {
    expect(initialsOf("  jo   smith ")).toBe("JS");
  });

  it("falls back to ? for empty input", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf(undefined)).toBe("?");
  });
});

describe("playerCountLabel", () => {
  it("pluralises", () => {
    expect(playerCountLabel(1)).toBe("1 PLAYER");
    expect(playerCountLabel(2)).toBe("2 PLAYERS");
  });
});

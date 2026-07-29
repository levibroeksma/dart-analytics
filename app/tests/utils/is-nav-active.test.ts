import { describe, it, expect } from "vitest";
import { isNavActive } from "@utils/is-nav-active";

describe("isNavActive", () => {
  it("matches an exact pathname with no matchPrefix", () => {
    expect(isNavActive("/games", "/games")).toBe(true);
  });

  it("does not match an unrelated pathname with no matchPrefix", () => {
    expect(isNavActive("/statistics", "/games")).toBe(false);
  });

  it("matches a nested path when matchPrefix covers it", () => {
    expect(
      isNavActive("/games/score-training/setup", "/games", "/games/"),
    ).toBe(true);
  });

  it("does not match a nested path when no matchPrefix is given", () => {
    expect(isNavActive("/games/score-training/setup", "/games")).toBe(false);
  });

  it("a root matchPrefix of '/' must not match every route", () => {
    expect(isNavActive("/statistics", "/", "/")).toBe(true);
  });

  it("a prefix string that is a literal substring of another route must require the trailing separator to avoid a false match", () => {
    expect(isNavActive("/games-archive", "/games", "/games/")).toBe(false);
    expect(isNavActive("/games-archive", "/games", "/games")).toBe(true);
  });
});

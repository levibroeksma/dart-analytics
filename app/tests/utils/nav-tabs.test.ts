import { describe, it, expect } from "vitest";
import { NAV_TABS, navTabMatchPrefix } from "@utils/nav-tabs";

describe("NAV_TABS", () => {
  it("lists the five bottom-nav tabs in display order", () => {
    expect(NAV_TABS.map((tab) => tab.href)).toEqual([
      "/",
      "/games",
      "/training",
      "/statistics",
      "/profile",
    ]);
  });
});

describe("navTabMatchPrefix", () => {
  it("has no prefix for the root tab", () => {
    expect(navTabMatchPrefix("/")).toBeUndefined();
  });

  it("matches nested paths for other tabs", () => {
    expect(navTabMatchPrefix("/games")).toBe("/games/");
  });
});
